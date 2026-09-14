'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Truck, Plus, Search, Phone, Mail, MapPin, FileText, CheckCircle, Clock, PackageCheck, PackageOpen,
  X, Loader2, Trash2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import type { SupplierEntity, PurchaseOrderEntity, PurchaseOrderItemEntity, InventoryStockItem, CashSessionEntity } from '../entities';
import { apiGet, apiSend } from '../api';

const fmtLps = (n: number) => `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface OrderLine {
  itemId: string;
  itemName: string;
  quantity: string;
}

const emptyNewSupplier = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  taxId: '',
  address: '',
};

export default function SuppliersView() {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState(emptyNewSupplier);

  // PO create flow
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [orderForm, setOrderForm] = useState({ supplierId: '', notes: '', expectedDate: '' });
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [pickerItemId, setPickerItemId] = useState('');
  const [pickerQty, setPickerQty] = useState('');

  // PO receive flow
  const [receiveFor, setReceiveFor] = useState<PurchaseOrderEntity | null>(null);
  const [receiveLines, setReceiveLines] = useState<OrderLine[]>([]);
  const [receivePickerItemId, setReceivePickerItemId] = useState('');
  const [receivePickerQty, setReceivePickerQty] = useState('');

  // GET /purchase-orders omits line items; create/receive responses include
  // them, so cache the item payloads client-side per order for the receive UI.
  const [knownItems, setKnownItems] = useState<Record<string, PurchaseOrderItemEntity[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: suppliers = [], isPending: loadingSuppliers } = useQuery<SupplierEntity[]>({
    queryKey: ['suppliers'],
    queryFn: () => apiGet<SupplierEntity[]>(`/suppliers`),
  });

  const { data: orders = [], isPending: loadingOrders } = useQuery<PurchaseOrderEntity[]>({
    queryKey: ['purchase-orders'],
    queryFn: () => apiGet<PurchaseOrderEntity[]>(`/purchase-orders`),
  });

  const { data: inventory = [] } = useQuery<InventoryStockItem[]>({
    queryKey: ['inventory'],
    queryFn: () => apiGet<InventoryStockItem[]>(`/inventory`),
  });

  // Shared cache with CashRegisterView; used to derive the tenant branch when
  // no purchase order exists yet (there is no branch-listing endpoint).
  const { data: cashSession } = useQuery<CashSessionEntity | null>({
    queryKey: ['cash-session'],
    queryFn: () => apiGet<CashSessionEntity | null>(`/cash`),
  });

  // branchId always comes from server data (existing order or open cash
  // session) — never from client input.
  const branchId = orders.find((o) => o.branchId)?.branchId ?? cashSession?.branchId ?? '';

  const createSupplier = useMutation({
    mutationFn: (payload: Omit<SupplierEntity, 'id' | 'tenantId' | 'isActive' | 'createdAt'>) =>
      apiSend<SupplierEntity>(`/suppliers`, 'POST', payload),
    onSuccess: () => {
      setShowAddSupplierModal(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error de solicitud'),
  });

  const createOrder = useMutation({
    mutationFn: (payload: {
      supplierId: string;
      branchId: string;
      items: { itemId: string; quantity: number }[];
      notes?: string;
      expectedDate?: Date;
    }) => apiSend<PurchaseOrderEntity>(`/purchase-orders`, 'POST', payload),
    onSuccess: (data) => {
      setShowCreateOrder(false);
      setOrderForm({ supplierId: '', notes: '', expectedDate: '' });
      setOrderLines([]);
      setPickerItemId('');
      setPickerQty('');
      setError(null);
      if (data.items && data.items.length > 0) {
        const items = data.items;
        setKnownItems((prev) => ({ ...prev, [data.id]: items }));
      }
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error al crear la orden'),
  });

  const receiveOrder = useMutation({
    mutationFn: (payload: { id: string; receivedItems: { itemId: string; quantity: number }[] }) =>
      apiSend<PurchaseOrderEntity>(`/purchase-orders/${payload.id}/receive`, 'POST', { receivedItems: payload.receivedItems }),
    onSuccess: (data) => {
      setReceiveFor(null);
      setReceiveLines([]);
      setError(null);
      if (data.items && data.items.length > 0) {
        const items = data.items;
        setKnownItems((prev) => ({ ...prev, [data.id]: items }));
      }
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setSuccess(t('suppliers.receiveSuccess'));
      setTimeout(() => setSuccess(null), 3000);
    },
    // 409 over-receive (server message) and 400 product-not-in-PO surface here.
    onError: (e) => setError(e instanceof Error ? e.message : 'Error al recibir la orden'),
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
    setNewSupplier(emptyNewSupplier);
  };

  const handleAddOrderLine = () => {
    const item = inventory.find((i) => i.id === pickerItemId);
    const qty = parseInt(pickerQty, 10);
    if (!item) {
      setError(t('suppliers.needsItem'));
      return;
    }
    if (!pickerQty || Number.isNaN(qty) || qty <= 0) {
      setError(t('suppliers.invalidQty'));
      return;
    }
    setError(null);
    setOrderLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === item.id ? { ...l, quantity: String(Number(l.quantity) + qty) } : l
        );
      }
      return [...prev, { itemId: item.id, itemName: item.name, quantity: String(qty) }];
    });
    setPickerItemId('');
    setPickerQty('');
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.supplierId) {
      setError(t('suppliers.needsSupplier'));
      return;
    }
    if (orderLines.length === 0) {
      setError(t('suppliers.needsItem'));
      return;
    }
    const items = orderLines
      .map((l) => ({ itemId: l.itemId, quantity: parseInt(l.quantity, 10) }))
      .filter((l) => !Number.isNaN(l.quantity) && l.quantity > 0);
    if (items.length === 0) {
      setError(t('suppliers.invalidQty'));
      return;
    }
    createOrder.mutate({
      supplierId: orderForm.supplierId,
      branchId,
      items,
      ...(orderForm.notes.trim() ? { notes: orderForm.notes.trim() } : {}),
      ...(orderForm.expectedDate ? { expectedDate: new Date(orderForm.expectedDate) } : {}),
    });
  };

  const openReceive = (po: PurchaseOrderEntity) => {
    const items = po.items ?? knownItems[po.id] ?? [];
    if (items.length > 0) {
      setReceiveLines(
        items.map((li) => ({
          itemId: li.itemId,
          itemName: li.itemName,
          quantity: String(Math.max(li.quantity - li.receivedQty, 0)),
        }))
      );
    } else {
      // No line detail available (pre-existing order): fall back to the
      // inventory picker; the server enforces PO membership / over-receive.
      setReceiveLines([]);
    }
    setReceivePickerItemId('');
    setReceivePickerQty('');
    setReceiveFor(po);
  };

  const handleAddReceiveLine = () => {
    const item = inventory.find((i) => i.id === receivePickerItemId);
    const qty = parseInt(receivePickerQty, 10);
    if (!item) {
      setError(t('suppliers.needsItem'));
      return;
    }
    if (!receivePickerQty || Number.isNaN(qty) || qty <= 0) {
      setError(t('suppliers.invalidQty'));
      return;
    }
    setError(null);
    setReceiveLines((prev) => [...prev, { itemId: item.id, itemName: item.name, quantity: String(qty) }]);
    setReceivePickerItemId('');
    setReceivePickerQty('');
  };

  const handleReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveFor) return;
    const receivedItems = receiveLines
      .map((l) => ({ itemId: l.itemId, quantity: parseInt(l.quantity, 10) }))
      .filter((l) => !Number.isNaN(l.quantity) && l.quantity > 0);
    if (receivedItems.length === 0) {
      setError(t('suppliers.invalidQty'));
      return;
    }
    receiveOrder.mutate({ id: receiveFor.id, receivedItems });
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

  const itemCountFor = (po: PurchaseOrderEntity) =>
    po.items?.length ?? knownItems[po.id]?.length ?? null;

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

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:underline">{t('suppliers.closeError')}</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-500 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {success}
        </div>
      )}

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
          {t('suppliers.tabSuppliers')} ({suppliers.length})
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
          {t('suppliers.tabOrders')} ({orders.length})
        </button>
      </div>

      {loadingSuppliers || loadingOrders ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('suppliers.loading')}
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
                  placeholder={t('suppliers.searchPlaceholder')}
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
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" /> {t('suppliers.taxId')}: {sup.taxId}
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
                    {t('suppliers.emptySuppliers')}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateOrder(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 font-medium text-sm text-primary-foreground rounded-lg transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" /> {t('suppliers.createOrder')}
                </button>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-sm text-foreground">
                  <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">{t('suppliers.orderNumber')}</th>
                      <th className="px-5 py-3">{t('suppliers.supplier')}</th>
                      <th className="px-5 py-3">{t('dashboard.date')}</th>
                      <th className="px-5 py-3">{t('suppliers.expectedDelivery')}</th>
                      <th className="px-5 py-3 text-center">{t('suppliers.colItems')}</th>
                      <th className="px-5 py-3 text-right">{t('suppliers.orderTotal')}</th>
                      <th className="px-5 py-3 text-center">{t('suppliers.orderStatus')}</th>
                      <th className="px-5 py-3 text-right">{t('suppliers.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((po) => {
                      const sup = suppliers.find((s) => s.id === po.supplierId);
                      const createdStr = po.createdAt ? new Date(po.createdAt).toLocaleDateString() : '';
                      const expectedStr = po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '—';
                      const itemCount = itemCountFor(po);
                      return (
                        <tr key={po.id} className="hover:bg-accent/40 transition-colors">
                          <td className="px-5 py-3.5 font-mono font-medium text-primary">{po.orderNumber}</td>
                          <td className="px-5 py-3.5 font-medium text-foreground">{sup?.name || po.supplierName || t('suppliers.unknownSupplier')}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{createdStr}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{expectedStr}</td>
                          <td className="px-5 py-3.5 text-center text-muted-foreground">{itemCount ?? '—'}</td>
                          <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {fmtLps(po.total)}
                          </td>
                          <td className="px-5 py-3.5 text-center">{getStatusBadge(po.status)}</td>
                          <td className="px-5 py-3.5 text-right">
                            {po.status === 'ORDERED' && (
                              <button
                                type="button"
                                onClick={() => openReceive(po)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground text-xs font-medium transition-colors"
                              >
                                <PackageOpen className="w-3.5 h-3.5" /> {t('suppliers.receive')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {orders.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">{t('suppliers.emptyOrders')}</div>
                )}
              </div>
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
                <label className="text-xs text-muted-foreground block mb-1">{t('suppliers.supplierName')} *</label>
                <input
                  type="text"
                  required
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder={t('suppliers.supplierNamePlaceholder')}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('suppliers.contactName')}</label>
                  <input
                    type="text"
                    value={newSupplier.contactName}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                    placeholder={t('suppliers.contactNamePlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('suppliers.taxIdLabel')}</label>
                  <input
                    type="text"
                    value={newSupplier.taxId}
                    onChange={(e) => setNewSupplier({ ...newSupplier, taxId: e.target.value })}
                    placeholder={t('suppliers.taxIdPlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('suppliers.phone')}</label>
                  <input
                    type="text"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder={t('suppliers.phonePlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('suppliers.email')}</label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder={t('suppliers.emailPlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t('suppliers.address')}</label>
                <input
                  type="text"
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  placeholder={t('suppliers.addressPlaceholder')}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-accent text-xs font-semibold rounded-lg text-foreground transition-colors"
                >
                  {t('suppliers.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createSupplier.isPending}
                  className="px-4 py-2 bg-primary hover:opacity-90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60 shadow-xs"
                >
                  {t('suppliers.saveSupplier')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Create Order */}
      {showCreateOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateOrder} className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{t('suppliers.orderTitle')}</h2>
              <button
                type="button"
                onClick={() => setShowCreateOrder(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!branchId && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                {t('suppliers.noBranchHint')}
              </p>
            )}

            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('suppliers.selectSupplier')} *</label>
              <select
                value={orderForm.supplierId}
                onChange={(e) => setOrderForm({ ...orderForm, supplierId: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">{t('suppliers.selectSupplierPlaceholder')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Order lines */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('suppliers.item')}s</p>
              {orderLines.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('suppliers.addLineHint')}</p>
              )}
              {orderLines.map((line) => (
                <div key={line.itemId} className="flex items-center justify-between gap-3 bg-muted/30 border border-border rounded-lg px-3 py-2">
                  <span className="text-sm text-foreground truncate">{line.itemName}</span>
                  <span className="font-mono text-sm text-primary font-semibold">x{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setOrderLines((prev) => prev.filter((l) => l.itemId !== line.itemId))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t('suppliers.cancel')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <select
                  value={pickerItemId}
                  onChange={(e) => setPickerItemId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">{t('suppliers.item')}...</option>
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.sku ?? i.id.slice(0, 6)})</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={pickerQty}
                  onChange={(e) => setPickerQty(e.target.value)}
                  placeholder="1"
                  className="w-20 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleAddOrderLine}
                  className="px-3 py-2 bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground rounded-lg transition-colors"
                  aria-label={t('suppliers.addItem')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t('suppliers.expectedDate')}</label>
                <input
                  type="date"
                  value={orderForm.expectedDate}
                  onChange={(e) => setOrderForm({ ...orderForm, expectedDate: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t('suppliers.orderNotes')}</label>
                <input
                  type="text"
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCreateOrder(false)}
                className="px-4 py-2 bg-muted hover:bg-accent text-xs font-semibold rounded-lg text-foreground transition-colors"
              >
                {t('suppliers.cancel')}
              </button>
              <button
                type="submit"
                disabled={createOrder.isPending || !branchId || !orderForm.supplierId || orderLines.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60 shadow-xs"
              >
                {createOrder.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t('suppliers.createOrder')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Receive Order */}
      {receiveFor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleReceive} className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">{t('suppliers.receiveTitle')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {receiveFor.orderNumber} · {receiveFor.supplierName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiveFor(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {receiveLines.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('suppliers.addLineHint')}</p>
              )}
              {receiveLines.map((line, idx) => {
                const known = (receiveFor.items ?? knownItems[receiveFor.id] ?? []).find((li) => li.itemId === line.itemId);
                return (
                  <div key={line.itemId} className="flex items-center justify-between gap-3 bg-muted/30 border border-border rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{line.itemName}</p>
                      {known && (
                        <p className="text-xs text-muted-foreground">
                          {t('suppliers.remaining')}: {Math.max(known.quantity - known.receivedQty, 0)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {known && (
                        <span className="text-xs text-muted-foreground">
                          {t('suppliers.receivedQty')}
                        </span>
                      )}
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={line.quantity}
                        onChange={(e) =>
                          setReceiveLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))
                        }
                        className="w-20 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setReceiveLines((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t('suppliers.cancel')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <select
                  value={receivePickerItemId}
                  onChange={(e) => setReceivePickerItemId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">{t('suppliers.item')}...</option>
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.sku ?? i.id.slice(0, 6)})</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={receivePickerQty}
                  onChange={(e) => setReceivePickerQty(e.target.value)}
                  placeholder="1"
                  className="w-20 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleAddReceiveLine}
                  className="px-3 py-2 bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground rounded-lg transition-colors"
                  aria-label={t('suppliers.addItem')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setReceiveFor(null)}
                className="px-4 py-2 bg-muted hover:bg-accent text-xs font-semibold rounded-lg text-foreground transition-colors"
              >
                {t('suppliers.cancel')}
              </button>
              <button
                type="submit"
                disabled={receiveOrder.isPending || receiveLines.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60 shadow-xs"
              >
                <PackageOpen className="w-3.5 h-3.5" />
                {receiveOrder.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('suppliers.confirmReceive')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}