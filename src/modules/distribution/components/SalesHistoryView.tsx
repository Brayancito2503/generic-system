'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  History,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Receipt,
  User,
  Package,
  Percent,
  Banknote,
} from 'lucide-react';
import type { SaleEntity, PaginatedResult, PaymentMethod } from '../entities';
import { apiGet } from '../api';

const PAGE_SIZE = 20;

const fmt = (n: number) =>
  `C$ ${n.toLocaleString('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function SalesHistoryView() {
  const t = useTranslations('distributionModule');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isPending, isError } = useQuery<PaginatedResult<SaleEntity>>({
    queryKey: ['sales-history', page],
    queryFn: () => apiGet<PaginatedResult<SaleEntity>>(`/sales?page=${page}&limit=${PAGE_SIZE}`),
  });

  const sales = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;

  const filtered = search.trim()
    ? sales.filter(
        (s) =>
          (s.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          (s.customerName?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : sales;

  const PAYMENT_LABEL_KEYS: Record<PaymentMethod, string> = {
    CASH: 'sales.cash',
    CARD: 'sales.card',
    TRANSFER: 'sales.transfer',
    CREDIT: 'sales.credit',
  };

  const from = sales.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + sales.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <History className="w-7 h-7 text-primary" /> {t('history.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('history.subtitle')}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('history.searchPlaceholder')}
          className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>

      {/* List */}
      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('sales.processing')}
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-destructive text-sm">{t('history.loadError')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          {sales.length === 0 && page > 1
            ? t('history.emptyPage')
            : sales.length === 0
              ? t('history.emptySales')
              : t('history.noSearchResults')}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map((s) => {
              const lineCount = s.items.reduce((a, i) => a + i.quantity, 0);
              const isOpen = expandedId === s.id;
              return (
                <div
                  key={s.id}
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : s.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-muted-foreground">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground font-mono">{s.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(s.createdAt)}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{s.customerName ?? t('sales.anonymous')}</span>
                    </div>
                    <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Package className="w-3.5 h-3.5" /> {t('history.items', { count: lineCount })}
                    </div>
                    <span className="hidden lg:inline-flex text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {t(PAYMENT_LABEL_KEYS[s.paymentMethod])}
                    </span>
                    {s.balance > 0 && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {t('sales.balanceDue')}: {fmt(s.balance)}
                      </span>
                    )}
                    <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmt(s.total)}</span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-4 pt-1 space-y-3 border-t border-border bg-muted/20">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-3">
                        <div>
                          <p className="text-muted-foreground">{t('history.customer')}</p>
                          <p className="text-foreground font-medium">{s.customerName ?? t('sales.anonymous')}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t('sales.subtotal')}</p>
                          <p className="text-foreground font-medium">{fmt(s.subtotal)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1"><Percent className="w-3 h-3" /> {t('history.vatIncluded')}</p>
                          <p className="text-foreground font-medium">{fmt(s.taxAmount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t('history.discount')}</p>
                          <p className="text-foreground font-medium">- {fmt(s.discount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t('history.colPayment')}</p>
                          <p className="text-foreground font-medium">
                            {t(PAYMENT_LABEL_KEYS[s.paymentMethod])} · {fmt(s.paidAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t('history.colBalance')}</p>
                          <p className="text-foreground font-medium">
                            {s.balance > 0 ? fmt(s.balance) : t('history.paidInFull')}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5" /> {t('history.products')}
                        </p>
                        {s.items.map((line) => (
                          <div key={line.id} className="flex justify-between text-sm text-muted-foreground">
                            <span>
                              {line.itemName} <span className="text-muted-foreground/70">× {line.quantity}</span>
                            </span>
                            <span className="font-mono text-foreground">{fmt(line.price * line.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      {s.notes && (
                        <p className="text-xs text-muted-foreground">
                          <span className="text-foreground font-medium">{t('history.note')}:</span> {s.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Banknote className="w-3.5 h-3.5" /> {t('history.total')}
                        </span>
                        <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmt(s.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
          {hasMore && (
            <p className="text-center text-xs text-muted-foreground">{t('paginator.hasMore')}</p>
          )}
        </>
      )}
    </div>
  );
}