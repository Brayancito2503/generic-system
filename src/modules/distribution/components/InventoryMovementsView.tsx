'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import type {
  InventoryAdjustmentEntity,
  InventoryAdjustmentReason,
  InventoryMovementEntity,
  InventoryMovementType,
  InventoryStockItem,
} from '../entities';
import { apiGet, apiSend } from '../api';
import { formatCurrency } from '../utils/currency';

const TYPE_LABEL_KEYS: Record<InventoryMovementType, string> = {
  INITIAL: 'inventory.movementsTypeINITIAL',
  RECEIVE: 'inventory.movementsTypeRECEIVE',
  SALE: 'inventory.movementsTypeSALE',
  RETURN: 'inventory.movementsTypeRETURN',
  ADJUSTMENT: 'inventory.movementsTypeADJUSTMENT',
  TRANSFER_OUT: 'inventory.movementsTypeTRANSFER_OUT',
  TRANSFER_IN: 'inventory.movementsTypeTRANSFER_IN',
};

const REASON_LABEL_KEYS: Record<InventoryAdjustmentReason, string> = {
  MERMA: 'inventory.reasonMERMA',
  ROTURA: 'inventory.reasonROTURA',
  VENCIMIENTO: 'inventory.reasonVENCIMIENTO',
  DESCUADRE: 'inventory.reasonDESCUADRE',
  SOBRANTE: 'inventory.reasonSOBRANTE',
};

const ALL_TYPES: InventoryMovementType[] = [
  'INITIAL',
  'RECEIVE',
  'SALE',
  'RETURN',
  'ADJUSTMENT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
];

const ALL_REASONS: InventoryAdjustmentReason[] = [
  'MERMA',
  'ROTURA',
  'VENCIMIENTO',
  'DESCUADRE',
  'SOBRANTE',
];

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-NI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Signed quantity chip: green for ins/corrections, red for outs/losses. */
function QtyCell({ quantity }: { quantity: number }) {
  const negative = quantity < 0;
  return (
    <span
      className={`font-mono font-semibold ${
        negative
          ? 'text-red-600 dark:text-red-400'
          : 'text-emerald-600 dark:text-emerald-400'
      }`}
    >
      {negative ? '' : '+'}
      {quantity}
    </span>
  );
}

/**
 * Kardex ledger: immutable movement history + manual adjustments. The routes
 * are ACCOUNTANT/STAFF/TENANT_ADMIN-only (cost snapshots stay off the POS
 * surface); this view is only mounted for those profiles by InventoryView.
 */
