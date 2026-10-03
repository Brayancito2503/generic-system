'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Package, Search, Plus, AlertTriangle, TrendingUp, TrendingDown, Edit2, X, Loader2, Trash2, ClipboardCheck, History } from 'lucide-react';
import type { InventoryStockItem, InventorySort, PurchaseOrderEntity, CashSessionEntity } from '../entities';
import type { CreateInventoryItemInput } from '@/core/ports/distribution-repository.port';
import { apiGet, apiSend } from '../api';
import { isCashier, isAccountant, hasFullAccess } from '../lib/roles';
import { saleUnitSuffix } from '../lib/sale-units';
import { formatCurrency } from '../utils/currency';
import { InventoryCountView } from './InventoryCountView';
import { InventoryMovementsView } from './InventoryMovementsView';

interface ProductFormData {
  sku: string; name: string; description: string;
  cost: string; price: string; stock: string; minAlert: string;
  saleUnit: string;
}

const emptyForm: ProductFormData = { sku: '', name: '', description: '', cost: '', price: '', stock: '', minAlert: '5', saleUnit: 'UNIDAD' };

type InventoryTab = 'list' | 'count' | 'movements';

export function InventoryView({ userRole }: { userRole?: string | null }) {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();

  const { data: tenantSettingsData } = useQuery<{ settings: { currencySymbol?: string } }>({
    queryKey: ['tenant-settings'],
    queryFn: () => apiGet<{ settings: { currencySymbol?: string } }>('/settings'),
  });

  const fmt = (n: number) => formatCurrency(n, tenantSettingsData?.settings);
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  // Fase 2 Slice C: the ordering is SERVER-side (it ranks by an aggregate the
  // browser cannot compute), so the selection is part of the query key and the
  // request path — never a client-side sort of `items`.
  const [sortBy, setSortBy] = useState<InventorySort>('name');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [formError, setFormError] = useState<Error | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryStockItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Permission model — mirrors the server route guards so restricted profiles
  // never see buttons whose routes would reject them (403-noise):
  //   GET (list)                 : CASHIER, STAFF, TENANT_ADMIN, ACCOUNTANT
  //   POST (create / Alta)       : CASHIER, STAFF, TENANT_ADMIN
  //   PATCH/DELETE (edit/delete) : STAFF, TENANT_ADMIN (legacy full access)
  //   count / movements / adj.   : ACCOUNTANT, STAFF, TENANT_ADMIN
  const canCreate = !isAccountant(userRole); // unknown/loading role → visible, like hasFullAccess
  const canEditCatalog = hasFullAccess(userRole);
  // Ledger sub-views (physical count + movements/adjustments) are off the POS
  // surface: their routes are ACCOUNTANT/STAFF/TENANT_ADMIN-only.
  const canUseLedger = !isCashier(userRole);
  const [tab, setTab] = useState<InventoryTab>('list');

  const { data: items = [], isPending, isError } = useQuery<InventoryStockItem[]>({
    // Prefix-compatible with every `invalidateQueries({ queryKey: ['inventory'] })`
    // in the module, so a stock write still refreshes the list in any order.
    queryKey: ['inventory', sortBy],
    queryFn: () => apiGet<InventoryStockItem[]>(`/inventory?sort=${sortBy}`),
  });

  // There is no branch selector endpoint: the tenant's branch is derived from
  // server data (existing purchase order or open cash session), same as in the
  // purchase orders view. Stock writes cannot happen without it (400 server-side).
  // CASHIER cannot write stock and has no access to these endpoints, so the
  // fetches are skipped for the POS profile instead of producing 403 console
  // noise; branchId stays '' and no column depends on it in this view.
  // ACCOUNTANT CAN read both endpoints (their GET guards include the role), so
  // branchId keeps resolving for the ledger sub-views.
  const cashier = isCashier(userRole);
  const { data: orders = [] } = useQuery<PurchaseOrderEntity[]>({
    queryKey: ['purchase-orders'],
    queryFn: () => apiGet<PurchaseOrderEntity[]>(`/purchase-orders`),
    enabled: !cashier,
  });
  const { data: cashSession } = useQuery<CashSessionEntity | null>({
    queryKey: ['cash-session'],
    queryFn: () => apiGet<CashSessionEntity | null>(`/cash`),
    enabled: !cashier,
  });
  const branchId = orders.find((o) => o.branchId)?.branchId ?? cashSession?.branchId ?? '';

  const createMutation = useMutation({
    // The wire payload is the port's create input minus the server-derived
    // `userId`: an alta opens its own branch-scoped stock row server-side, so
    // the client cannot (and must not) name a branch here.
    mutationFn: (payload: Omit<CreateInventoryItemInput, 'userId'>) =>
      apiSend<InventoryStockItem>(`/inventory`, 'POST', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['distribution-dashboard'] });
    },
    onError: (e: Error) => setFormError(e),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<InventoryStockItem> & { branchId?: string } }) =>
      apiSend<InventoryStockItem>(`/inventory/${id}`, 'PATCH', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['distribution-dashboard'] });
    },
    onError: (e: Error) => setFormError(e),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiSend<{ ok: boolean }>(`/inventory/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['distribution-dashboard'] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const modalError: Error | null = createMutation.error ?? updateMutation.error ?? formError;

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.sku?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchLow = filterLowStock ? i.isLowStock : true;
    return matchSearch && matchLow;
  });

  const totalValue = items.reduce((a, b) => a + b.cost * b.stock, 0);
  const lowCount = items.filter(i => i.isLowStock).length;

  const handleSave = () => {
    if (!form.name || !form.price || !form.cost) return;
    // parseFloat: fractional opening stock (Fase 2) — parseInt truncated 2.5 → 2.
    const stock = parseFloat(form.stock) || 0;
    const minAlert = parseInt(form.minAlert) || 5;
    const catalog = {
      sku: form.sku, name: form.name, description: form.description,
      cost: parseFloat(form.cost), price: parseFloat(form.price),
      saleUnit: form.saleUnit as InventoryStockItem['saleUnit'],
    };
    if (editId) {
      const target = items.find((i) => i.id === editId);
      // Fase 0: stock is NOT editable here anymore — it changes only through
      // ledger movements (create sets INITIAL; receive/sale/return/adjustment/
      // count move it). minAlert stays branch-scoped: sending it without a
      // branchId is a 400 server-side, so catalog-only edits omit both.
      const minAlertChanged = !target || minAlert !== target.minAlert;
      if (minAlertChanged && !branchId) {
        setFormError(new Error(t('inventory.noBranchStockHint')));
        return;
      }
      updateMutation.mutate({
        id: editId,
        payload: minAlertChanged ? { ...catalog, minAlert, branchId } : catalog,
      });
    } else {
      createMutation.mutate({ ...catalog, stock, minAlert });
    }
    setShowForm(false); setForm(emptyForm); setEditId(null); setFormError(null);
  };

  const handleEdit = (item: InventoryStockItem) => {
    setForm({ sku: item.sku || '', name: item.name, description: item.description || '', cost: item.cost.toString(), price: item.price.toString(), stock: item.stock.toString(), minAlert: item.minAlert.toString(), saleUnit: item.saleUnit ?? 'UNIDAD' });
    setFormError(null);
    setEditId(item.id); setShowForm(true);
  };

  const openCreate = () => {
    setForm(emptyForm); setFormError(null); setEditId(null); setShowForm(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    deleteMutation.mutate(deleteTarget.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" /> {t('inventory.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('inventory.subtitle')}</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> {t('inventory.addProduct')}
          </button>
        )}
      </div>

      {/* Ledger sub-nav: hidden for CASHIER (routes are 403 for the POS) */}
      {canUseLedger && (
        <div className="flex gap-1 bg-muted/50 border border-border rounded-lg p-1 w-fit">
          {(
            [
              { key: 'list', label: t('inventory.tabList'), icon: Package },
              { key: 'count', label: t('inventory.tabCount'), icon: ClipboardCheck },
              { key: 'movements', label: t('inventory.tabMovements'), icon: History },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                tab === key
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'count' ? (
        <InventoryCountView branchId={branchId} />
      ) : tab === 'movements' ? (
        <InventoryMovementsView branchId={branchId} />
      ) : (
        <>
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('inventory.statsTotal'), value: items.length.toString(), icon: Package, color: 'text-primary' },
          { label: t('dashboard.kpiInventory'), value: isPending ? '—' : fmt(totalValue), icon: TrendingUp, color: 'text-emerald-500' },
          { label: t('dashboard.kpiAlerts'), value: lowCount.toString(), icon: AlertTriangle, color: 'text-amber-500' },
          { label: t('inventory.statsOk'), value: (items.length - lowCount).toString(), icon: TrendingDown, color: 'text-violet-500' },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-xs">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('inventory.searchPlaceholder')}
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => setFilterLowStock(v => !v)}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border transition-colors ${filterLowStock ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-card border-border text-muted-foreground hover:bg-accent'}`}
        >
          <AlertTriangle className="w-4 h-4" /> {t('inventory.lowStock')}
        </button>
        {/* Sales-velocity ordering (Fase 2 Slice C): reorders stock priorities
            by what actually sells, so the reorder list matches demand. */}
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as InventorySort)}
            aria-label={t('inventory.sortBy')}
            className="bg-card border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            <option value="name">{t('inventory.sortName')}</option>
            <option value="velocity">{t('inventory.sortVelocity')}</option>
          </select>
        </div>
      </div>

      {/* Loading / Error / Table */}
      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('sales.processing')}
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-destructive text-sm">{t('inventory.loadError')}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colSku')}</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colName')}</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colCost')}</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colPrice')}</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colMargin')}</th>
                  <th className="text-center text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colStock')}</th>
                  {sortBy === 'velocity' && (
                    <th className="text-center text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colUnitsSold30d')}</th>
                  )}
                  <th className="text-center text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colMinAlert')}</th>
                  <th className="text-center text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colStatus')}</th>
                  <th className="text-center text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(item => {
                  const margin = ((item.price - item.cost) / item.price * 100).toFixed(1);
                  const unit = saleUnitSuffix(item.saleUnit, t);
                  return (
                    <tr key={item.id} className={`hover:bg-accent/40 transition-colors ${item.isLowStock ? 'bg-amber-500/5' : ''}`}>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{item.sku}</td>
                      <td className="px-4 py-3">
                        <p className="text-foreground font-medium">{item.name}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs">{fmt(item.cost)}</td>
                      <td className="px-4 py-3 text-right text-foreground font-semibold font-mono text-xs">{fmt(item.price)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-mono text-xs">{margin}%</td>
                      <td className="px-4 py-3 text-center font-bold text-foreground">
                        {item.stock}{unit ? ` ${unit}` : ''}
                      </td>
                      {/* The ranking signal only appears in the ordering that
                          produced it: absent on the alphabetical default. */}
                      {sortBy === 'velocity' && (
                        <td className="px-4 py-3 text-center font-mono text-xs text-foreground">
                          {item.unitsSold30d ?? 0}{unit ? ` ${unit}` : ''}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center text-muted-foreground">{item.minAlert}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.isLowStock ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'}`}>
                          {item.isLowStock ? t('inventory.lowStock') : t('inventory.inStock')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEditCatalog && (
                            <>
                              <button type="button" onClick={() => handleEdit(item)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title={t('inventory.editTitle')}>
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => { setDeleteTarget(item); setDeleteError(null); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title={t('inventory.delete')}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">{t('inventory.emptySearch')}</div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* Modal de Producto */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">{editId ? t('inventory.editTitle') : t('inventory.addProduct')}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { labelKey: 'fieldSku', placeholderKey: 'placeholderSku', key: 'sku', full: false },
                { labelKey: 'fieldName', placeholderKey: 'placeholderName', key: 'name', full: true },
                { labelKey: 'fieldDescription', placeholderKey: 'placeholderDescription', key: 'description', full: true },
                { labelKey: 'fieldCost', placeholderKey: 'placeholderCost', key: 'cost', full: false },
                { labelKey: 'fieldPrice', placeholderKey: 'placeholderPrice', key: 'price', full: false },
                // Stock is only settable at CREATE (INITIAL ledger row); on
                // edit it moves exclusively through ledger movements.
                ...(editId
                  ? []
                  : [{ labelKey: 'fieldStock', placeholderKey: 'placeholderStock', key: 'stock', full: false }]),
                { labelKey: 'fieldMinAlert', placeholderKey: 'placeholderMinAlert', key: 'minAlert', full: false },
              ].map(f => (
                <div key={f.key} className={f.full ? 'col-span-2' : 'col-span-1'}>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {f.key === 'price' && form.saleUnit !== 'UNIDAD'
                      ? t('inventory.pricePerUnit', { unit: t(`saleUnits.${form.saleUnit}`) })
                      : t(`inventory.${f.labelKey}`)}
                  </label>
                  <input
                    value={(form as unknown as Record<string, string>)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={t(`inventory.${f.placeholderKey}`)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                </div>
              ))}
              {/* Per-sale unit (Fase 2 Slice B): weight items are stocked, priced
                  and ledgered in their sale unit — no conversion factor. */}
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">{t('inventory.saleUnit')}</label>
                <select
                  value={form.saleUnit}
                  onChange={e => setForm(prev => ({ ...prev, saleUnit: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                >
                  {(['UNIDAD', 'LIBRA', 'KILOGRAMO'] as const).map((u) => (
                    <option key={u} value={u}>{t(`saleUnits.${u}`)}</option>
                  ))}
                </select>
              </div>
              {form.saleUnit !== 'UNIDAD' && (
                <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {t('inventory.stockInSaleUnit', { unit: t(`saleUnits.${form.saleUnit}`) })}
                </div>
              )}
            </div>
            {editId && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {t('inventory.stockViaMovementsHint')}
              </div>
            )}
            {modalError && (
              <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {modalError.message}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors text-sm">{t('inventory.cancel')}</button>
              <button type="button" onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors text-sm shadow-xs">
                {editId ? t('inventory.saveEdit') : t('inventory.addProduct')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" /> {t('inventory.deleteTitle')}
              </h2>
              <button type="button" onClick={() => setDeleteTarget(null)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('inventory.deleteConfirm', { name: deleteTarget.name })}
            </p>
            {deleteError && (
              <div className="mb-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {deleteError}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors text-sm"
              >
                {t('inventory.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-medium transition-colors text-sm shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t('inventory.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}