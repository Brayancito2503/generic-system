'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Save, Loader2, CheckCircle2, AlertCircle, Building2, Info } from 'lucide-react';
import { apiGet, apiSend } from '../api';

interface TenantSettings {
  logoUrl?: string;
  primaryColor?: string;
  currency?: string;
  currencySymbol?: string;
  secondaryCurrency?: string;
  exchangeRate?: number;
  timezone?: string;
}

interface TenantSettingsResponse {
  name: string;
  industry: string;
  settings: TenantSettings;
}

interface SettingsFormValues {
  name: string;
  logoUrl: string;
  primaryColor: string;
  currency: string;
  currencySymbol: string;
  secondaryCurrency: string;
  exchangeRate: string;
  timezone: string;
}

/**
 * Settings form; remounted per server snapshot (key={name + settings}) so its
 * local state always starts from the persisted values, never from hardcoded
 * defaults or setState-in-effect.
 */
function SettingsForm({
  initial,
  isSaving,
  onSubmit,
}: {
  initial: SettingsFormValues;
  isSaving: boolean;
  onSubmit: (values: SettingsFormValues) => void;
}) {
  const t = useTranslations('distributionModule.settings');
  const [form, setForm] = useState<SettingsFormValues>(initial);
  const [invalidName, setInvalidName] = useState(false);

  const update = (field: keyof SettingsFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const inputClass =
    'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) {
          setInvalidName(true);
          return;
        }
        setInvalidName(false);
        onSubmit(form);
      }}
      className="space-y-4"
    >
      {invalidName && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {t('invalidName')}
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">{t('fieldName')}</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder={t('namePlaceholder')}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">{t('fieldLogoUrl')}</label>
          <input
            type="text"
            value={form.logoUrl}
            onChange={(e) => update('logoUrl', e.target.value)}
            placeholder={t('logoPlaceholder')}
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">{t('fieldPrimaryColor')}</label>
          <input
            type="text"
            value={form.primaryColor}
            onChange={(e) => update('primaryColor', e.target.value)}
            placeholder={t('colorPlaceholder')}
            className={`${inputClass} font-mono`}
          />
          <p className="text-[10px] text-muted-foreground mt-1">{t('colorHint')}</p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Moneda Principal (ISO)</label>
          <input
            type="text"
            value={form.currency}
            onChange={(e) => update('currency', e.target.value)}
            placeholder="Ej. NIO, USD, EUR, HNL"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Símbolo de Moneda</label>
          <input
            type="text"
            value={form.currencySymbol}
            onChange={(e) => update('currencySymbol', e.target.value)}
            placeholder="Ej. C$, $, €, L, Q"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Moneda Secundaria (Bi-Moneda)</label>
          <input
            type="text"
            value={form.secondaryCurrency}
            onChange={(e) => update('secondaryCurrency', e.target.value)}
            placeholder="Ej. USD"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tasa de Cambio (1 Moneda Sec. = X Principal)</label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={form.exchangeRate}
            onChange={(e) => update('exchangeRate', e.target.value)}
            placeholder="Ej. 36.65"
            className={inputClass}
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">{t('fieldTimezone')}</label>
          <input
            type="text"
            value={form.timezone}
            onChange={(e) => update('timezone', e.target.value)}
            placeholder={t('timezonePlaceholder')}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>{t('fiscalHint')}</p>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 font-medium text-sm text-primary-foreground rounded-lg transition-colors shadow-sm"
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {t('saving')}</>
          ) : (
            <><Save className="w-4 h-4" /> {t('save')}</>
          )}
        </button>
      </div>
    </form>
  );
}

export default function TenantSettingsView() {
  const t = useTranslations('distributionModule.settings');
  const queryClient = useQueryClient();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: server, isPending, isError, refetch } = useQuery<TenantSettingsResponse>({
    queryKey: ['tenant-settings'],
    queryFn: () => apiGet<TenantSettingsResponse>('/settings'),
  });

  const saveSettings = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      // Empty optional fields are omitted so Zod validates the remaining ones;
      // persisted passthrough keys are preserved by the server-side merge.
      const settings: TenantSettings = {};
      if (values.logoUrl.trim()) settings.logoUrl = values.logoUrl.trim();
      if (values.primaryColor.trim()) settings.primaryColor = values.primaryColor.trim();
      if (values.currency.trim()) settings.currency = values.currency.trim();
      if (values.currencySymbol.trim()) settings.currencySymbol = values.currencySymbol.trim();
      if (values.secondaryCurrency.trim()) settings.secondaryCurrency = values.secondaryCurrency.trim();
      if (values.exchangeRate.trim() && !Number.isNaN(parseFloat(values.exchangeRate))) {
        settings.exchangeRate = parseFloat(values.exchangeRate);
      }
      if (values.timezone.trim()) settings.timezone = values.timezone.trim();

      return apiSend<TenantSettingsResponse>('/settings', 'PUT', {
        name: values.name.trim(),
        settings,
      });
    },
    onSuccess: () => {
      setError(null);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : t('saveError')),
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-3 items-center justify-center h-full text-sm text-destructive">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {t('loadError')}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (!server) return null;

  const initial: SettingsFormValues = {
    name: server.name,
    logoUrl: server.settings.logoUrl ?? '',
    primaryColor: server.settings.primaryColor ?? '',
    currency: server.settings.currency ?? '',
    currencySymbol: server.settings.currencySymbol ?? '',
    secondaryCurrency: server.settings.secondaryCurrency ?? '',
    exchangeRate: server.settings.exchangeRate ? String(server.settings.exchangeRate) : '',
    timezone: server.settings.timezone ?? '',
  };

  return (
    <div className="p-6 space-y-5 w-full max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg text-primary">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {t('saved')}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        <SettingsForm
          key={server.name + JSON.stringify(server.settings)}
          initial={initial}
          isSaving={saveSettings.isPending}
          onSubmit={(values) => saveSettings.mutate(values)}
        />
      </div>
    </div>
  );
}