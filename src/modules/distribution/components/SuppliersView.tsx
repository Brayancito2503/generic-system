'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Truck, Plus, Search, Phone, Mail, MapPin, FileText, CheckCircle, Clock, PackageCheck, X, Loader2 } from 'lucide-react';
import type { SupplierEntity, PurchaseOrderEntity } from '../entities';
import { apiGet, apiSend } from '../api';

const fmtLps = (n: number) => `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SuppliersView() {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    taxId: '',
    address: '',
  });

  const { data: suppliers = [], isPending: loadingSuppliers } = useQuery<SupplierEntity[]>({
    queryKey: ['suppliers'],
    queryFn: () => apiGet<SupplierEntity[]>(`/suppliers`),
  });

  const { data: orders = [], isPending: loadingOrders } = useQuery<PurchaseOrderEntity[]>({
    queryKey: ['purchase-orders'],
    queryFn: () => apiGet<PurchaseOrderEntity[]>(`/purchase-orders`),
  });

  const createSupplier = useMutation({
    mutationFn: (payload: Omit<SupplierEntity, 'id' | 'tenantId' | 'isActive' | 'createdAt'>) =>
      apiSend<SupplierEntity>(`/suppliers`, 'POST', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.contactName && s.contactName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name) return;
    createSupplier.mutate({
      name: newSupplier.name,
      contactName: newSupplier.contactName || null,
      phone: newSupplier.phone || null,
      email: newSupplier.email || null,
      taxId: newSupplier.taxId || null,
      address: newSupplier.address || null,
    });
    setShowAddSupplierModal(false);
    setNewSupplier({ name: '', contactName: '', phone: '', email: '', taxId: '', address: '' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" /> {t('suppliers.received')}
          </span>
        );
      case 'ORDERED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-primary border border-primary/20">
            <PackageCheck className="w-3.5 h-3.5" /> {t('suppliers.ordered')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> {t('suppliers.pending')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" /> {t('suppliers.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('suppliers.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddSupplierModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 font-medium text-sm text-primary-foreground rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> {t('suppliers.newSupplier')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border space-x-6">
        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'suppliers'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('suppliers.supplier')}s ({suppliers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'orders'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('suppliers.newOrder')}s ({orders.length})
        </button>
      </div>

      {loadingSuppliers || loadingOrders ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('sales.processing')}
        </div>
      ) : (
        <>
          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por empresa o contacto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Supplier Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSuppliers.map((sup) => (
                  <div
                    key={sup.id}
                    className="bg-card border border-border rounded-xl p-5 hover:border-accent transition-all space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{sup.name}</h3>
                        {sup.contactName && (
                          <p className="text-xs text-muted-foreground mt-0.5">{t('suppliers.contact')}: {sup.contactName}</p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {t('employees.active')}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border">
                      {sup.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {sup.phone}
                        </div>
                      )}
                      {sup.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" /> {sup.email}
                        </div>
                      )}
                      {sup.taxId && (
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" /> RUC: {sup.taxId}
                        </div>
                      )}
                      {sup.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {sup.address}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredSuppliers.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
                    No se encontraron proveedores.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-sm text-foreground">
                <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">{t('suppliers.orderNumber')}</th>
                    <th className="px-5 py-3">{t('suppliers.supplier')}</th>
                    <th className="px-5 py-3">{t('dashboard.date')}</th>
                    <th className="px-5 py-3">Entrega Estimada</th>
                    <th className="px-5 py-3 text-right">{t('suppliers.orderTotal')}</th>
                    <th className="px-5 py-3 text-center">{t('suppliers.orderStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((po) => {
                    const sup = suppliers.find((s) => s.id === po.supplierId);
                    const createdStr = po.createdAt ? new Date(po.createdAt).toLocaleDateString() : '';
                    const expectedStr = po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A';
                    return (
                      <tr key={po.id} className="hover:bg-accent/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-medium text-primary">{po.orderNumber}</td>
                        <td className="px-5 py-3.5 font-medium text-foreground">{sup?.name || po.supplierName || 'Desconocido'}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{createdStr}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{expectedStr}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {fmtLps(po.total)}
                        </td>
                        <td className="px-5 py-3.5 text-center">{getStatusBadge(po.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {orders.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">No hay órdenes de compra.</div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal Add Supplier */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{t('suppliers.newSupplier')}</h2>
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder="Ej: Distribuidora Central"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    value={newSupplier.contactName}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">RUC / ID Fiscal</label>
                  <input
                    type="text"
                    value={newSupplier.taxId}
                    onChange={(e) => setNewSupplier({ ...newSupplier, taxId: e.target.value })}
                    placeholder="0801..."
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder="+505..."
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder="ventas@empresa.com"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Dirección Física</label>
                <input
                  type="text"
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  placeholder="Zona o Colonia..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-accent text-xs font-semibold rounded-lg text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createSupplier.isPending}
                  className="px-4 py-2 bg-primary hover:opacity-90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60 shadow-xs"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}