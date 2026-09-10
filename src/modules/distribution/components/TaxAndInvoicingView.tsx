'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Percent,
  Calculator,
  Building2,
  Save,
  CheckCircle2,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Star,
  AlertCircle,
} from 'lucide-react';
import type { TaxRateEntity, FiscalSummary } from '../entities';
import { apiGet, apiSend } from '../api';

const fmt = (n: number) =>
  `C$ ${n.toLocaleString('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

interface TaxModalState {
  id?: string;
  name: string;
  rate: string;
  isInclusive: boolean;
  isDefault: boolean;
}

const emptyModal: TaxModalState = {
  name: '',
  rate: '15',
  isInclusive: true,
  isDefault: false,
};

export default function TaxAndInvoicingView() {
  const queryClient = useQueryClient();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<TaxModalState | null>(null);

  const { data: taxes = [], isPending } = useQuery<TaxRateEntity[]>({
    queryKey: ['tax-rates'],
    queryFn: () => apiGet<TaxRateEntity[]>(`/tax`),
  });

  const { data: summary, isPending: isSummaryPending } = useQuery<FiscalSummary>({
    queryKey: ['tax-summary'],
    queryFn: () => apiGet<FiscalSummary>(`/tax/summary`),
  });

  // CAI Settings (config fiscal local del tenant; persistencia próxima iteración)
  const [caiConfig, setCaiConfig] = useState({
    caiNumber: '3A4F82-9B10C2-4E67D1-8A9011-223344-01',
    rangeFrom: '000-001-01-00001001',
    rangeTo: '000-001-01-00005000',
    currentSequence: '000-001-01-00001248',
    limitDate: '2027-04-15',
    companyTaxId: '03141990123456',
    legalName: 'DISTRIBUIDORA Y COMERCIALIZADORA DEL VALLE S. DE R.L.',
  });

  const refreshTaxes = () => {
    queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
    queryClient.invalidateQueries({ queryKey: ['tax-summary'] });
  };

  const saveTax = useMutation({
    mutationFn: async (v: { id?: string; name: string; rate: number; isInclusive: boolean; isDefault: boolean }) =>
      v.id
        ? apiSend(`/tax/${v.id}`, 'PATCH', {
            name: v.name,
            rate: v.rate,
            isInclusive: v.isInclusive,
            isDefault: v.isDefault,
          })
        : apiSend(`/tax`, 'POST', {
            name: v.name,
            rate: v.rate,
            isInclusive: v.isInclusive,
            isDefault: v.isDefault,
          }),
    onSuccess: () => {
      setModal(null);
      setError(null);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      refreshTaxes();
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'Error al guardar la tasa'),
  });

  const deleteTax = useMutation({
    mutationFn: (id: string) => apiSend(`/tax/${id}`, 'DELETE'),
    onSuccess: () => {
      setError(null);
      refreshTaxes();
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'Error al eliminar la tasa'),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) =>
      apiSend(`/tax/${id}`, 'PATCH', { isDefault: true }),
    onSuccess: () => {
      setError(null);
      refreshTaxes();
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'Error al definir la tasa'),
  });

  const handleSaveCAI = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    const rate = parseFloat(modal.rate);
    if (!modal.name.trim() || Number.isNaN(rate) || rate < 0) {
      setError('Nombre y tasa (>= 0) son obligatorios');
      return;
    }
    saveTax.mutate({
      id: modal.id,
      name: modal.name.trim(),
      rate,
      isInclusive: modal.isInclusive,
      isDefault: modal.isDefault,
    });
  };

  const monthLabel = summary
    ? summary.monthLabel.charAt(0).toUpperCase() + summary.monthLabel.slice(1)
    : '';

  return (
    <div className="p-6 space-y-6 text-zinc-100">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Receipt className="w-7 h-7 text-indigo-400" /> Impuestos & Facturación Fiscal (DGI / CAI)
        </h1>
        <p className="text-sm text-zinc-400">
          Configuración de impuestos sobre ventas (IVA), autorización del CAI y datos fiscales de la distribuidora.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5" /> Configuración de Facturación y catálogo de impuestos guardado exitosamente.
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:text-white">Cerrar</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario CAI y Datos Empresa */}
        <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Datos Fiscales y Registro CAI</h2>
          </div>

          <form onSubmit={handleSaveCAI} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Razón Social Fiscal</label>
                <input
                  type="text"
                  value={caiConfig.legalName}
                  onChange={(e) => setCaiConfig({ ...caiConfig, legalName: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">RUC de la Empresa</label>
                <input
                  type="text"
                  value={caiConfig.companyTaxId}
                  onChange={(e) => setCaiConfig({ ...caiConfig, companyTaxId: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Código CAI Autorizado por DGI</label>
              <input
                type="text"
                value={caiConfig.caiNumber}
                onChange={(e) => setCaiConfig({ ...caiConfig, caiNumber: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Rango Autorizado Desde</label>
                <input
                  type="text"
                  value={caiConfig.rangeFrom}
                  onChange={(e) => setCaiConfig({ ...caiConfig, rangeFrom: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Rango Autorizado Hasta</label>
                <input
                  type="text"
                  value={caiConfig.rangeTo}
                  onChange={(e) => setCaiConfig({ ...caiConfig, rangeTo: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Fecha Límite de Emisión</label>
                <input
                  type="date"
                  value={caiConfig.limitDate}
                  onChange={(e) => setCaiConfig({ ...caiConfig, limitDate: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400">Secuencia Actual de Correlativo</p>
                <p className="text-base font-mono font-bold text-emerald-400 mt-0.5">
                  {caiConfig.currentSequence}
                </p>
              </div>
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-semibold rounded-full border border-indigo-500/20">
                Próxima Factura: 000-001-01-00001249
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-medium text-sm text-white rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
              >
                <Save className="w-4 h-4" /> Guardar Cambios CAI
              </button>
            </div>
          </form>
        </div>

        {/* Catálogo de Tasas de Impuesto */}
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Catálogo de Impuestos</h2>
              </div>
              <button
                onClick={() => setModal({ ...emptyModal })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>

            {isPending ? (
              <div className="flex items-center justify-center py-8 text-zinc-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando...
              </div>
            ) : (
              <div className="space-y-3">
                {taxes.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm text-zinc-100">{t.name}</h4>
                          {t.isDefault && (
                            <span className="px-2 py-0.5 text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded font-medium flex items-center gap-1">
                              <Star className="w-2.5 h-2.5" /> Predeterminado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">Tasa impositiva: {t.rate}%</p>
                      </div>
                      <span className="font-mono text-lg font-bold text-emerald-400">{t.rate}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/60">
                      {!t.isDefault && (
                        <button
                          onClick={() => setDefault.mutate(t.id)}
                          title="Establecer como predeterminada"
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-indigo-500/20 hover:text-indigo-400 text-zinc-400 text-xs transition-colors"
                        >
                          <Star className="w-3 h-3" /> Predeterminar
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setModal({
                            id: t.id,
                            name: t.name,
                            rate: String(t.rate),
                            isInclusive: true,
                            isDefault: t.isDefault,
                          })
                        }
                        title="Editar tasa"
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-indigo-500/20 hover:text-indigo-400 text-zinc-400 text-xs transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`¿Eliminar la tasa "${t.name}"?`)) {
                            deleteTax.mutate(t.id);
                          }
                        }}
                        title="Eliminar tasa"
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 text-xs transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
                {taxes.length === 0 && (
                  <p className="text-sm text-zinc-500 py-4 text-center">No hay tasas de impuesto configuradas.</p>
                )}
              </div>
            )}
          </div>

          {/* Reporte resumido fiscal */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-3">
            <h3 className="font-semibold text-sm text-zinc-200 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-400" /> Resumen Fiscal del Mes {monthLabel && `· ${monthLabel}`}
            </h3>
            {isSummaryPending ? (
              <div className="flex items-center justify-center py-6 text-zinc-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Calculando...
              </div>
            ) : (
              <div className="space-y-2 text-xs text-zinc-400 pt-2 border-t border-zinc-800">
                <div className="flex justify-between py-1">
                  <span>Ventas del mes:</span>
                  <span className="font-semibold text-zinc-200">{fmt(summary?.taxedRevenue ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Facturas emitidas:</span>
                  <span className="font-semibold text-zinc-200">{summary?.totalSales ?? 0}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>IVA Recaudado:</span>
                  <span className="font-semibold text-emerald-400">{fmt(summary?.taxCollected ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-zinc-800/60 pt-2 font-medium">
                  <span className="text-zinc-200">Total Impuesto a Declarar (DGI):</span>
                  <span className="font-bold text-indigo-400">{fmt(summary?.taxCollected ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1 font-medium">
                  <span className="text-emerald-300">Utilidad Bruta del Mes:</span>
                  <span className="font-bold text-emerald-400">{fmt(summary?.profit ?? 0)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de tasa */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmitModal}
            className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-white">
              {modal.id ? 'Editar Tasa de Impuesto' : 'Nueva Tasa de Impuesto'}
            </h3>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Nombre</label>
              <input
                type="text"
                value={modal.name}
                onChange={(e) => setModal({ ...modal, name: e.target.value })}
                placeholder="Ej: IVA General 15%"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Tasa (%)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={modal.rate}
                onChange={(e) => setModal({ ...modal, rate: e.target.value })}
                placeholder="15"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={modal.isInclusive}
                onChange={(e) => setModal({ ...modal, isInclusive: e.target.checked })}
                className="accent-indigo-500"
              />
              El precio incluye el impuesto (IVA incluido)
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={modal.isDefault}
                onChange={(e) => setModal({ ...modal, isDefault: e.target.checked })}
                className="accent-indigo-500"
              />
              Usar como tasa predeterminada (POS y ventas)
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saveTax.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white rounded-lg transition-colors"
              >
                {saveTax.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                ) : (
                  <><Save className="w-4 h-4" /> Guardar</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}