'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
import type { TaxRateEntity, FiscalSummary, InvoicingConfigEntity } from '../entities';
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

/** Client form mirror of the server InvoicingConfigEntity (PUT payload). */
interface CaiForm {
  caiNumber: string;
  rangeFrom: string;
  rangeTo: string;
  limitDate: string;
  companyTaxId: string;
  legalName: string;
}

const emptyCaiForm: CaiForm = {
  caiNumber: '',
  rangeFrom: '',
  rangeTo: '',
  limitDate: '',
  companyTaxId: '',
  legalName: '',
};

const toDateInput = (v?: Date | string | null): string =>
  v ? new Date(v).toISOString().slice(0, 10) : '';

const toCaiForm = (config: InvoicingConfigEntity): CaiForm => ({
  caiNumber: config.caiNumber,
  rangeFrom: config.rangeFrom,
  rangeTo: config.rangeTo,
  limitDate: toDateInput(config.limitDate),
  companyTaxId: config.companyTaxId,
  legalName: config.legalName,
});

/**
 * GET /tax/config is TENANT_ADMIN-only and answers 404 when the tenant has no
 * InvoicingConfig row yet; the view maps 404 to an empty setup form instead of
 * an error. Any other failure surfaces as a message.
 */
async function loadInvoicingConfig(): Promise<InvoicingConfigEntity | null> {
  const res = await fetch('/api/distribution/tax/config', { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Error de solicitud');
  }
  return res.json() as Promise<InvoicingConfigEntity>;
}

/** CAI/NCF form; remounted per server config id so its state always starts
 *  from the persisted value (never from hardcoded defaults). */
function CaiConfigForm({
  initial,
  isSaving,
  onSubmit,
}: {
  initial: CaiForm;
  isSaving: boolean;
  onSubmit: (payload: CaiForm) => void;
}) {
  const t = useTranslations('distributionModule.tax');
  const [caiForm, setCaiForm] = useState<CaiForm>(initial);

  const valid =
    caiForm.caiNumber.trim() !== '' &&
    caiForm.rangeFrom.trim() !== '' &&
    caiForm.rangeTo.trim() !== '' &&
    caiForm.companyTaxId.trim() !== '' &&
    caiForm.legalName.trim() !== '';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(caiForm);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">{t('legalName')}</label>
          <input
            type="text"
            value={caiForm.legalName}
            onChange={(e) => setCaiForm({ ...caiForm, legalName: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">{t('companyTaxId')}</label>
          <input
            type="text"
            value={caiForm.companyTaxId}
            onChange={(e) => setCaiForm({ ...caiForm, companyTaxId: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">{t('caiNumber')}</label>
        <input
          type="text"
          value={caiForm.caiNumber}
          onChange={(e) => setCaiForm({ ...caiForm, caiNumber: e.target.value })}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">{t('rangeFrom')}</label>
          <input
            type="text"
            value={caiForm.rangeFrom}
            onChange={(e) => setCaiForm({ ...caiForm, rangeFrom: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">{t('rangeTo')}</label>
          <input
            type="text"
            value={caiForm.rangeTo}
            onChange={(e) => setCaiForm({ ...caiForm, rangeTo: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">{t('limitDate')}</label>
          <input
            type="date"
            value={caiForm.limitDate}
            onChange={(e) => setCaiForm({ ...caiForm, limitDate: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={!valid || isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 font-medium text-sm text-primary-foreground rounded-lg transition-colors shadow-sm"
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {t('savingCai')}</>
          ) : (
            <><Save className="w-4 h-4" /> {t('saveCAI')}</>
          )}
        </button>
      </div>
    </form>
  );
}

export default function TaxAndInvoicingView() {
  const t = useTranslations('distributionModule.tax');
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

  // CAI/NCF configuration is persisted server-side (GET /tax/config + PUT);
  // the form is seeded from the server value, never from hardcoded defaults.
  const {
    data: serverConfig,
    isPending: isConfigPending,
    isError: isConfigError,
  } = useQuery<InvoicingConfigEntity | null>({
    queryKey: ['tax-config'],
    queryFn: loadInvoicingConfig,
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

  const saveCai = useMutation({
    mutationFn: (payload: CaiForm) =>
      apiSend<InvoicingConfigEntity>(`/tax/config`, 'PUT', {
        caiNumber: payload.caiNumber,
        rangeFrom: payload.rangeFrom,
        rangeTo: payload.rangeTo,
        companyTaxId: payload.companyTaxId,
        legalName: payload.legalName,
        // Empty date must NOT be sent: Zod coerce('') fails (400).
        ...(payload.limitDate ? { limitDate: new Date(payload.limitDate) } : {}),
      }),
    onSuccess: () => {
      setError(null);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['tax-config'] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'Error al guardar la configuración fiscal'),
  });

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
    <div className="p-6 space-y-6 text-foreground">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Receipt className="w-7 h-7 text-primary" /> {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-500 text-sm">
          <CheckCircle2 className="w-5 h-5" /> {t('saved')}
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:underline">{t('closeError')}</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario CAI y Datos Empresa (server-persisted) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">{t('fiscalTitle')}</h2>
          </div>

          {isConfigPending ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> {t('loadingConfig')}
            </div>
          ) : (
            <>
              {serverConfig === null && !isConfigError && (
                <p className="text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
                  {t('notConfiguredHint')}
                </p>
              )}

              <CaiConfigForm
                key={serverConfig?.id ?? 'creating'}
                initial={serverConfig ? toCaiForm(serverConfig) : emptyCaiForm}
                isSaving={saveCai.isPending}
                onSubmit={(payload) => saveCai.mutate(payload)}
              />
            </>
          )}
        </div>

        {/* Catálogo de Tasas de Impuesto */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">{t('taxRatesTitle')}</h2>
              </div>
              <button
                onClick={() => setModal({ ...emptyModal })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> {t('addRate')}
              </button>
            </div>

            {isPending ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> {t('loadingRates')}
              </div>
            ) : (
              <div className="space-y-3">
                {taxes.map((tItem) => (
                  <div
                    key={tItem.id}
                    className="p-4 bg-muted/30 border border-border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm text-foreground">{tItem.name}</h4>
                          {tItem.isDefault && (
                            <span className="px-2 py-0.5 text-[10px] bg-primary/10 text-primary border border-primary/20 rounded font-medium flex items-center gap-1">
                              <Star className="w-2.5 h-2.5" /> {t('isDefault')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('rateLabel')}: {tItem.rate}%</p>
                      </div>
                      <span className="font-mono text-lg font-bold text-emerald-500">{tItem.rate}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
                      {!tItem.isDefault && (
                        <button
                          onClick={() => setDefault.mutate(tItem.id)}
                          title={t('setDefaultTitle')}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground text-xs transition-colors"
                        >
                          <Star className="w-3 h-3" /> {t('setDefault')}
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setModal({
                            id: tItem.id,
                            name: tItem.name,
                            rate: String(tItem.rate),
                            isInclusive: true,
                            isDefault: tItem.isDefault,
                          })
                        }
                        title={t('editRateTitle')}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground text-xs transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> {t('editRate')}
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(t('deleteRateConfirm', { name: tItem.name }))) {
                            deleteTax.mutate(tItem.id);
                          }
                        }}
                        title={t('deleteRateTitle')}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-destructive/20 hover:text-destructive text-muted-foreground text-xs transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> {t('deleteRate')}
                      </button>
                    </div>
                  </div>
                ))}
                {taxes.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">{t('noRates')}</p>
                )}
              </div>
            )}
          </div>

          {/* Reporte resumido fiscal */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-3 shadow-sm">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" /> {t('fiscalSummary')} {monthLabel && `· ${monthLabel}`}
            </h3>
            {isSummaryPending ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> {t('calculating')}
              </div>
            ) : (
              <div className="space-y-2 text-xs text-muted-foreground pt-2 border-t border-border">
                <div className="flex justify-between py-1">
                  <span>{t('monthlySales')}:</span>
                  <span className="font-semibold text-foreground">{fmt(summary?.taxedRevenue ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>{t('invoicesIssued')}:</span>
                  <span className="font-semibold text-foreground">{summary?.totalSales ?? 0}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>{t('vatCollected')}:</span>
                  <span className="font-semibold text-emerald-500">{fmt(summary?.taxCollected ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-border/60 pt-2 font-medium">
                  <span className="text-foreground">{t('totalTaxDue')}:</span>
                  <span className="font-bold text-primary">{fmt(summary?.taxCollected ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1 font-medium">
                  <span className="text-emerald-500">{t('grossProfit')}:</span>
                  <span className="font-bold text-emerald-500">{fmt(summary?.profit ?? 0)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de tasa */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmitModal}
            className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-lg font-bold text-foreground">
              {modal.id ? t('editRateModalTitle') : t('newRateModalTitle')}
            </h3>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('name')}</label>
              <input
                type="text"
                value={modal.name}
                onChange={(e) => setModal({ ...modal, name: e.target.value })}
                placeholder={t('namePlaceholder')}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('rate')} (%)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={modal.rate}
                onChange={(e) => setModal({ ...modal, rate: e.target.value })}
                placeholder="15"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={modal.isInclusive}
                onChange={(e) => setModal({ ...modal, isInclusive: e.target.checked })}
                className="accent-primary"
              />
              {t('inclusiveLabel')}
            </label>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={modal.isDefault}
                onChange={(e) => setModal({ ...modal, isDefault: e.target.checked })}
                className="accent-primary"
              />
              {t('defaultLabel')}
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={saveTax.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-sm font-medium text-primary-foreground rounded-lg transition-colors"
              >
                {saveTax.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('saving')}</>
                ) : (
                  <><Save className="w-4 h-4" /> {t('save')}</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}