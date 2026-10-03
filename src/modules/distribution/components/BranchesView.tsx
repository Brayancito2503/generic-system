'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Loader2, Building2, AlertCircle, X, MapPin } from 'lucide-react';
import type { BranchEntity } from '../entities';
import { apiGet, apiSend } from '../api';

interface BranchFormState {
  id?: string;
  name: string;
  address: string;
  /** Address as loaded, so an untouched field can be left out of the PATCH. */
  initialAddress: string;
}

const emptyForm: BranchFormState = {
  name: '',
  address: '',
  initialAddress: '',
};

export function BranchesView() {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<BranchFormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: branches = [], isPending } = useQuery<BranchEntity[]>({
    queryKey: ['branches'],
    queryFn: () => apiGet<BranchEntity[]>('/branches'),
  });

  const saveBranch = useMutation({
    mutationFn: (form: BranchFormState) => {
      const name = form.name.trim();
      const address = form.address.trim();

      if (!form.id) {
        return apiSend<BranchEntity>('/branches', 'POST', {
          name,
          address: address === '' ? null : address,
        });
      }

      // PATCH is partial, so the key is only sent when the operator actually
      // changed the address: absent means "leave the stored value alone",
      // while an explicit null means "clear it". Sending `''`-or-null blindly
      // would wipe the address of every branch whose form they merely opened.
      const payload: { name: string; address?: string | null } = { name };
      if (address !== form.initialAddress.trim()) {
        payload.address = address === '' ? null : address;
      }
      return apiSend<BranchEntity>(`/branches/${form.id}`, 'PATCH', payload);
    },
    onSuccess: () => {
      setModal(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error de solicitud'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    if (!modal.name.trim()) {
      setError(t('branches.invalidForm'));
      return;
    }
    saveBranch.mutate(modal);
  };

  return (
    <div className="p-6 space-y-6 text-foreground">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" /> {t('branches.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('branches.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ ...emptyForm })}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> {t('branches.newBranch')}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover-underline">{t('branches.closeError')}</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {isPending ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> {t('branches.loading')}
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">{t('branches.empty')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border bg-muted/40">
                <th className="px-5 py-3 font-medium">{t('branches.colName')}</th>
                <th className="px-5 py-3 font-medium">{t('branches.colAddress')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('branches.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <span className="font-medium text-foreground">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {b.address ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" /> {b.address}
                      </span>
                    ) : (
                      <span className="text-xs">{t('branches.noAddress')}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setModal({
                          id: b.id,
                          name: b.name,
                          address: b.address ?? '',
                          initialAddress: b.address ?? '',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground text-xs font-medium transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> {t('branches.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Nueva / Editar Sucursal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">
                {modal.id ? t('branches.editTitle') : t('branches.createTitle')}
              </h3>
              <button type="button" onClick={() => setModal(null)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('branches.name')}</label>
              <input
                type="text"
                value={modal.name}
                onChange={(e) => setModal({ ...modal, name: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('branches.address')}</label>
              <input
                type="text"
                value={modal.address}
                onChange={(e) => setModal({ ...modal, address: e.target.value })}
                placeholder={t('branches.addressPlaceholder')}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {t('branches.cancel')}
              </button>
              <button
                type="submit"
                disabled={saveBranch.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-sm font-medium text-primary-foreground rounded-lg transition-colors"
              >
                {saveBranch.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('branches.saving')}</>
                ) : (
                  <>{t('branches.save')}</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}