export function InventoryMovementsView({ branchId }: { branchId?: string }) {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();

  const { data: tenantSettingsData } = useQuery<{ settings: { currencySymbol?: string } }>({
    queryKey: ['tenant-settings'],
    queryFn: () => apiGet<{ settings: { currencySymbol?: string } }>('/settings'),
  });
  const fmt = (n: number) => formatCurrency(n, tenantSettingsData?.settings);

  const [type, setType] = useState('');
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjItemId, setAdjItemId] = useState('');
  const [adjReason, setAdjReason] = useState<InventoryAdjustmentReason>('MERMA');
  const [adjQty, setAdjQty] = useState('');
  const [adjNotes, setAdjNotes] = useState('');
  const [adjError, setAdjError] = useState<Error | null>(null);

  const params = new URLSearchParams();
  if (branchId) params.set('branchId', branchId);
  if (type) params.set('type', type);
  if (reason) params.set('reason', reason);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();

  const {
    data: movements = [],
    isPending,
    isError,
  } = useQuery<InventoryMovementEntity[]>({
    queryKey: ['inventory-movements', qs],
    queryFn: () =>
      apiGet<InventoryMovementEntity[]>(
        `/inventory/movements${qs ? `?${qs}` : ''}`
      ),
  });

  // Item catalog feeds the manual-adjustment dialog (item selector + current
  // stock reference). Same endpoint as the list tab.
  const { data: items = [] } = useQuery<InventoryStockItem[]>({
    queryKey: ['inventory'],
    queryFn: () => apiGet<InventoryStockItem[]>(`/inventory`),
  });

  const addMutation = useMutation({
    mutationFn: (payload: {
      branchId: string;
      itemId: string;
      quantity: number;
      reason: InventoryAdjustmentReason;
      notes?: string;
    }) => apiSend<InventoryAdjustmentEntity>(`/inventory/adjustments`, 'POST', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['distribution-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['daily-close'] });
      setShowAdjust(false);
      setAdjItemId('');
      setAdjReason('MERMA');
      setAdjQty('');
      setAdjNotes('');
      setAdjError(null);
    },
    onError: (e: Error) => setAdjError(e),
  });

  const submitAdjust = () => {
    const quantity = parseFloat(adjQty);
    if (!adjItemId || !Number.isFinite(quantity) || quantity === 0) {
      setAdjError(new Error(t('inventory.adjError')));
      return;
    }
    if (!branchId) {
      setAdjError(new Error(t('inventory.noBranchStockHint')));
      return;
    }
    addMutation.mutate({
      branchId,
      itemId: adjItemId,
      quantity,
      reason: adjReason,
      notes: adjNotes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header + trigger */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> {t('inventory.movementsTitle')}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('inventory.movementsSubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdjError(null);
            setAdjItemId(items[0]?.id ?? '');
            setShowAdjust(true);
          }}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" /> {t('inventory.adjTitle')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">{t('inventory.movementsFilterType')}: {t('inventory.allCategories')}</option>
          {ALL_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(TYPE_LABEL_KEYS[ty])}
            </option>
          ))}
        </select>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">{t('inventory.movementsFilterReason')}: {t('inventory.allCategories')}</option>
          {ALL_REASONS.map((r) => (
            <option key={r} value={r}>
              {t(REASON_LABEL_KEYS[r])}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label={t('inventory.movementsFilterFrom')}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label={t('inventory.movementsFilterTo')}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Movements table */}
      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('sales.processing')}
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-destructive text-sm">
          {t('inventory.movementsLoadError')}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.movementsColDate')}</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.movementsColItem')}</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.movementsColType')}</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.movementsColQty')}</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.movementsColUnitCost')}</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.movementsColOperator')}</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.movementsColNotes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {fmtDateTime(m.createdAt.toISOString?.() ?? String(m.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium">{m.itemName ?? m.itemId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs font-semibold px-2 py-1 rounded-full border ${
                          m.type === 'ADJUSTMENT'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : m.type === 'SALE'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {t(TYPE_LABEL_KEYS[m.type])}
                        {m.reason ? ` · ${t(REASON_LABEL_KEYS[m.reason])}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <QtyCell quantity={m.quantity} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs">
                      {fmt(m.costSnapshot)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {m.userName ?? m.userId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[220px] truncate">
                      {m.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {t('inventory.movementsEmpty')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual adjustment dialog */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> {t('inventory.adjTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setShowAdjust(false)}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">{t('inventory.fieldName')}</label>
                <select
                  value={adjItemId}
                  onChange={(e) => setAdjItemId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                >
                  <option value="" disabled>
                    —
                  </option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({t('inventory.movementsColQty')}: {i.stock})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('inventory.adjFieldReason')}</label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value as InventoryAdjustmentReason)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                >
                  {ALL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {t(REASON_LABEL_KEYS[r])}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('inventory.adjFieldQty')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">{t('inventory.adjFieldNotes')}</label>
                <input
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            </div>
            {adjError && (
              <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {adjError.message}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowAdjust(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors text-sm"
              >
                {t('inventory.adjCancel')}
              </button>
              <button
                type="button"
                onClick={submitAdjust}
                disabled={addMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors text-sm shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {t('inventory.adjSubmit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}