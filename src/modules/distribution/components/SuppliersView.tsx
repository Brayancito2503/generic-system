'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, Search, Phone, Mail, MapPin, FileText, CheckCircle, Clock, PackageCheck, X, Loader2 } from 'lucide-react';
import type { SupplierEntity, PurchaseOrderEntity } from '../entities';
import { apiGet, apiSend } from '../api';

const fmtLps = (n: number) => `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SuppliersView({ tenantId = 'distribuidora-demo' }: { tenantId?: string }) {
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
    queryKey: ['suppliers', tenantId],
    queryFn: () => apiGet<SupplierEntity[]>(`/suppliers?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const { data: orders = [], isPending: loadingOrders } = useQuery<PurchaseOrderEntity[]>({
    queryKey: ['purchase-orders', tenantId],
    queryFn: () => apiGet<PurchaseOrderEntity[]>(`/purchase-orders?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const createSupplier = useMutation({
    mutationFn: (payload: Omit<SupplierEntity, 'id' | 'tenantId' | 'isActive' | 'createdAt'>) =>
      apiSend<SupplierEntity>(`/suppliers?tenantId=${tenantId}`, 'POST', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers', tenantId] }),
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
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" /> Recibido
          </span>
        );
      case 'ORDERED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <PackageCheck className="w-3.5 h-3.5" /> En Tránsito
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Pendiente
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6 text-zinc-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Truck className="w-7 h-7 text-indigo-400" /> Proveedores & Órdenes de Compra
          </h1>
          <p className="text-sm text-zinc-400">
            Gestión de abastecimiento, catálogo de proveedores y recepción de mercancía.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddSupplierModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-medium text-sm text-white rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 space-x-6">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'suppliers'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Directorio de Proveedores ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'orders'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Órdenes de Compra ({orders.length})
        </button>
      </div>

      {loadingSuppliers || loadingOrders ? (
        <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando datos...
        </div>
      ) : (
        <>
          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar por empresa o contacto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Supplier Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSuppliers.map((sup) => (
                  <div
                    key={sup.id}
                    className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 hover:border-zinc-700 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-100">{sup.name}</h3>
                        {sup.contactName && (
                          <p className="text-xs text-zinc-400 mt-0.5">Contacto: {sup.contactName}</p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Activo
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-zinc-400 pt-2 border-t border-zinc-800/60">
                      {sup.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-zinc-500" /> {sup.phone}
                        </div>
                      )}
                      {sup.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-zinc-500" /> {sup.email}
                        </div>
                      )}
                      {sup.taxId && (
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-zinc-500" /> RUC: {sup.taxId}
                        </div>
                      )}
                      {sup.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500" /> {sup.address}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredSuppliers.length === 0 && (
                  <div className="col-span-full text-center py-12 text-zinc-500 text-sm">
                    No se encontraron proveedores.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Código Orden</th>
                    <th className="px-5 py-3">Proveedor</th>
                    <th className="px-5 py-3">Fecha Emisión</th>
                    <th className="px-5 py-3">Entrega Estimada</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {orders.map((po) => {
                    const sup = suppliers.find((s) => s.id === po.supplierId);
                    const createdStr = po.createdAt ? new Date(po.createdAt).toLocaleDateString() : '';
                    const expectedStr = po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A';
                    return (
                      <tr key={po.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-medium text-indigo-400">{po.orderNumber}</td>
                        <td className="px-5 py-3.5 font-medium text-zinc-100">{sup?.name || po.supplierName || 'Desconocido'}</td>
                        <td className="px-5 py-3.5 text-zinc-400">{createdStr}</td>
                        <td className="px-5 py-3.5 text-zinc-400">{expectedStr}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-emerald-400">
                          {fmtLps(po.total)}
                        </td>
                        <td className="px-5 py-3.5 text-center">{getStatusBadge(po.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {orders.length === 0 && (
                <div className="text-center py-12 text-zinc-500 text-sm">No hay órdenes de compra.</div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal Add Supplier */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white">Registrar Nuevo Proveedor</h2>
              <button
                onClick={() => setShowAddSupplierModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder="Ej: Distribuidora Central"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    value={newSupplier.contactName}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">RUC / ID Fiscal</label>
                  <input
                    type="text"
                    value={newSupplier.taxId}
                    onChange={(e) => setNewSupplier({ ...newSupplier, taxId: e.target.value })}
                    placeholder="0801..."
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder="+505..."
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder="ventas@empresa.com"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Dirección Física</label>
                <input
                  type="text"
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  placeholder="Zona o Colonia..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg text-zinc-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createSupplier.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-60"
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