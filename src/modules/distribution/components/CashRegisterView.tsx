'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Plus, ArrowUpCircle, ArrowDownCircle, Lock, CheckCircle2, X, Clock, Loader2 } from 'lucide-react';
import type { CashSessionEntity, CashMovementEntity } from '../entities';
import { apiGet, apiSend } from '../api';

const fmt = (n: number) => `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (v?: Date | string | null) => (v ? new Date(v).toLocaleTimeString() : '');

export function CashRegisterView() {
  const queryClient = useQueryClient();
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showMovForm, setShowMovForm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [openAmount, setOpenAmount] = useState('');
  const [movType, setMovType] = useState<'IN' | 'OUT'>('IN');
  const [movAmount, setMovAmount] = useState('');
  const [movConcept, setMovConcept] = useState('');
  const [closed, setClosed] = useState<CashSessionEntity | null>(null);

  const { data: session, isPending } = useQuery<CashSessionEntity | null>({
    queryKey: ['cash-session'],
    queryFn: () => apiGet<CashSessionEntity | null>(`/cash`),
  });

  const openMutation = useMutation({
    mutationFn: (openingAmount: number) =>
      apiSend<CashSessionEntity>(`/cash`, 'POST', { openingAmount }),
    onSuccess: () => {
      setClosed(null);
      queryClient.invalidateQueries({ queryKey: ['cash-session'] });
    },
  });

  const movementMutation = useMutation({
    mutationFn: (payload: { sessionId: string; type: 'IN' | 'OUT'; amount: number; concept: string }) =>
      apiSend<CashMovementEntity>(`/cash/movements`, 'POST', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cash-session'] }),
  });

  const closeMutation = useMutation({
    mutationFn: (payload: { sessionId: string; closingAmount: number; expectedAmount: number; difference: number }) =>
      apiSend<CashSessionEntity>(`/cash/close`, 'POST', payload),
    onSuccess: (data) => {
      setClosed(data);
      queryClient.invalidateQueries({ queryKey: ['cash-session'] });
    },
  });

  const cashFromMovements = session?.movements.reduce((a, m) => m.type === 'IN' ? a + m.amount : a - m.amount, 0) ?? 0;
  const totalInRegister = (session?.openingAmount ?? 0) + cashFromMovements + (session?.salesTotal ?? 0);

  const handleOpen = () => {
    if (!openAmount) return;
    openMutation.mutate(parseFloat(openAmount));
    setShowOpenForm(false); setOpenAmount('');
  };

  const handleAddMovement = () => {
    if (!movAmount || !movConcept || !session) return;
    movementMutation.mutate({
      sessionId: session.id,
      type: movType,
      amount: parseFloat(movAmount),
      concept: movConcept,
    });
    setShowMovForm(false); setMovAmount(''); setMovConcept('');
  };

  const handleClose = () => {
    if (!session) return;
    const expected = totalInRegister;
    closeMutation.mutate({
      sessionId: session.id,
      closingAmount: expected,
      expectedAmount: expected,
      difference: 0,
    });
    setShowCloseConfirm(false);
  };

  if (isPending) {
    return (
      <div className="p-6 flex items-center justify-center py-24 text-zinc-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando caja...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Banknote className="w-7 h-7 text-cyan-400" /> Control de Caja
          </h1>
          <p className="text-sm text-zinc-400">Apertura, movimientos y cierre de caja diaria.</p>
        </div>
      </div>

      {/* Caja cerrada — mostrar botón de apertura */}
      {!session && !closed && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto">
            <Banknote className="w-8 h-8 text-zinc-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Caja Cerrada</h2>
            <p className="text-sm text-zinc-400 mt-1">No hay ninguna sesión de caja activa. Abre la caja para comenzar a operar.</p>
          </div>
          <button onClick={() => setShowOpenForm(true)} className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-6 py-3 rounded-lg transition-colors">
            <Plus className="w-5 h-5" /> Abrir Caja
          </button>
        </div>
      )}

      {/* Resumen de cierre */}
      {closed && !session && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-8 text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
          <div>
            <h2 className="text-xl font-bold text-white">¡Caja Cerrada Correctamente!</h2>
            <p className="text-sm text-zinc-400 mt-1">Cerrada a las {fmtTime(closed.closedAt)}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mt-4">
            {[
              { label: 'Monto Apertura', value: fmt(closed.openingAmount) },
              { label: 'Ventas del Día', value: fmt(closed.salesTotal ?? 0) },
              { label: 'Total en Caja', value: fmt(closed.expectedAmount ?? 0) },
            ].map((s, i) => (
              <div key={i} className="bg-zinc-900 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-xs text-zinc-400">{s.label}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setClosed(null)} className="inline-flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
            Abrir Nueva Caja
          </button>
        </div>
      )}

      {/* Caja abierta */}
      {session && (
        <>
          {/* Totales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Apertura', value: fmt(session.openingAmount), color: 'text-zinc-400' },
              { label: 'Ventas', value: fmt(session.salesTotal ?? 0), color: 'text-emerald-400' },
              { label: 'Movimientos', value: fmt(Math.abs(cashFromMovements)), color: cashFromMovements >= 0 ? 'text-blue-400' : 'text-rose-400' },
              { label: 'Total en Caja', value: fmt(totalInRegister), color: 'text-white text-xl font-bold' },
            ].map((s, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Info sesión */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-white font-medium">Sesión Activa</span>
            </div>
            <span className="text-zinc-500">Cajero: <span className="text-zinc-200">{session.employeeName}</span></span>
            <span className="text-zinc-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Apertura: <span className="text-zinc-200">{fmtTime(session.openedAt)}</span></span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setShowMovForm(true)} className="flex items-center gap-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg border border-zinc-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Registrar Movimiento
              </button>
              <button onClick={() => setShowCloseConfirm(true)} className="flex items-center gap-1.5 text-xs font-medium bg-rose-900/40 hover:bg-rose-900/70 text-rose-400 border border-rose-500/30 px-3 py-2 rounded-lg transition-colors">
                <Lock className="w-3.5 h-3.5" /> Cerrar Caja
              </button>
            </div>
          </div>

          {/* Movimientos */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-950/30">
              <h2 className="text-sm font-semibold text-white">Movimientos de Caja</h2>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {session.movements.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">No hay movimientos registrados en esta sesión.</div>
              ) : (
                session.movements.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {m.type === 'IN' ? (
                        <ArrowUpCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <ArrowDownCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm text-zinc-200 font-medium">{m.concept}</p>
                        <p className="text-xs text-zinc-500">{fmtTime(m.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${m.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {m.type === 'IN' ? '+' : '-'}{fmt(m.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal: Abrir Caja */}
      {showOpenForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Abrir Caja</h2>
              <button onClick={() => setShowOpenForm(false)}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <label className="block text-xs text-zinc-400 mb-1">Monto inicial en efectivo (C$)</label>
            <input value={openAmount} onChange={e => setOpenAmount(e.target.value)} placeholder="5000.00" type="number"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-3 text-white text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 mb-5" />
            <div className="flex gap-3">
              <button onClick={() => setShowOpenForm(false)} className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 text-sm">Cancelar</button>
              <button onClick={handleOpen} disabled={openMutation.isPending} className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm disabled:opacity-60">Abrir Caja</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Movimiento */}
      {showMovForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Registrar Movimiento</h2>
              <button onClick={() => setShowMovForm(false)}><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-zinc-700 mb-4">
              <button onClick={() => setMovType('IN')} className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${movType === 'IN' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                <ArrowUpCircle className="w-4 h-4" /> Ingreso
              </button>
              <button onClick={() => setMovType('OUT')} className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${movType === 'OUT' ? 'bg-rose-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                <ArrowDownCircle className="w-4 h-4" /> Egreso
              </button>
            </div>
            <label className="block text-xs text-zinc-400 mb-1">Concepto</label>
            <input value={movConcept} onChange={e => setMovConcept(e.target.value)} placeholder="Descripción del movimiento"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500" />
            <label className="block text-xs text-zinc-400 mb-1">Monto (C$)</label>
            <input value={movAmount} onChange={e => setMovAmount(e.target.value)} placeholder="0.00" type="number"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500" />
            <div className="flex gap-3">
              <button onClick={() => setShowMovForm(false)} className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 text-sm">Cancelar</button>
              <button onClick={handleAddMovement} disabled={movementMutation.isPending} className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm disabled:opacity-60">Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Cierre */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <Lock className="w-10 h-10 text-rose-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white text-center mb-1">¿Cerrar Caja?</h2>
            <p className="text-sm text-zinc-400 text-center mb-4">Total esperado en caja: <span className="text-white font-bold">{fmt(totalInRegister)}</span></p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseConfirm(false)} className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 text-sm">Cancelar</button>
              <button onClick={handleClose} disabled={closeMutation.isPending} className="flex-1 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm disabled:opacity-60">Confirmar Cierre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}