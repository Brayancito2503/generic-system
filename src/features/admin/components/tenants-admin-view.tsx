'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Building2,
  Plus,
  Pencil,
  Power,
  PowerOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { INDUSTRY_CATALOG, MODULE_CATALOG } from '@/core/schemas/admin-tenants';
import type { IndustryKey, ModuleKey } from '@/core/schemas/admin-tenants';
import { apiGet, apiSend } from '../api';
import type {
  AdminTenant,
  AdminTenantRecord,
  CreateTenantPayload,
  UpdateTenantPayload,
} from '../api';

interface CreateFormValues {
  name: string;
  slug: string;
  industry: IndustryKey;
  modules: ModuleKey[];
  adminEmail: string;
  adminPassword: string;
}

interface EditFormValues {
  name: string;
  industry: IndustryKey;
  modules: ModuleKey[];
  active: boolean;
}

const emptyCreateForm: CreateFormValues = {
  name: '',
  slug: '',
  industry: INDUSTRY_CATALOG[0],
  modules: [],
  adminEmail: '',
  adminPassword: '',
};

const inputClass =
  'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary';

export default function TenantsAdminView() {
  const t = useTranslations('adminTenants');
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormValues>(emptyCreateForm);
  const [editing, setEditing] = useState<AdminTenant | null>(null);
  const [editForm, setEditForm] = useState<EditFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: tenants = [], isPending } = useQuery<AdminTenant[]>({
    queryKey: ['admin-tenants'],
    queryFn: () => apiGet<AdminTenant[]>('/tenants'),
  });

  const flashSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const createTenant = useMutation({
    mutationFn: (payload: CreateTenantPayload) =>
      apiSend<AdminTenantRecord>('/tenants', 'POST', payload),
    onSuccess: () => {
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      setError(null);
      flashSuccess(t('saved'));
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : t('saveError')),
  });

  const updateTenant = useMutation({
    mutationFn: (payload: { id: string; data: UpdateTenantPayload }) =>
      apiSend<AdminTenantRecord>(`/tenants/${payload.id}`, 'PATCH', payload.data),
    onSuccess: () => {
      setEditing(null);
      setEditForm(null);
      setError(null);
      flashSuccess(t('saved'));
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : t('saveError')),
  });

  const toggleActive = useMutation({
    mutationFn: (payload: { id: string; active: boolean }) =>
      apiSend<AdminTenantRecord>(`/tenants/${payload.id}`, 'PATCH', {
        active: payload.active,
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : t('saveError')),
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, slug, adminEmail, adminPassword } = createForm;
    if (!name.trim() || !slug.trim()) {
      setError(t('invalidForm'));
      return;
    }
    // Zod also enforces this server-side: both credentials or neither.
    if (Boolean(adminEmail.trim()) !== Boolean(adminPassword)) {
      setError(t('adminCredentialsError'));
      return;
    }
    setError(null);
    createTenant.mutate({
      name: name.trim(),
      slug: slug.trim(),
      industry: createForm.industry,
      modules: createForm.modules,
      ...(adminEmail.trim() ? { adminEmail: adminEmail.trim() } : {}),
      ...(adminPassword ? { adminPassword } : {}),
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm) return;
    if (!editForm.name.trim()) {
      setError(t('invalidForm'));
      return;
    }
    setError(null);
    updateTenant.mutate({
      id: editing.id,
      data: {
        name: editForm.name.trim(),
        industry: editForm.industry,
        modules: editForm.modules,
        active: editForm.active,
      },
    });
  };

  const openEdit = (tenant: AdminTenant) => {
    setEditing(tenant);
    setEditForm({
      name: tenant.name,
      industry: tenant.industry,
      modules: tenant.modules,
      active: tenant.active,
    });
    setError(null);
  };

  const toggleCreateModule = (key: ModuleKey) => {
    setCreateForm((prev) => ({
      ...prev,
      modules: prev.modules.includes(key)
        ? prev.modules.filter((m) => m !== key)
        : [...prev.modules, key],
    }));
  };

  const toggleEditModule = (key: ModuleKey) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modules: prev.modules.includes(key)
          ? prev.modules.filter((m) => m !== key)
          : [...prev.modules, key],
      };
    });
  };

  const industryLabel = (key: IndustryKey) => t(`industries.${key}`);
  const moduleLabel = (key: ModuleKey) => t(`modules.${key}`);

  const moduleBadge = (key: ModuleKey) => (
    <span
      key={key}
      className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap"
    >
      {moduleLabel(key)}
    </span>
  );

  const statusBadge = (active: boolean) =>
    active ? (
      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        {t('active')}
      </span>
    ) : (
      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
        {t('inactive')}
      </span>
    );

  return (
    <div className="space-y-6 text-foreground p-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" /> {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateForm(emptyCreateForm);
            setError(null);
            setShowCreate(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 font-medium text-sm text-primary-foreground rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" /> {t('newTenant')}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:underline">
            {t('close')}
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-500 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {success}
        </div>
      )}

      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('loading')}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">{t('colName')}</th>
                <th className="px-5 py-3">{t('colIndustry')}</th>
                <th className="px-5 py-3">{t('colModules')}</th>
                <th className="px-5 py-3">{t('colStatus')}</th>
                <th className="px-5 py-3 text-center">{t('colUsers')}</th>
                <th className="px-5 py-3 text-center">{t('colBranches')}</th>
                <th className="px-5 py-3">{t('colCreated')}</th>
                <th className="px-5 py-3 text-right">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-accent/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-foreground">{tenant.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{tenant.slug}</p>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {industryLabel(tenant.industry)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {tenant.modules.length > 0
                        ? tenant.modules.map(moduleBadge)
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">{statusBadge(tenant.active)}</td>
                  <td className="px-5 py-3.5 text-center text-muted-foreground">
                    {tenant._count.users}
                  </td>
                  <td className="px-5 py-3.5 text-center text-muted-foreground">
                    {tenant._count.branches}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(tenant)}
                        disabled={toggleActive.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground text-xs font-medium transition-colors disabled:opacity-60"
                      >
                        <Pencil className="w-3.5 h-3.5" /> {t('edit')}
                      </button>
                      {tenant.active ? (
                        <button
                          type="button"
                          onClick={() => toggleActive.mutate({ id: tenant.id, active: false })}
                          disabled={toggleActive.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-destructive/15 hover:text-destructive text-muted-foreground text-xs font-medium transition-colors disabled:opacity-60"
                        >
                          {toggleActive.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <PowerOff className="w-3.5 h-3.5" />
                          )}
                          {t('deactivate')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleActive.mutate({ id: tenant.id, active: true })}
                          disabled={toggleActive.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium transition-colors disabled:opacity-60"
                        >
                          <Power className="w-3.5 h-3.5" />
                          {t('activate')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tenants.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">{t('empty')}</div>
          )}
        </div>
      )}

      {/* Modal: Nuevo tenant */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{t('createTitle')}</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t('close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t('fieldName')}
              </label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder={t('placeholderName')}
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('fieldSlug')}</label>
              <input
                type="text"
                required
                value={createForm.slug}
                onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                placeholder={t('placeholderSlug')}
                className={`${inputClass} font-mono`}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{t('slugHint')}</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t('fieldIndustry')}
              </label>
              <select
                value={createForm.industry}
                onChange={(e) =>
                  setCreateForm({ ...createForm, industry: e.target.value as IndustryKey })
                }
                className={inputClass}
              >
                {INDUSTRY_CATALOG.map((key) => (
                  <option key={key} value={key}>
                    {t(`industries.${key}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">
                {t('fieldModules')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MODULE_CATALOG.map((key) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      createForm.modules.includes(key)
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={createForm.modules.includes(key)}
                      onChange={() => toggleCreateModule(key)}
                      className="accent-primary"
                    />
                    {moduleLabel(key)}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t('fieldAdminEmail')}
                </label>
                <input
                  type="email"
                  value={createForm.adminEmail}
                  onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                  placeholder={t('placeholderAdminEmail')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t('fieldAdminPassword')}
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={createForm.adminPassword}
                  onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                  placeholder={t('placeholderAdminPassword')}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">{t('adminCredentialsHint')}</p>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-muted hover:bg-accent text-xs font-semibold rounded-lg text-foreground transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={createTenant.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60 shadow-xs"
              >
                {createTenant.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar tenant */}
      {editing && editForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleEditSubmit}
            className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">{t('editTitle')}</h2>
                <p className="text-xs text-muted-foreground font-mono">{editing.slug}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setEditForm(null);
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t('close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t('fieldName')}
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t('fieldIndustry')}
              </label>
              <select
                value={editForm.industry}
                onChange={(e) =>
                  setEditForm({ ...editForm, industry: e.target.value as IndustryKey })
                }
                className={inputClass}
              >
                {INDUSTRY_CATALOG.map((key) => (
                  <option key={key} value={key}>
                    {t(`industries.${key}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">
                {t('fieldModules')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MODULE_CATALOG.map((key) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      editForm.modules.includes(key)
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.modules.includes(key)}
                      onChange={() => toggleEditModule(key)}
                      className="accent-primary"
                    />
                    {moduleLabel(key)}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm cursor-pointer hover:border-primary/40">
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                className="accent-primary"
              />
              <span className="text-sm text-foreground">{t('fieldActive')}</span>
            </label>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setEditForm(null);
                }}
                className="px-4 py-2 bg-muted hover:bg-accent text-xs font-semibold rounded-lg text-foreground transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={updateTenant.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60 shadow-xs"
              >
                {updateTenant.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}