'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Loader2,
} from 'lucide-react';
import type { InventoryAdjustmentEntity, InventoryStockItem } from '../entities';
import { apiGet, apiSend } from '../api';

export interface CountResult {
  created: InventoryAdjustmentEntity[];
  warning: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Physical-count batch: the operator enters the counted quantity per item
 * (pre-filled with the book stock) and only nonzero diffs are submitted; the
 * server posts SOBRANTE/MERMA adjustments atomically. ACCOUNTANT/TENANT_ADMIN
 * only — mounted by InventoryView for non-CASHIER profiles.
 */
export function InventoryCountView({ branchId }: { branchId?: string }) {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();

  const [counted, setCounted] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{
    kind: 'ok' | 'warn' | 'err';
    text: string;
  } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const {
    data: items = [],
    isPending,
    isError,
  } = useQuery<InventoryStockItem[]>({
    queryKey: ['inventory'],
    queryFn: () => apiGet<InventoryStockItem[]>(`/inventory`),
  });

  // Per-item computed row: counted = user input (defaults to book stock),
  // diff = counted − book, both rounded to cents like the repository.
  const rows = items.map((item) => {
    const raw = counted[item.id] ?? String(item.stock);
    const countedQty = raw === '' ? NaN : parseFloat(raw);
    const diff =
      Number.isFinite(countedQty) ? round2(countedQty - item.stock) : NaN;
    return { item, countedQty, diff, valid: Number.isFinite(countedQty) };
  });
  const diffs = rows.filter((r) => r.valid && r.diff !== 0);
  const hasNegative = rows.some((r) => r.valid && r.countedQty < 0);

  const countMutation = useMutation({
    mutationFn: (payload: {
      branchId: string;
      items: { itemId: string; countedQuantity: number }[];
    }) => apiSend<CountResult>(`/inventory/count`, 'POST', payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['distribution-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['daily-close'] });
      setMessage({
        kind: result.warning ? 'warn' : 'ok',
        text: result.warning
          ? t('inventory.countNoDiffs')
          : t('inventory.countSuccess', { n: result.created.length }),
      });
      setCounted({});
    },
    onError: (e: Error) => setMessage({ kind: 'err', text: e.message }),
  });

  const submit = () => {
    setInputError(null);
    if (hasNegative) {
      setInputError(t('inventory.countError'));
      return;
    }
    if (!branchId) {
      setMessage({ kind: 'err', text: t('inventory.noBranchStockHint') });
      return;
    }
    if (diffs.length === 0) {
      setMessage({ kind: 'warn', text: t('inventory.countNoDiffs') });
      return;
    }
    setMessage(null);
    countMutation.mutate({
      branchId,
      items: diffs.map((d) => ({
        itemId: d.item.id,
        countedQuantity: d.countedQty,
      })),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" /> {t('inventory.countTitle')}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('inventory.countSubtitle')}
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
            message.kind === 'err'
              ? 'text-destructive bg-destructive/10 border border-destructive/30'
              : message.kind === 'warn'
                ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30'
                : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
          }`}
        >
          {message.kind === 'err' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : message.kind === 'warn' ? (
            <Info className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('sales.processing')}
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-destructive text-sm">
          {t('inventory.countLoadError')}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colSku')}</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colName')}</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colStock')}</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.countColCounted')}</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.countColDiff')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ item, diff, valid }) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      valid && diff !== 0 ? 'bg-amber-500/5' : 'hover:bg-accent/40'
                    }`}
                  >
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium">{item.name}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {item.stock}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={counted[item.id] ?? ''}
                        onChange={(e) =>
                          setCounted((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="w-28 text-right bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {valid ? (
                        <span
                          className={`font-mono font-semibold ${
                            diff > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : diff < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {diff > 0 ? '+' : ''}
                          {diff}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {t('inventory.emptySearch')}
              </div>
            )}
          </div>
        </div>
      )}

      {inputError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {inputError}
        </div>
      )}

      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={countMutation.isPending || hasNegative}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shadow-xs disabled:opacity-50"
        >
          {countMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          {countMutation.isPending
            ? t('inventory.countSaving')
            : t('inventory.countSubmit')}
        </button>
      </div>
    </div>
  );
}