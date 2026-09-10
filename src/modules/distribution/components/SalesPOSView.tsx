'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Loader2,
  Package,
  Banknote,
  CheckCircle2,
  User,
} from 'lucide-react';
import type { InventoryStockItem, CustomerLight, SaleEntity, TaxRateEntity } from '../entities';
import { apiGet, apiSend } from '../api';

const fmt = (n: number) => `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface CartLine {
  itemId: string;
  name: string;
  sku?: string | null;
  price: number;
  stock: number;
  quantity: number;
}

export function SalesPOSView({ tenantId = 'distribuidora-demo' }: { tenantId?: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountInput, setDiscountInput] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState<SaleEntity | null>(null);

  const { data: items = [], isPending } = useQuery<InventoryStockItem[]>({
    queryKey: ['inventory', tenantId],
    queryFn: () => apiGet<InventoryStockItem[]>(`/inventory?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: customers = [] } = useQuery<CustomerLight[]>({
    queryKey: ['customers', tenantId, customerQuery],
    queryFn: () => apiGet<CustomerLight[]>(`/customers?tenantId=${tenantId}&q=${encodeURIComponent(customerQuery)}`),
    enabled: !!tenantId,
  });

  const { data: taxRates = [] } = useQuery<TaxRateEntity[]>({
    queryKey: ['tax-rates', tenantId],
    queryFn: () => apiGet<TaxRateEntity[]>(`/tax?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const registerSale = useMutation({
    mutationFn: (payload: { lines: { itemId: string; quantity: number }[]; discount: number; personId: string | null; notes: string }) =>
      apiSend<SaleEntity>(`/sales?tenantId=${tenantId}`, 'POST', payload),
    onSuccess: (data) => {
      setSuccess(data);
      setCart([]);
      setDiscountInput('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['inventory', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cash-session', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['distribution-dashboard', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tax-summary', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['sales-history', tenantId] });
    },
  });

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.sku?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const addToCart = (item: InventoryStockItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        if (existing.quantity >= item.stock) return prev;
        return prev.map((c) =>
          c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { itemId: item.id, name: item.name, sku: item.sku, price: item.price, stock: item.stock, quantity: 1 }];
    });
  };

  const changeQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.itemId !== itemId) return c;
          const next = c.quantity + delta;
          if (next < 1) return c;
          return { ...c, quantity: Math.min(next, c.stock) };
        })
        .filter((c) => c.quantity > 0)
    );
  };

  const removeLine = (itemId: string) => setCart((prev) => prev.filter((c) => c.itemId !== itemId));

  const subtotal = cart.reduce((a, c) => a + c.price * c.quantity, 0);
  const discount = Math.min(Math.max(parseFloat(discountInput) || 0, 0), subtotal);
  const total = subtotal - discount;

  const defaultTaxRate = taxRates.find((t) => t.isDefault) ?? taxRates[0] ?? null;
  const ratePct = defaultTaxRate?.rate ?? 0;
  const ivaAmount = ratePct > 0 ? ((subtotal - discount) * ratePct) / (100 + ratePct) : 0;

  const canCheckout = cart.length > 0 && !registerSale.isPending;

  const handleCheckout = () => {
    if (!canCheckout) return;
    registerSale.mutate({
      lines: cart.map((c) => ({ itemId: c.itemId, quantity: c.quantity })),
      discount,
      personId: customerId || null,
      notes,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-emerald-400" /> Punto de Venta (POS)
          </h1>
          <p className="text-sm text-zinc-400">
            Registra ventas y el stock se descuenta automáticamente. Requiere caja abierta.
          </p>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-300">Venta registrada {success.invoiceNumber}</p>
            <p className="text-emerald-400/80">Total: {fmt(success.total)} — el inventario fue actualizado.</p>
          </div>
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400/70 hover:text-white text-xs">Cerrar</button>
        </div>
      )}

      {registerSale.isError && (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm">
          {registerSale.error?.message ?? 'Error al registrar la venta'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Productos */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto por nombre o SKU..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>

          {isPending ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando productos...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  disabled={item.stock <= 0}
                  className={`group text-left bg-zinc-900/80 border rounded-xl p-4 transition-all ${item.stock <= 0 ? 'border-zinc-800 opacity-50 cursor-not-allowed' : 'border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      {item.sku && <p className="text-xs text-zinc-500 font-mono">{item.sku}</p>}
                    </div>
                    <Package className="w-4 h-4 text-zinc-600 shrink-0" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-base font-bold text-emerald-400">{fmt(item.price)}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.isLowStock ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      Stock: {item.stock}
                    </span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-full text-center py-10 text-zinc-500 text-sm">Sin resultados.</p>
              )}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="lg:col-span-5 bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-4 sticky top-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" /> Ticket de Venta
            </h2>
            <span className="text-xs text-zinc-500">{cart.reduce((a, c) => a + c.quantity, 0)} ítems</span>
          </div>

          {cart.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-sm">
              Selecciona productos para agregarlos al ticket.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60 max-h-72 overflow-y-auto">
              {cart.map((c) => (
                <div key={c.itemId} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 font-medium truncate">{c.name}</p>
                    <p className="text-xs text-zinc-500">{fmt(c.price)} × {c.quantity} = <span className="text-zinc-300 font-semibold">{fmt(c.price * c.quantity)}</span></p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(c.itemId, -1)} className="p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300"><Minus className="w-3 h-3" /></button>
                    <span className="w-6 text-center text-sm font-semibold text-white">{c.quantity}</span>
                    <button
                      onClick={() => changeQty(c.itemId, 1)}
                      disabled={c.quantity >= c.stock}
                      className="p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button onClick={() => removeLine(c.itemId)} className="p-1 rounded-md hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Cliente opcional */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <User className="w-3.5 h-3.5" /> Cliente (opcional)
            </label>
            <input
              value={customerQuery}
              onChange={(e) => { setCustomerQuery(e.target.value); setCustomerId(''); }}
              placeholder="Buscar cliente..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
            />
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Consumidor Final</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}{c.documentId ? ` — ${c.documentId}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Descuento y notas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Descuento (C$)</label>
              <input
                type="number"
                min="0"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Nota</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Totales */}
          <div className="space-y-1.5 border-t border-zinc-800 pt-3 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span className="font-medium text-zinc-200">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-500/90">
              <span>IVA ({ratePct}% incluido)</span>
              <span>{fmt(ivaAmount)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Descuento</span>
                <span>- {fmt(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-bold text-lg pt-1">
              <span>Total a cobrar</span>
              <span>{fmt(total)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={!canCheckout}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {registerSale.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
            ) : (
              <><Banknote className="w-4 h-4" /> Cobrar {fmt(total)}</>
            )}
          </button>
          <p className="text-[11px] text-zinc-600 text-center">
            Requiere una sesión de caja abierta. Precios incluyen IVA (información contable).
          </p>
        </div>
      </div>
    </div>
  );
}