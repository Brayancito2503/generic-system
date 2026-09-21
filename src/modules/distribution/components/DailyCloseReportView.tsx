'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  Banknote,
  CreditCard,
  FileText,
  HandCoins,
  Loader2,
  Printer,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { DailyCloseReport, PaymentMethod } from '../entities';
import { apiGet } from '../api';
import { formatCurrency } from '../utils/currency';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fmtDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('es-NI', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-NI', {
    hour: '2-digit',
    minute: '2-digit',
  });

const PAYMENT_LABEL_KEYS: Record<PaymentMethod, string> = {
  CASH: 'sales.cash',
  CARD: 'sales.card',
  TRANSFER: 'sales.transfer',
  CREDIT: 'sales.credit',
};

export function DailyCloseReportView() {
  const t = useTranslations('distributionModule');

  const { data: tenantSettingsData } = useQuery<{ settings: { currencySymbol?: string } }>({
    queryKey: ['tenant-settings'],
    queryFn: () => apiGet<{ settings: { currencySymbol?: string } }>('/settings'),
  });

  const fmt = (n: number) => formatCurrency(n, tenantSettingsData?.settings);

  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const dateValid = DATE_RE.test(date);

  const { data: report, isPending, isError } = useQuery<DailyCloseReport>({
    queryKey: ['daily-close', date],
    queryFn: () => apiGet<DailyCloseReport>(`/reports/daily-close?date=${date}`),
    enabled: dateValid,
  });

  const methodLabel = (method: string) => {
    const key = PAYMENT_LABEL_KEYS[method as PaymentMethod];
    return key ? t(key) : method;
  };

  const totals = report?.totals;

  return (
    <div className="space-y-6">
      {/* Report controls: date picker + print. Never printed. */}
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" /> {t('reports.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground block mb-1">
              {t('reports.dateLabel')}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" /> {t('reports.print')}
          </button>
        </div>
      </div>

      {/* Printable report body: only this subtree survives the @media print block. */}
      <div id="daily-close-print" className="space-y-6">
        {!dateValid ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            {t('reports.empty')}
          </div>
        ) : isPending ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> {t('reports.loading')}
          </div>
        ) : isError || !report ? (
          <div className="py-16 text-center text-destructive text-sm flex items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5" /> {t('reports.error')}
          </div>
        ) : report.lines.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            {t('reports.empty')}
          </div>
        ) : (
          <>
            {/* Print-only header (invisible on screen) */}
            <div className="print-only flex items-baseline justify-between pb-2 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">
                {t('reports.title')}
              </h2>
              <span className="text-sm text-muted-foreground">
                {fmtDate(report.date)}
              </span>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5" /> {t('reports.totalSales')}
                </p>
                <p className="text-xl font-bold mt-1">{fmt(totals!.revenue)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" /> {t('reports.totalCost')}
                </p>
                <p className="text-xl font-bold mt-1">{fmt(totals!.cost)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> {t('reports.grossMargin')}
                </p>
                <p
                  className={`text-xl font-bold mt-1 ${
                    totals!.margin >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {fmt(totals!.margin)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <HandCoins className="w-3.5 h-3.5" /> {t('reports.collectionsTotal')}
                </p>
                <p className="text-xl font-bold mt-1">
                  {fmt(report.collectionsTotal)}
                </p>
              </div>
            </div>

            {/* Sales lines table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-sm text-foreground">
                <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">{t('reports.product')}</th>
                    <th className="px-5 py-3">{t('reports.uom')}</th>
                    <th className="px-5 py-3 text-right">{t('reports.quantity')}</th>
                    <th className="px-5 py-3 text-right">{t('reports.costUnit')}</th>
                    <th className="px-5 py-3 text-right">{t('reports.priceUnit')}</th>
                    <th className="px-5 py-3 text-right">{t('reports.lineCost')}</th>
                    <th className="px-5 py-3 text-right">{t('reports.lineRevenue')}</th>
                    <th className="px-5 py-3 text-right">{t('reports.margin')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.lines.map((l) => (
                    <tr key={l.itemName} className="hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3 font-medium">{l.itemName}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {l.uom ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-right">{l.quantity}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {fmt(l.costUnit)}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {fmt(l.priceUnit)}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {fmt(l.lineCost)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium">
                        {fmt(l.lineRevenue)}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          l.margin >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {fmt(l.margin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/40 border-t border-border">
                  <tr className="font-bold text-foreground">
                    <td className="px-5 py-3" colSpan={3}>
                      {t('reports.totals')}
                    </td>
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3 text-right">{fmt(totals!.cost)}</td>
                    <td className="px-5 py-3 text-right">{fmt(totals!.revenue)}</td>
                    <td
                      className={`px-5 py-3 text-right ${
                        totals!.margin >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {fmt(totals!.margin)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment method breakdown */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-primary" />{' '}
                {t('reports.paymentsTitle')}
              </h3>
              {report.paymentBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('reports.empty')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {report.paymentBreakdown.map((p) => (
                    <span
                      key={p.method}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border text-xs font-medium"
                    >
                      {methodLabel(p.method)}
                      <span className="font-mono font-semibold">{fmt(p.total)}</span>
                      <span className="text-muted-foreground">({p.count})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Credit collections of the day */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <HandCoins className="w-4 h-4 text-primary" />{' '}
                  {t('reports.collectionsTitle')}
                </h3>
              </div>
              <table className="w-full text-left text-sm text-foreground">
                <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">{t('reports.customer')}</th>
                    <th className="px-5 py-3">{t('reports.method')}</th>
                    <th className="px-5 py-3 text-right">{t('reports.amount')}</th>
                    <th className="px-5 py-3">{t('reports.time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.collections.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-8 text-center text-muted-foreground text-sm"
                      >
                        {t('reports.empty')}
                      </td>
                    </tr>
                  ) : (
                    report.collections.map((c, idx) => (
                      <tr key={`${c.createdAt}-${idx}`}>
                        <td className="px-5 py-3 font-medium">{c.customerName}</td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {methodLabel(c.method)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold">
                          {fmt(c.amount)}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {fmtTime(c.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}