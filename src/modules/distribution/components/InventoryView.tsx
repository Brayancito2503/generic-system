'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-7 h-7 text-blue-400" /> Inventario de Productos
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Gestión de stock, precios y alertas de reabastecimiento.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm(emptyForm); setEditId(null); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo Producto
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Productos', value: items.length.toString(), icon: Package, color: 'text-blue-400' },
          { label: 'Valor de Inventario', value: isPending ? '—' : fmt(totalValue), icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Stock Bajo Mínimo', value: lowCount.toString(), icon: AlertTriangle, color: 'text-amber-400' },
          { label: 'Productos OK', value: (items.length - lowCount).toString(), icon: TrendingDown, color: 'text-violet-400' },
        ].map((s, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => setFilterLowStock(v => !v)}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border transition-colors ${filterLowStock ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Solo stock bajo
        </button>
      </div>

      {/* Loading / Error / Table */}
      {isPending ? (
        <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando inventario...
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-rose-400 text-sm">Error al cargar el inventario.</div>
      ) : (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/50">
                  <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">SKU</th>
                  <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Producto</th>
                  <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Costo</th>
                  <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Precio</th>
                  <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Margen</th>
                  <th className="text-center text-xs text-zinc-500 font-medium px-4 py-3">Stock</th>
                  <th className="text-center text-xs text-zinc-500 font-medium px-4 py-3">Mín.</th>
                  <th className="text-center text-xs text-zinc-500 font-medium px-4 py-3">Estado</th>
                  <th className="text-center text-xs text-zinc-500 font-medium px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map(item => {
                  const margin = ((item.price - item.cost) / item.price * 100).toFixed(1);
                  return (
                    <tr key={item.id} className={`hover:bg-zinc-800/30 transition-colors ${item.isLowStock ? 'bg-amber-950/10' : ''}`}>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{item.sku}</td>
                      <td className="px-4 py-3">
                        <p className="text-zinc-200 font-medium">{item.name}</p>
                        {item.description && <p className="text-xs text-zinc-500">{item.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">{fmt(item.cost)}</td>
                      <td className="px-4 py-3 text-right text-white font-semibold font-mono text-xs">{fmt(item.price)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-mono text-xs">{margin}%</td>
                      <td className="px-4 py-3 text-center font-bold text-white">{item.stock}</td>
                      <td className="px-4 py-3 text-center text-zinc-500">{item.minAlert}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.isLowStock ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                          {item.isLowStock ? '⚠ Bajo' : '✓ OK'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-zinc-500 text-sm">No se encontraron productos.</div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Producto */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{editId ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><X className="w-5 h-5" /></button>
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
                  <label className="block text-xs text-zinc-400 mb-1">{f.label}</label>
                  <input
                    value={(form as unknown as Record<string, string>)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
            {mutationError && (
              <div className="mt-4 flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {mutationError.message}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-600 transition-colors text-sm">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors text-sm">
                {editId ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}