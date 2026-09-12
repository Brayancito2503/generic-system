'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Package, Search, Plus, AlertTriangle, TrendingUp, TrendingDown, Edit2, X, Loader2 } from 'lucide-react';
import type { InventoryStockItem } from '../entities';
import { apiGet, apiSend } from '../api';

const fmt = (n: number) => `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ProductFormData {
  sku: string; name: string; description: string;
  cost: string; price: string; stock: string; minAlert: string;
}

const emptyForm: ProductFormData = { sku: '', name: '', description: '', cost: '', price: '', stock: '', minAlert: '5' };

export function InventoryView() {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: items = [], isPending, isError } = useQuery<InventoryStockItem[]>({
    queryKey: ['inventory'],
    queryFn: () => apiGet<InventoryStockItem[]>(`/inventory`),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Omit<InventoryStockItem, 'id' | 'tenantId' | 'isLowStock'>) =>
      apiSend<InventoryStockItem>(`/inventory`, 'POST', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<InventoryStockItem> }) =>
      apiSend<InventoryStockItem>(`/inventory/${id}`, 'PATCH', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const mutationError: Error | null = createMutation.error ?? updateMutation.error;

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
    const payload = {
      sku: form.sku, name: form.name, description: form.description,
      cost: parseFloat(form.cost), price: parseFloat(form.price),
      stock: parseInt(form.stock) || 0,
      minAlert: parseInt(form.minAlert) || 5,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, payload });
    } else {
      createMutation.mutate(payload);
    }
    setShowForm(false); setForm(emptyForm); setEditId(null);
  };

  const handleEdit = (item: InventoryStockItem) => {
    setForm({ sku: item.sku || '', name: item.name, description: item.description || '', cost: item.cost.toString(), price: item.price.toString(), stock: item.stock.toString(), minAlert: item.minAlert.toString() });
    setEditId(item.id); setShowForm(true);
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
        <button
          type="button"
          onClick={() => { setShowForm(true); setForm(emptyForm); setEditId(null); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" /> {t('inventory.addProduct')}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Productos', value: items.length.toString(), icon: Package, color: 'text-primary' },
          { label: t('dashboard.kpiInventory'), value: isPending ? '—' : fmt(totalValue), icon: TrendingUp, color: 'text-emerald-500' },
          { label: t('dashboard.kpiAlerts'), value: lowCount.toString(), icon: AlertTriangle, color: 'text-amber-500' },
          { label: 'Productos OK', value: (items.length - lowCount).toString(), icon: TrendingDown, color: 'text-violet-500' },
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
      </div>

      {/* Loading / Error / Table */}
      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('sales.processing')}
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-destructive text-sm">Error al cargar el inventario.</div>
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
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">Margen</th>
                  <th className="text-center text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colStock')}</th>
                  <th className="text-center text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colMinAlert')}</th>
                  <th className="text-center text-xs text-muted-foreground font-medium px-4 py-3">{t('inventory.colStatus')}</th>
                  <th className="text-center text-xs text-muted-foreground font-medium px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(item => {
                  const margin = ((item.price - item.cost) / item.price * 100).toFixed(1);
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
                      <td className="px-4 py-3 text-center font-bold text-foreground">{item.stock}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{item.minAlert}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.isLowStock ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'}`}>
                          {item.isLowStock ? t('inventory.lowStock') : t('inventory.inStock')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button type="button" onClick={() => handleEdit(item)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No se encontraron productos.</div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Producto */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">{editId ? 'Editar Producto' : t('inventory.addProduct')}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'SKU', key: 'sku', placeholder: 'ACE-001', full: false },
                { label: 'Nombre del Producto *', key: 'name', placeholder: 'Aceite Corona 1L', full: true },
                { label: 'Descripción', key: 'description', placeholder: 'Caja x 24 unidades', full: true },
                { label: 'Costo (C$) *', key: 'cost', placeholder: '0.00', full: false },
                { label: 'Precio Venta (C$) *', key: 'price', placeholder: '0.00', full: false },
                { label: 'Stock Actual', key: 'stock', placeholder: '0', full: false },
                { label: 'Stock Mínimo', key: 'minAlert', placeholder: '5', full: false },
              ].map(f => (
                <div key={f.key} className={f.full ? 'col-span-2' : 'col-span-1'}>
                  <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
                  <input
                    value={(form as unknown as Record<string, string>)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                </div>
              ))}
            </div>
            {mutationError && (
              <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {mutationError.message}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors text-sm">Cancelar</button>
              <button type="button" onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors text-sm shadow-xs">
                {editId ? 'Guardar Cambios' : t('inventory.addProduct')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}