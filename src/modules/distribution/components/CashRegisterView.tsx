'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Banknote, Plus, ArrowUpCircle, ArrowDownCircle, Lock, CheckCircle2, X, Clock, Loader2, AlertCircle } from 'lucide-react';
import type { CashSessionEntity, CashMovementEntity } from '../entities';
import { apiGet, apiSend } from '../api';

const fmt = (n: number) => `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (v?: Date | string | null) => (v ? new Date(v).toLocaleTimeString() : '');

export function CashRegisterView() {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showMovForm, setShowMovForm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [openAmount, setOpenAmount] = useState('');
  const [movType, setMovType] = useState<'IN' | 'OUT'>('IN');
  const [movAmount, setMovAmount] = useState('');
  const [movConcept, setMovConcept] = useState('');
  const [physicalCount, setPhysicalCount] = useState('');
  const [cashError, setCashError] = useState<string | null>(null);
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
      setCashError(null);
      queryClient.invalidateQueries({ queryKey: ['cash-session'] });
    },
    // POST /cash answers 409 when a session is already open; surface the
    // server message (indicates the open-session conflict) instead of hiding it.
    onError: (e) => setCashError(e instanceof Error ? e.message : 'Error al abrir la caja'),
  });

  const movementMutation = useMutation({
    mutationFn: (payload: { sessionId: string; type: 'IN' | 'OUT'; amount: number; concept: string }) =>
      apiSend<CashMovementEntity>(`/cash/movements`, 'POST', payload),
    onSuccess: () => {
      setCashError(null);
      queryClient.invalidateQueries({ queryKey: ['cash-session'] });
    },
    onError: (e) => setCashError(e instanceof Error ? e.message : 'Error al registrar el movimiento'),
  });

  const closeMutation = useMutation({
    // Server-side close: only the physical count is sent; expected amount and
    // difference are computed by the backend (closeCashSession), never by the
    // client.
    mutationFn: (payload: { sessionId: string; physicalCount: number }) =>
      apiSend<CashSessionEntity>(`/cash/close`, 'POST', payload),
    onSuccess: (data) => {
      setClosed(data);
      setCashError(null);
      queryClient.invalidateQueries({ queryKey: ['cash-session'] });
    },
    onError: (e) => setCashError(e instanceof Error ? e.message : 'Error al cerrar la caja'),
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
    if (!session || !physicalCount) return;
    const count = parseFloat(physicalCount);
    if (Number.isNaN(count) || count < 0) return;
    closeMutation.mutate({ sessionId: session.id, physicalCount: count });
    setShowCloseConfirm(false); setPhysicalCount('');
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> {t('sales.processing')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Banknote className="w-7 h-7 text-primary" /> {t('cash.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('cash.subtitle')}</p>
        </div>
      </div>

      {cashError && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {cashError}
          <button onClick={() => setCashError(null)} className="ml-auto hover:underline">{t('cash.closeError')}</button>
        </div>
      )}

      {/* Caja cerrada — mostrar botón de apertura */}
      {!session && !closed && (
        <div className="bg-card border border-border rounded-xl p-10 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Banknote className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('cash.closed')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('cash.noSession')}</p>
          </div>
          <button type="button" onClick={() => setShowOpenForm(true)} className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-medium px-6 py-3 rounded-lg transition-colors shadow-xs">
            <Plus className="w-5 h-5" /> {t('cash.openBox')}
          </button>
        </div>
      )}

      {/* Resumen de cierre (valores del servidor) */}
      {closed && !session && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-8 text-center space-y-4 shadow-xs">
          <CheckCircle2 className="w-14 h-14 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('cash.closedSuccess')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('cash.closedAt', { time: fmtTime(closed.closedAt) })}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mt-4">
            {[
              { label: t('cash.openingAmount'), value: fmt(closed.openingAmount), color: 'text-foreground' },
              { label: t('dashboard.kpiSales'), value: fmt(closed.salesTotal ?? 0), color: 'text-emerald-600 dark:text-emerald-400' },
              { label: t('cash.expected'), value: fmt(closed.expectedAmount ?? 0), color: 'text-foreground' },
              { label: t('cash.difference'), value: fmt(closed.difference ?? 0), color: (closed.difference ?? 0) < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400' },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setClosed(null)} className="inline-flex items-center gap-2 bg-muted hover:bg-accent text-foreground font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
            {t('cash.openBox')}
          </button>
        </div>
      )}

      {/* Caja abierta */}
      {session && (
        <>
          {/* Totales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('cash.openingAmount'), value: fmt(session.openingAmount), color: 'text-muted-foreground' },
              { label: t('dashboard.kpiSales'), value: fmt(session.salesTotal ?? 0), color: 'text-emerald-600 dark:text-emerald-400' },
              { label: t('cash.movementsHistory'), value: fmt(Math.abs(cashFromMovements)), color: cashFromMovements >= 0 ? 'text-primary' : 'text-destructive' },
              { label: t('cash.currentBalance'), value: fmt(totalInRegister), color: 'text-foreground text-xl font-bold' },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Info sesión */}
          <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-4 text-sm shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-foreground font-medium">{t('cash.open')}</span>
            </div>
            <span className="text-muted-foreground">{t('cash.cashier')} <span className="text-foreground font-medium">{session.employeeName}</span></span>
            <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {t('cash.openedAt')} <span className="text-foreground font-medium">{fmtTime(session.openedAt)}</span></span>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setShowMovForm(true)} className="flex items-center gap-1.5 text-xs font-medium bg-muted hover:bg-accent text-foreground px-3 py-2 rounded-lg border border-border transition-colors">
                <Plus className="w-3.5 h-3.5" /> {t('cash.addIncome')} / {t('cash.addExpense')}
              </button>
              <button type="button" onClick={() => setShowCloseConfirm(true)} className="flex items-center gap-1.5 text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 px-3 py-2 rounded-lg transition-colors">
                <Lock className="w-3.5 h-3.5" /> {t('cash.closeBox')}
              </button>
            </div>
          </div>

          {/* Movimientos */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3 border-b border-border bg-muted/40">
              <h2 className="text-sm font-semibold text-foreground">{t('cash.movementsHistory')}</h2>
            </div>
            <div className="divide-y divide-border">
              {session.movements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">{t('cash.noMovements')}</div>
              ) : (
                session.movements.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {m.type === 'IN' ? (
                        <ArrowUpCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <ArrowDownCircle className="w-5 h-5 text-destructive shrink-0" />
                      )}
                      <div>
                        <p className="text-sm text-foreground font-medium">{m.concept}</p>
                        <p className="text-xs text-muted-foreground">{fmtTime(m.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${m.type === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">{t('cash.openBox')}</h2>
              <button type="button" onClick={() => setShowOpenForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <label className="block text-xs text-muted-foreground mb-1">{t('cash.openingAmount')} (C$)</label>
            <input value={openAmount} onChange={e => setOpenAmount(e.target.value)} placeholder="5000.00" type="number"
              className="w-full bg-background border border-border rounded-lg px-3 py-3 text-foreground text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary mb-5" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowOpenForm(false)} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground text-sm">{t('cash.cancel')}</button>
              <button type="button" onClick={handleOpen} disabled={openMutation.isPending} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-60 shadow-xs">{t('cash.openBox')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Movimiento */}
      {showMovForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">{t('cash.movementTitle')}</h2>
              <button type="button" onClick={() => setShowMovForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-border mb-4">
              <button type="button" onClick={() => setMovType('IN')} className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${movType === 'IN' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                <ArrowUpCircle className="w-4 h-4" /> {t('cash.addIncome')}
              </button>
              <button type="button" onClick={() => setMovType('OUT')} className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${movType === 'OUT' ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'}`}>
                <ArrowDownCircle className="w-4 h-4" /> {t('cash.addExpense')}
              </button>
            </div>
            <label className="block text-xs text-muted-foreground mb-1">{t('cash.concept')}</label>
            <input value={movConcept} onChange={e => setMovConcept(e.target.value)} placeholder={t('cash.conceptPlaceholder')}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
            <label className="block text-xs text-muted-foreground mb-1">{t('cash.amount')} (C$)</label>
            <input value={movAmount} onChange={e => setMovAmount(e.target.value)} placeholder="0.00" type="number"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowMovForm(false)} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground text-sm">{t('cash.cancel')}</button>
              <button type="button" onClick={handleAddMovement} disabled={movementMutation.isPending} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-60 shadow-xs">{t('cash.register')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Cierre */}
      {showCloseConfirm && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-destructive/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <Lock className="w-10 h-10 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-bold text-foreground text-center mb-1">{t('cash.closeConfirmTitle')}</h2>
            <p className="text-sm text-muted-foreground text-center mb-4">{t('cash.closeConfirmExpected', { amount: fmt(totalInRegister) })}</p>
            <label className="block text-xs text-muted-foreground mb-1">{t('cash.physicalCount')} (C$)</label>
            <input value={physicalCount} onChange={e => setPhysicalCount(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01"
              className="w-full bg-background border border-border rounded-lg px-3 py-3 text-foreground text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary mb-2" />
            <p className="text-xs text-muted-foreground text-center mb-5">{t('cash.physicalCountHelp')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowCloseConfirm(false); setPhysicalCount(''); }} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground text-sm">{t('cash.cancel')}</button>
              <button type="button" onClick={handleClose} disabled={closeMutation.isPending || !physicalCount} className="flex-1 py-2.5 rounded-lg bg-destructive text-white font-medium text-sm disabled:opacity-60 shadow-xs">{t('cash.confirmClose')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}