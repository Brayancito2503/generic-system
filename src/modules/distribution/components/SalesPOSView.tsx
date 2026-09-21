'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Loader2,
  Package,
  Banknote,
  CheckCircle2,
  User,
  UserPlus,
  X,
  Keyboard,
  Barcode,
} from 'lucide-react';
import type { InventoryStockItem, CustomerLight, SaleEntity, TaxRateEntity, PaymentMethod } from '../entities';
import { apiGet, apiSend } from '../api';
import { formatCurrency, formatSecondaryCurrency } from '../utils/currency';

interface CartLine {
  itemId: string;
  name: string;
  sku?: string | null;
  price: number;
  stock: number;
  quantity: number;
}

export function SalesPOSView() {
  const t = useTranslations('distributionModule');
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: tenantSettingsData } = useQuery<{ settings: { currencySymbol?: string; secondaryCurrency?: string; exchangeRate?: number } }>({
    queryKey: ['tenant-settings'],
    queryFn: () => apiGet<{ settings: { currencySymbol?: string; secondaryCurrency?: string; exchangeRate?: number } }>('/settings'),
  });

  const fmt = (n: number) => formatCurrency(n, tenantSettingsData?.settings);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountInput, setDiscountInput] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidInput, setPaidInput] = useState('');
  const [success, setSuccess] = useState<SaleEntity | null>(null);

  // Express customer modal state
  const [showExpressCustomerModal, setShowExpressCustomerModal] = useState(false);
  const [newCustFirstName, setNewCustFirstName] = useState('');
  const [newCustLastName, setNewCustLastName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustDocId, setNewCustDocId] = useState('');
  const [createCustPending, setCreateCustPending] = useState(false);
  const [createCustError, setCreateCustError] = useState<string | null>(null);

  const { data: items = [], isPending } = useQuery<InventoryStockItem[]>({
    queryKey: ['inventory'],
    queryFn: () => apiGet<InventoryStockItem[]>(`/inventory`),
  });

  const { data: customers = [] } = useQuery<CustomerLight[]>({
    queryKey: ['customers', customerQuery],
    queryFn: () => apiGet<CustomerLight[]>(`/customers?q=${encodeURIComponent(customerQuery)}`),
  });

  const { data: taxRates = [] } = useQuery<TaxRateEntity[]>({
    queryKey: ['tax-rates'],
    queryFn: () => apiGet<TaxRateEntity[]>(`/tax`),
  });

  const registerSale = useMutation({
    mutationFn: (payload: {
      lines: { itemId: string; quantity: number }[];
      discount: number;
      personId: string | null;
      notes: string;
      paymentMethod: PaymentMethod;
      paidAmount: number;
    }) => apiSend<SaleEntity>(`/sales`, 'POST', payload),
    onSuccess: (data) => {
      setSuccess(data);
      setCart([]);
      setDiscountInput('');
      setNotes('');
      setPaidInput('');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cash-session'] });
      queryClient.invalidateQueries({ queryKey: ['distribution-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tax-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
    },
  });

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.sku?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const addToCart = (item: InventoryStockItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        if (existing.quantity >= item.stock) return prev;
        return prev.map((c) =>
          c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { itemId: item.id, name: item.name, sku: item.sku, price: item.price, stock: item.stock, quantity: 1 }];
    });
  };

  const changeQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.itemId !== itemId) return c;
          const next = c.quantity + delta;
          if (next < 1) return c;
          return { ...c, quantity: Math.min(next, c.stock) };
        })
        .filter((c) => c.quantity > 0)
    );
  };

  const removeLine = (itemId: string) => setCart((prev) => prev.filter((c) => c.itemId !== itemId));

  const subtotal = cart.reduce((a, c) => a + c.price * c.quantity, 0);
  const discount = Math.min(Math.max(parseFloat(discountInput) || 0, 0), subtotal);
  const total = subtotal - discount;

  const defaultTaxRate = taxRates.find((t) => t.isDefault) ?? taxRates[0] ?? null;
  const ratePct = defaultTaxRate?.rate ?? 0;
  const ivaAmount = ratePct > 0 ? ((subtotal - discount) * ratePct) / (100 + ratePct) : 0;

  const PAYMENT_LABEL_KEYS: Record<PaymentMethod, string> = {
    CASH: 'sales.cash',
    CARD: 'sales.card',
    TRANSFER: 'sales.transfer',
    CREDIT: 'sales.credit',
  };

  const resolvedPaid =
    paymentMethod === 'CREDIT'
      ? 0
      : paidInput.trim() === ''
        ? total
        : Math.max(parseFloat(paidInput) || 0, 0);
  const previewChange = paymentMethod === 'CASH' && resolvedPaid > total ? resolvedPaid - total : 0;
  const previewBalance = Math.max(total - resolvedPaid, 0);
  const needsCustomer = previewBalance > 0 && !customerId;

  const canCheckout = cart.length > 0 && !registerSale.isPending && !needsCustomer;

  const handleCheckout = () => {
    if (!canCheckout) return;
    registerSale.mutate({
      lines: cart.map((c) => ({ itemId: c.itemId, quantity: c.quantity })),
      discount,
      personId: customerId || null,
      notes,
      paymentMethod,
      paidAmount: resolvedPaid,
    });
  };

  // Keyboard Shortcuts (F2: Checkout, F4: Focus Search, Esc: Clear Search / Close Modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (canCheckout) {
          handleCheckout();
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (showExpressCustomerModal) {
          setShowExpressCustomerModal(false);
        } else if (search) {
          setSearch('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCheckout, showExpressCustomerModal, search, cart, customerId, paymentMethod, paidInput, discount, notes]);

  // Barcode scanner handler: on Enter in search box, if SKU matches exact item, auto-add to cart
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      const trimmed = search.trim().toLowerCase();
      const match = items.find(
        (i) =>
          (i.sku && i.sku.toLowerCase() === trimmed) ||
          i.id.toLowerCase() === trimmed
      );
      if (match && match.stock > 0) {
        addToCart(match);
        setSearch('');
        e.preventDefault();
      }
    }
  };

  // Create Express Customer handler
  const handleCreateExpressCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustFirstName.trim() || !newCustLastName.trim()) return;
    setCreateCustPending(true);
    setCreateCustError(null);
    try {
      const newCust = await apiSend<CustomerLight>('/customers', 'POST', {
        firstName: newCustFirstName.trim(),
        lastName: newCustLastName.trim(),
        phone: newCustPhone.trim() || null,
        documentId: newCustDocId.trim() || null,
      });
      setCustomerId(newCust.id);
      setCustomerQuery(`${newCust.firstName} ${newCust.lastName}`);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowExpressCustomerModal(false);
      setNewCustFirstName('');
      setNewCustLastName('');
      setNewCustPhone('');
      setNewCustDocId('');
    } catch (err) {
      setCreateCustError(err instanceof Error ? err.message : 'Error al crear cliente');
    } finally {
      setCreateCustPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con Teclas Rápidas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-emerald-500" /> {t('sales.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('sales.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-lg shadow-2xs">
          <Keyboard className="w-4 h-4 text-primary shrink-0" />
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] font-semibold text-foreground">F4</kbd> Buscar</span>
          <span className="text-border">•</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] font-semibold text-foreground">F2</kbd> Facturar</span>
          <span className="text-border">•</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] font-semibold text-foreground">Esc</kbd> Limpiar</span>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3 text-emerald-600 dark:text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">
              {t('sales.saleRegistered', { invoice: success.invoiceNumber ?? '' })}
            </p>
            <p className="text-emerald-600/80 dark:text-emerald-400/80">
              {t('sales.inventoryUpdated', { total: fmt(success.total) })}
            </p>
            {success.balance > 0 && (
              <p className="text-emerald-600/80 dark:text-emerald-400/80">
                {t('sales.receivableCreated')} {t('sales.balanceDue')}: {fmt(success.balance)}
              </p>
            )}
          </div>
          <button onClick={() => setSuccess(null)} className="ml-auto text-muted-foreground hover:text-foreground text-xs">
            {t('sales.close')}
          </button>
        </div>
      )}

      {registerSale.isError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">
          {registerSale.error?.message ?? t('sales.saleError')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Productos */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={`${t('sales.searchProduct')} (escanee código de barras o use F4)`}
              className="w-full bg-card border border-border rounded-lg pl-10 pr-10 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
            <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          </div>

          {isPending ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> {t('sales.processing')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item)}
                  disabled={item.stock <= 0}
                  className={`group text-left bg-card border rounded-xl p-4 transition-all ${item.stock <= 0 ? 'border-border opacity-50 cursor-not-allowed' : 'border-border hover:border-primary hover:bg-accent/50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                      {item.sku && <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>}
                    </div>
                    <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{fmt(item.price)}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.isLowStock ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                      {t('sales.stock', { count: item.stock })}
                    </span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-full text-center py-10 text-muted-foreground text-sm">{t('sales.noResults')}</p>
              )}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="lg:col-span-5 bg-card border border-border rounded-xl p-5 space-y-4 sticky top-0 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-500" /> {t('sales.cartTitle')}
            </h2>
            <span className="text-xs text-muted-foreground">{t('sales.itemsCount', { count: cart.reduce((a, c) => a + c.quantity, 0) })}</span>
          </div>

          {cart.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              {t('sales.emptyCart')}
            </div>
          ) : (
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
              {cart.map((c) => (
                <div key={c.itemId} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(c.price)} × {c.quantity} = <span className="text-foreground font-semibold">{fmt(c.price * c.quantity)}</span></p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => changeQty(c.itemId, -1)} className="p-1 rounded-md bg-muted hover:bg-accent text-foreground"><Minus className="w-3 h-3" /></button>
                    <span className="w-6 text-center text-sm font-semibold text-foreground">{c.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(c.itemId, 1)}
                      disabled={c.quantity >= c.stock}
                      className="p-1 rounded-md bg-muted hover:bg-accent text-foreground disabled:opacity-40"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button type="button" onClick={() => removeLine(c.itemId)} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Cliente opcional con Modal "Cliente Express" */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="w-3.5 h-3.5" /> {t('sales.customerSelect')}
              </label>
              <button
                type="button"
                onClick={() => setShowExpressCustomerModal(true)}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <UserPlus className="w-3 h-3" /> + Cliente Express
              </button>
            </div>
            <input
              value={customerQuery}
              onChange={(e) => { setCustomerQuery(e.target.value); setCustomerId(''); }}
              placeholder={t('dashboard.customer')}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">{t('sales.anonymous')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}{c.documentId ? ` — ${c.documentId}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Método de pago: efectivo (con vuelto) / tarjeta / transferencia / crédito */}
          <div className="space-y-1.5">
            <label className="block text-xs text-muted-foreground">{t('sales.paymentMethod')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['CASH', 'CARD', 'TRANSFER', 'CREDIT'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setPaymentMethod(m); setPaidInput(''); }}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    paymentMethod === m
                      ? 'bg-primary text-primary-foreground border-primary font-semibold'
                      : 'bg-background border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {t(PAYMENT_LABEL_KEYS[m])}
                </button>
              ))}
            </div>
            {paymentMethod !== 'CREDIT' ? (
              <input
                type="number"
                min="0"
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
                placeholder={fmt(total)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            ) : (
              <p className="text-xs text-muted-foreground">{t('sales.creditHint')}</p>
            )}
          </div>

          {/* Descuento y notas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('sales.discountLabel')}</label>
              <input
                type="number"
                min="0"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0.00"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('sales.note')}</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('sales.noteOptional')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Totales */}
          <div className="space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('sales.subtotal')}</span>
              <span className="font-medium text-foreground">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>{t('sales.tax')}</span>
              <span>{fmt(ivaAmount)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-amber-500">
                <span>{t('sales.discount')}</span>
                <span>- {fmt(discount)}</span>
              </div>
            )}
            {paymentMethod !== 'CREDIT' && (
              <div className="flex justify-between text-muted-foreground">
                <span>{t('sales.received')}</span>
                <span className="font-medium text-foreground">{fmt(resolvedPaid)}</span>
              </div>
            )}
            {previewChange > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>{t('sales.change')}</span>
                <span>{fmt(previewChange)}</span>
              </div>
            )}
            {previewBalance > 0 && (
              <div className="flex justify-between text-amber-500">
                <span>{t('sales.balanceDue')}</span>
                <span>{fmt(previewBalance)}</span>
              </div>
            )}
            <div className="flex justify-between text-foreground font-bold text-lg pt-1">
              <span>{t('sales.total')}</span>
              <div className="text-right">
                <span>{fmt(total)}</span>
                {formatSecondaryCurrency(
                  total,
                  tenantSettingsData?.settings?.exchangeRate,
                  tenantSettingsData?.settings?.secondaryCurrency
                ) && (
                  <span className="block text-xs font-normal text-muted-foreground font-mono">
                    ≈ {formatSecondaryCurrency(
                      total,
                      tenantSettingsData?.settings?.exchangeRate,
                      tenantSettingsData?.settings?.secondaryCurrency
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={!canCheckout}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors shadow-xs"
          >
            {registerSale.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t('sales.processing')}</>
            ) : (
              <><Banknote className="w-4 h-4" /> {t('sales.processSale')} <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-emerald-700 rounded text-[10px] font-mono">F2</kbd></>
            )}
          </button>
          {needsCustomer && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('sales.balanceRequiresCustomer')}
            </p>
          )}
        </div>
      </div>

      {/* Modal: Crear Cliente Express */}
      {showExpressCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> Crear Cliente Express
              </h3>
              <button
                type="button"
                onClick={() => setShowExpressCustomerModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createCustError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
                {createCustError}
              </div>
            )}

            <form onSubmit={handleCreateExpressCustomer} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Nombre *</label>
                  <input
                    required
                    value={newCustFirstName}
                    onChange={(e) => setNewCustFirstName(e.target.value)}
                    placeholder="Ej. Juan"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Apellido *</label>
                  <input
                    required
                    value={newCustLastName}
                    onChange={(e) => setNewCustLastName(e.target.value)}
                    placeholder="Ej. Pérez"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Teléfono (opcional)</label>
                <input
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="Ej. +505 8888-8888"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Cédula / Identificación (opcional)</label>
                <input
                  value={newCustDocId}
                  onChange={(e) => setNewCustDocId(e.target.value)}
                  placeholder="Ej. 001-010190-0000A"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpressCustomerModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createCustPending}
                  className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {createCustPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Guardar y Seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}