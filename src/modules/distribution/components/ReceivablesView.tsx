'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  HandCoins,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Receipt,
} from 'lucide-react';
import type {
  PaginatedResult,
  ReceivableEntity,
  ReceivableStatus,
  PaymentMethod,
  SaleEntity,
} from '../entities';
import { apiGet, apiSend } from '../api';
import { formatCurrency } from '../utils/currency';

const PAGE_SIZE = 20;

/** Settlement methods accepted by POST /receivables/[id]/pay (no CREDIT). */
type PayMethod = 'CASH' | 'CARD' | 'TRANSFER';

const STATUS_FILTERS: ('' | ReceivableStatus)[] = ['', 'OPEN', 'PARTIAL', 'PAID'];

const fmtDateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function ReceivablesView() {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();

  const { data: tenantSettingsData } = useQuery<{ settings: { currencySymbol?: string } }>({
    queryKey: ['tenant-settings'],
    queryFn: () => apiGet<{ settings: { currencySymbol?: string } }>('/settings'),
  });

  const fmt = (n: number) => formatCurrency(n, tenantSettingsData?.settings);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'' | ReceivableStatus>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<ReceivableEntity | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('CASH');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery<PaginatedResult<ReceivableEntity>>({
    queryKey: ['receivables', page, statusFilter],
    queryFn: () =>
      apiGet<PaginatedResult<ReceivableEntity>>(
        `/receivables?page=${page}&limit=${PAGE_SIZE}${
          statusFilter ? `&status=${statusFilter}` : ''
        }`
      ),
  });

  // Best-effort invoice reference: the receivable payload only carries
  // saleId, so join it against the most recent sales for a display label and
  // fall back to the sale id when the sale is outside the fetched window.
  const { data: recentSales } = useQuery<PaginatedResult<SaleEntity>>({
    queryKey: ['sales-references'],
    queryFn: () => apiGet<PaginatedResult<SaleEntity>>('/sales?page=1&limit=100'),
  });

  const invoiceBySaleId = new Map(
    (recentSales?.items ?? []).map((s) => [s.id, s.invoiceNumber])
  );

  const receivables = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;

  const PAYMENT_LABEL_KEYS: Record<PaymentMethod, string> = {
    CASH: 'sales.cash',
    CARD: 'sales.card',
    TRANSFER: 'sales.transfer',
    CREDIT: 'sales.credit',
  };

  const paidAmount = (r: ReceivableEntity) =>
    Math.round((r.originalAmount - r.balance) * 100) / 100;

  const referenceFor = (r: ReceivableEntity) =>
    invoiceBySaleId.get(r.saleId) ?? r.saleId.slice(0, 8);

  const filtered = search.trim()
    ? receivables.filter(
        (r) =>
          (r.customerName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          referenceFor(r).toLowerCase().includes(search.toLowerCase())
      )
    : receivables;

  const registerPay = useMutation({
    mutationFn: (payload: { id: string; amount: number; method: PayMethod }) =>
      apiSend<ReceivableEntity>(`/receivables/${payload.id}/pay`, 'POST', {
        amount: payload.amount,
        method: payload.method,
      }),
    onSuccess: () => {
      setPayFor(null);
      setPayAmount('');
      setPayMethod('CASH');
      setError(null);
      setSuccess(t('receivables.paidSuccess'));
      setTimeout(() => setSuccess(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    },
    // 409 overpay (server message) surfaces here.
    onError: (e) =>
      setError(e instanceof Error ? e.message : t('receivables.loadError')),
  });

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payFor) return;
    const amount = Number(payAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setError(t('receivables.invalidAmount'));
      return;
    }
    if (amount > payFor.balance) {
      setError(t('receivables.amountExceeds'));
      return;
    }
    registerPay.mutate({ id: payFor.id, amount, method: payMethod });
  };

  const changeStatus = (value: '' | ReceivableStatus) => {
    setStatusFilter(value);
    setPage(1);
    setExpandedId(null);
  };

  const getStatusBadge = (status: ReceivableStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {t('receivables.statusPaid')}
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-primary border border-primary/20">
            {t('receivables.statusPartial')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {t('receivables.statusOpen')}
          </span>
        );
    }
  };

  const from = receivables.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + receivables.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <HandCoins className="w-7 h-7 text-primary" /> {t('receivables.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('receivables.subtitle')}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('receivables.searchPlaceholder')}
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => changeStatus(e.target.value as '' | ReceivableStatus)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === '' ? t('receivables.filterAll') : t(`receivables.status${s[0]}${s.slice(1).toLowerCase()}`)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:underline">
            {t('receivables.closeError')}
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-500 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {success}
        </div>
      )}

      {/* List */}
      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('receivables.loading')}
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-destructive text-sm">{t('receivables.loadError')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          {receivables.length === 0 && page > 1
            ? t('receivables.emptyPage')
            : receivables.length === 0
              ? t('receivables.empty')
              : t('receivables.noSearchResults')}
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">{t('receivables.colCustomer')}</th>
                  <th className="px-5 py-3">{t('receivables.colReference')}</th>
                  <th className="px-5 py-3 text-right">{t('receivables.colTotal')}</th>
                  <th className="px-5 py-3 text-right">{t('receivables.colPaid')}</th>
                  <th className="px-5 py-3 text-right">{t('receivables.colBalance')}</th>
                  <th className="px-5 py-3 text-center">{t('receivables.colStatus')}</th>
                  <th className="px-5 py-3">{t('receivables.colCreated')}</th>
                  <th className="px-5 py-3 text-right">{t('receivables.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const isOpen = expandedId === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        onClick={() => setExpandedId(isOpen ? null : r.id)}
                        className="hover:bg-accent/40 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5 font-medium text-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">
                              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </span>
                            <span className="truncate max-w-[160px]">
                              {r.customerName ?? t('sales.anonymous')}
                            </span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-muted-foreground text-xs">
                          {referenceFor(r)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium">{fmt(r.originalAmount)}</td>
                        <td className="px-5 py-3.5 text-right text-muted-foreground">{fmt(paidAmount(r))}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {fmt(r.balance)}
                        </td>
                        <td className="px-5 py-3.5 text-center">{getStatusBadge(r.status)}</td>
                        <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap text-xs">
                          {fmtDateTime(r.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {r.balance > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPayFor(r);
                                setPayAmount('');
                                setPayMethod('CASH');
                                setError(null);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground text-xs font-medium transition-colors"
                            >
                              <HandCoins className="w-3.5 h-3.5" /> {t('receivables.payAction')}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={8} className="px-6 pb-4 pt-1 bg-muted/20 border-t border-border">
                            <div className="space-y-1.5 pt-2">
                              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Receipt className="w-3.5 h-3.5" /> {t('receivables.paymentsTitle')}
                              </p>
                              {(r.payments ?? []).length === 0 ? (
                                <p className="text-xs text-muted-foreground">{t('receivables.noPayments')}</p>
                              ) : (
                                (r.payments ?? []).map((p) => (
                                  <div
                                    key={p.id}
                                    className="flex items-center justify-between text-sm text-muted-foreground"
                                  >
                                    <span className="flex items-center gap-3">
                                      <span className="text-xs">{fmtDateTime(p.createdAt)}</span>
                                      <span className="text-xs">{t(PAYMENT_LABEL_KEYS[p.method])}</span>
                                    </span>
                                    <span className="font-mono text-foreground">{fmt(p.amount)}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {receivables.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {t('receivables.empty')}
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

      {/* Modal Record Payment */}
      {payFor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handlePay} className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">{t('receivables.payTitle')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('receivables.paySubtitle', {
                    customer: payFor.customerName ?? t('sales.anonymous'),
                    balance: fmt(payFor.balance),
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayFor(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t('receivables.closeError')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('receivables.amount')} *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('receivables.amountHint')}</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('receivables.method')} *</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PayMethod)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="CASH">{t('sales.cash')}</option>
                <option value="CARD">{t('sales.card')}</option>
                <option value="TRANSFER">{t('sales.transfer')}</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setPayFor(null)}
                className="px-4 py-2 bg-muted hover:bg-accent text-xs font-semibold rounded-lg text-foreground transition-colors"
              >
                {t('receivables.cancel')}
              </button>
              <button
                type="submit"
                disabled={registerPay.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60 shadow-xs"
              >
                {registerPay.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {registerPay.isPending ? t('receivables.paying') : t('receivables.pay')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}