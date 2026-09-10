'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  Receipt,
  User,
  Package,
  Percent,
  Banknote,
} from 'lucide-react';
import type { SaleEntity } from '../entities';
import { apiGet } from '../api';

const fmt = (n: number) =>
  `C$ ${n.toLocaleString('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function SalesHistoryView() {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: sales = [], isPending } = useQuery<SaleEntity[]>({
    queryKey: ['sales-history'],
    queryFn: () => apiGet<SaleEntity[]>(`/sales?limit=200`),
  });

  const filtered = sales.filter(
    (s) =>
      (s.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (s.customerName?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const totalRevenue = sales.reduce((a, s) => a + s.total, 0);

  const isToday = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };
  const todayCount = sales.filter((s) => isToday(String(s.createdAt))).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <History className="w-7 h-7 text-indigo-400" /> Historial de Ventas
        </h1>
        <p className="text-sm text-zinc-400">
          Todas las facturas registradas en el punto de venta: cliente, productos, total y estado.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Ventas registradas</p>
          <p className="text-2xl font-bold text-white mt-1">{sales.length}</p>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Ingresos (listado)</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Ventas de hoy</p>
          <p className="text-2xl font-bold text-indigo-400 mt-1">{todayCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por factura o cliente..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
        />
      </div>

      {/* List */}
      {isPending ? (
        <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando historial...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-sm">
          {sales.length === 0
            ? 'Aún no hay ventas registradas. Crea una desde la pestaña Ventas (POS).'
            : 'Sin resultados para tu búsqueda.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const lineCount = s.items.reduce((a, i) => a + i.quantity, 0);
            const isOpen = expandedId === s.id;
            return (
              <div
                key={s.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isOpen ? null : s.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-zinc-900/80 transition-colors"
                >
                  <span className="text-zinc-500">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white font-mono">{s.invoiceNumber}</p>
                    <p className="text-xs text-zinc-500">{fmtDateTime(String(s.createdAt))}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{s.customerName ?? 'Consumidor Final'}</span>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500">
                    <Package className="w-3.5 h-3.5" /> {lineCount} ítems
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-400">{fmt(s.total)}</span>
                </button>

                {isOpen && (
                  <div className="px-6 pb-4 pt-1 space-y-3 border-t border-zinc-800/60 bg-zinc-950/40">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3">
                      <div>
                        <p className="text-zinc-500">Cliente</p>
                        <p className="text-zinc-200 font-medium">{s.customerName ?? 'Consumidor Final'}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Subtotal</p>
                        <p className="text-zinc-200 font-medium">{fmt(s.subtotal)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 flex items-center gap-1"><Percent className="w-3 h-3" /> IVA incluido</p>
                        <p className="text-zinc-200 font-medium">{fmt(s.taxAmount)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Descuento</p>
                        <p className="text-zinc-200 font-medium">- {fmt(s.discount)}</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5" /> Productos
                      </p>
                      {s.items.map((line) => (
                        <div key={line.id} className="flex justify-between text-sm text-zinc-400">
                          <span>
                            {line.itemName} <span className="text-zinc-600">× {line.quantity}</span>
                          </span>
                          <span className="font-mono text-zinc-300">{fmt(line.price * line.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    {s.notes && (
                      <p className="text-xs text-zinc-500">
                        <span className="text-zinc-400 font-medium">Nota:</span> {s.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                      <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5" /> Total pagado
                      </span>
                      <span className="font-mono text-lg font-bold text-emerald-400">{fmt(s.total)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}