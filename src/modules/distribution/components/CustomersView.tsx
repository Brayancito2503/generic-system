'use client';

import React, { useDeferredValue, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Search, Plus, Pencil, Loader2, Users, AlertCircle, X, Mail, Phone, UserRound } from 'lucide-react';
import type { CustomerLight } from '../entities';
import { apiGet, apiSend } from '../api';

interface CustomerFormState {
  id?: string;
  firstName: string;
  lastName: string;
  documentId: string;
  email: string;
  phone: string;
}

const emptyForm: CustomerFormState = {
  firstName: '',
  lastName: '',
  documentId: '',
  email: '',
  phone: '',
};

export function CustomersView() {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [modal, setModal] = useState<CustomerFormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: customers = [], isPending } = useQuery<CustomerLight[]>({
    queryKey: ['customers', deferredSearch],
    queryFn: () => apiGet<CustomerLight[]>(`/customers?q=${encodeURIComponent(deferredSearch)}`),
  });

  const saveCustomer = useMutation({
    mutationFn: (form: CustomerFormState) => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        documentId: form.documentId.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      };
      return form.id
        ? apiSend<CustomerLight>(`/customers/${form.id}`, 'PATCH', payload)
        : apiSend<CustomerLight>(`/customers`, 'POST', payload);
    },
    onSuccess: () => {
      setModal(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error de solicitud'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    if (!modal.firstName.trim() || !modal.lastName.trim()) {
      setError(t('customers.invalidForm'));
      return;
    }
    saveCustomer.mutate(modal);
  };

  return (
    <div className="p-6 space-y-6 text-foreground">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" /> {t('customers.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('customers.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ ...emptyForm })}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> {t('customers.newCustomer')}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:underline">{t('customers.closeError')}</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('customers.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {isPending ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> {t('customers.loading')}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {customers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">{t('customers.empty')}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border bg-muted/40">
                    <th className="px-5 py-3 font-medium">{t('customers.colName')}</th>
                    <th className="px-5 py-3 font-medium">{t('customers.colDocument')}</th>
                    <th className="px-5 py-3 font-medium">{t('customers.colContact')}</th>
                    <th className="px-5 py-3 font-medium text-right">{t('customers.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <UserRound className="w-4 h-4" />
                          </span>
                          <span className="font-medium text-foreground">{c.firstName} {c.lastName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{c.documentId ?? '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <div className="flex items-center gap-3 flex-wrap">
                          {c.email && (
                            <span className="flex items-center gap-1 text-xs"><Mail className="w-3.5 h-3.5" /> {c.email}</span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1 text-xs"><Phone className="w-3.5 h-3.5" /> {c.phone}</span>
                          )}
                          {!c.email && !c.phone && '—'}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setModal({
                              id: c.id,
                              firstName: c.firstName,
                              lastName: c.lastName,
                              documentId: c.documentId ?? '',
                              email: c.email ?? '',
                              phone: c.phone ?? '',
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground text-xs font-medium transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> {t('customers.edit')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal: Nuevo / Editar Cliente */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">
                {modal.id ? t('customers.editTitle') : t('customers.createTitle')}
              </h3>
              <button type="button" onClick={() => setModal(null)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t('customers.firstName')}</label>
                <input
                  type="text"
                  value={modal.firstName}
                  onChange={(e) => setModal({ ...modal, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t('customers.lastName')}</label>
                <input
                  type="text"
                  value={modal.lastName}
                  onChange={(e) => setModal({ ...modal, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('customers.documentId')}</label>
              <input
                type="text"
                value={modal.documentId}
                onChange={(e) => setModal({ ...modal, documentId: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('customers.email')}</label>
              <input
                type="email"
                value={modal.email}
                onChange={(e) => setModal({ ...modal, email: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('customers.phone')}</label>
              <input
                type="tel"
                value={modal.phone}
                onChange={(e) => setModal({ ...modal, phone: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {t('customers.cancel')}
              </button>
              <button
                type="submit"
                disabled={saveCustomer.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-sm font-medium text-primary-foreground rounded-lg transition-colors"
              >
                {saveCustomer.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('customers.saving')}</>
                ) : (
                  <>{t('customers.save')}</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}