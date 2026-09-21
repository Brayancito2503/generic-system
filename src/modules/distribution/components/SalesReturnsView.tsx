'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Undo2,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { PaginatedResult, SaleEntity, SaleReturnEntity } from '../entities';
import { apiGet, apiSend } from '../api';
import { formatCurrency } from '../utils/currency';

const PAGE_SIZE = 20;
/** Sales fetched for the "new return" picker (create is per-sale via POST /sales/[id]/returns). */
const PICKER_LIMIT = 100;

const fmtDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export function SalesReturnsView() {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();

  const { data: tenantSettingsData } = useQuery<{ settings: { currencySymbol?: string } }>({
    queryKey: ['tenant-settings'],
    queryFn: () => apiGet<{ settings: { currencySymbol?: string } }>('/settings'),
  });

  const fmt = (n: number) => formatCurrency(n, tenantSettingsData?.settings);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Create flow: picker (choose sale) → return modal (items + reason).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [saleForReturn, setSaleForReturn] = useState<SaleEntity | null>(null);
  const [lineQty, setLineQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Server-driven return history (GET /returns); the server is the source of
  // truth, no session cache.
  const { data, isPending, isError } = useQuery<PaginatedResult<SaleReturnEntity>>({
    queryKey: ['returns', page],
    queryFn: () =>
      apiGet<PaginatedResult<SaleReturnEntity>>(
        `/returns?page=${page}&limit=${PAGE_SIZE}`
      ),
  });

  // Sales used by the picker to start a return; sale rows themselves are not
  // modified by returns, so this list only needs refreshing on new sales.
  const { data: salesData } = useQuery<PaginatedResult<SaleEntity>>({
    queryKey: ['sales'],
    queryFn: () =>
      apiGet<PaginatedResult<SaleEntity>>(`/sales?page=1&limit=${PICKER_LIMIT}`),
  });

  const returns = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;
  const sales = salesData?.items ?? [];

  const filtered = search.trim()
    ? returns.filter(
        (r) =>
          (r.saleNumber?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          (r.reason?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          r.items.some((i) =>
            i.itemName.toLowerCase().includes(search.toLowerCase())
          )
      )
    : returns;

  const filteredSales = pickerSearch.trim()
    ? sales.filter(
        (s) =>
          (s.invoiceNumber?.toLowerCase().includes(pickerSearch.toLowerCase()) ?? false) ||
          (s.customerName?.toLowerCase().includes(pickerSearch.toLowerCase()) ?? false)
      )
    : sales;

  const createReturn = useMutation({
    mutationFn: (payload: {
      saleId: string;
      items: { itemId: string; quantity: number }[];
      reason: string | null;
    }) =>
      apiSend<SaleReturnEntity>(`/sales/${payload.saleId}/returns`, 'POST', {
        items: payload.items,
        reason: payload.reason,
      }),
    onSuccess: () => {
      setSaleForReturn(null);
      setError(null);
      setSuccess(t('returns.success'));
      setTimeout(() => setSuccess(null), 4000);
      // A return restores stock, adjusts the receivable balance when the
      // sale was on credit, and becomes part of the audit history.
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    },
    // 409 cumulative over-return and 400 product-not-in-sale surface here.
    onError: (e) =>
      setError(e instanceof Error ? e.message : t('returns.loadError')),
  });

  const openPicker = () => {
    setPickerSearch('');
    setError(null);
    setPickerOpen(true);
  };

  const pickSale = (sale: SaleEntity) => {
    setPickerOpen(false);
    setSaleForReturn(sale);
    setLineQty({});
    setReason('');
    setError(null);
  };

  const qtyFor = (itemId: string) => {
    const q = parseInt(lineQty[itemId] ?? '0', 10);
    return Number.isNaN(q) ? 0 : q;
  };

  const lineExceedsSold = (itemId: string) => {
    const sale = saleForReturn;
    if (!sale) return false;
    const line = sale.items.find((li) => li.itemId === itemId);
    if (!line) return false;
    const q = qtyFor(itemId);
    return q > line.quantity;
  };

  const refundPreview = saleForReturn
    ? saleForReturn.items.reduce((acc, line) => {
        const q = qtyFor(line.itemId);
        return q > 0 ? acc + line.price * q : acc;
      }, 0)
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForReturn) return;

    const items = saleForReturn.items
      .map((line) => ({
        itemId: line.itemId,
        quantity: qtyFor(line.itemId),
      }))
      .filter((l) => l.quantity > 0);

    if (items.length === 0) {
      setError(t('returns.mustPickItem'));
      return;
    }
    if (items.some((l) => {
      const line = saleForReturn.items.find((li) => li.itemId === l.itemId);
      return line ? l.quantity > line.quantity : true;
    })) {
      setError(t('returns.qtyExceeds'));
      return;
    }

    createReturn.mutate({
      saleId: saleForReturn.id,
      items,
      reason: reason.trim() ? reason.trim() : null,
    });
  };

  const from = returns.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + returns.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Undo2 className="w-7 h-7 text-primary" /> {t('returns.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('returns.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={openPicker}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 font-medium text-sm text-primary-foreground rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" /> {t('returns.newReturn')}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('returns.searchPlaceholder')}
          className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:underline">
            {t('returns.closeError')}
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-500 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {success}
        </div>
      )}

      {/* Returns history */}
      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('returns.loading')}
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-destructive text-sm">{t('returns.loadError')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          {returns.length === 0 && page > 1
            ? t('returns.emptyPage')
            : returns.length === 0
              ? t('returns.empty')
              : t('returns.noSearchResults')}
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">{t('returns.date')}</th>
                  <th className="px-5 py-3">{t('returns.colSale')}</th>
                  <th className="px-5 py-3">{t('returns.colReason')}</th>
                  <th className="px-5 py-3 text-center">{t('returns.colItems')}</th>
                  <th className="px-5 py-3 text-right">{t('returns.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const isOpen = expandedId === r.id;
                  const lineCount = r.items.reduce((a, i) => a + i.quantity, 0);
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        onClick={() => setExpandedId(isOpen ? null : r.id)}
                        className="hover:bg-accent/40 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">
                              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </span>
                            {fmtDate(r.createdAt)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono font-medium text-primary">
                          {r.saleNumber ?? r.saleId.slice(0, 8)}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground truncate max-w-[220px]">
                          {r.reason ?? t('returns.noReason')}
                        </td>
                        <td className="px-5 py-3.5 text-center text-muted-foreground">
                          {t('returns.itemsCount', { count: lineCount.toString() })}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          - {fmt(r.totalRefund)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={5} className="px-6 pb-4 pt-1 bg-muted/20 border-t border-border">
                            <div className="space-y-1.5 pt-2">
                              {r.items.map((line) => (
                                <div key={line.id} className="flex justify-between text-sm text-muted-foreground">
                                  <span>
                                    {line.itemName} <span className="text-muted-foreground/70">× {line.quantity}</span>
                                  </span>
                                  <span className="font-mono text-foreground">- {fmt(line.refundAmount)}</span>
                                </div>
                              ))}
                              <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                                {t('returns.refundTotal')}:{' '}
                                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                  - {fmt(r.totalRefund)}
                                </span>
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {returns.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {t('returns.empty')}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" /> {t('paginator.previous')}
            </button>
            <span className="text-xs text-muted-foreground">
              {t('paginator.info', { from: from.toString(), to: to.toString() })}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {t('paginator.next')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* Modal Pick Sale */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">{t('returns.pickerTitle')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t('returns.pickerHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t('returns.closeError')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={t('returns.pickerSearchPlaceholder')}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {filteredSales.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  {t('returns.pickerEmpty')}
                </p>
              ) : (
                filteredSales.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickSale(s)}
                    aria-label={t('returns.returnAction')}
                    className="w-full flex items-center justify-between gap-3 bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground font-mono truncate">{s.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.customerName ?? t('sales.anonymous')} · {fmtDate(s.createdAt)}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {fmt(s.total)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Create Return */}
      {saleForReturn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">{t('returns.modalTitle')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {saleForReturn.invoiceNumber} ·{' '}
                  {saleForReturn.customerName ?? t('sales.anonymous')} ·{' '}
                  {fmtDate(saleForReturn.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSaleForReturn(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t('returns.closeError')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {t('returns.productsLabel')}
              </p>
              {saleForReturn.items.map((line) => {
                const exceeds = lineExceedsSold(line.itemId);
                return (
                  <div key={line.id} className="flex items-center justify-between gap-3 bg-muted/30 border border-border rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{line.itemName}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('returns.soldQty')}: {line.quantity} · {fmt(line.price)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t('returns.qty')}</span>
                      <input
                        type="number"
                        min="0"
                        max={line.quantity}
                        step="1"
                        value={lineQty[line.itemId] ?? ''}
                        onChange={(e) =>
                          setLineQty((prev) => ({ ...prev, [line.itemId]: e.target.value }))
                        }
                        className={`w-20 px-3 py-2 bg-background border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:border-primary ${
                          exceeds ? 'border-destructive/60 focus:ring-2 focus:ring-destructive/30' : 'border-border'
                        }`}
                      />
                    </div>
                    {exceeds && (
                      <p className="text-[11px] text-destructive w-full text-right -mt-1">
                        {t('returns.qtyExceeds')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t('returns.reason')} <span className="opacity-70">({t('returns.reasonOptional')})</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('returns.reasonPlaceholder')}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">{t('returns.refundTotal')}</span>
              <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {fmt(refundPreview)}
              </span>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSaleForReturn(null)}
                className="px-4 py-2 bg-muted hover:bg-accent text-xs font-semibold rounded-lg text-foreground transition-colors"
              >
                {t('returns.cancel')}
              </button>
              <button
                type="submit"
                disabled={createReturn.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60 shadow-xs"
              >
                {createReturn.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {createReturn.isPending ? t('returns.submitting') : t('returns.submit')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}