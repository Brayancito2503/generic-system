'use client';

import React from 'react';
import { Edit3, Trash2, Printer, Scissors, Save, ArrowRight } from 'lucide-react';

export interface OrderItem {
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    note?: string;
}

interface OrderSummaryProps {
    tableNumber: string;
    items: OrderItem[];
    taxRate: number;
    onRemoveItem: (id: string) => void;
    onSendToKitchen: () => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
    tableNumber,
    items,
    taxRate,
    onRemoveItem,
    onSendToKitchen
}) => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    return (
        <section className="flex flex-col flex-1 min-w-[360px] max-w-[480px] bg-white dark:bg-[#15261d] h-full shadow-2xl z-10 border-l border-slate-200 dark:border-surface-hover">
            {/* Order Header */}
            <div className="p-6 border-b border-slate-200 dark:border-surface-hover">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold dark:text-white">Table {tableNumber}</h2>
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/20">Dine-in</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <p>Order #1024</p>
                    <p>Waiter: Sarah</p>
                </div>
            </div>

            {/* Order List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-[#9db9a6] opacity-50">
                        <p className="text-sm">No items in order</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <div key={item.id} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-[#173920] transition-colors">
                            <div className="size-8 rounded-full bg-slate-100 dark:bg-primary text-slate-900 dark:text-white flex items-center justify-center font-bold text-sm border border-slate-200 dark:border-surface-hover shrink-0">
                                {item.quantity}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-medium text-slate-900 dark:text-white truncate">{item.name}</h4>
                                    <p className="font-bold text-slate-900 dark:text-white">C$ {(item.price * item.quantity).toFixed(2)}</p>
                                </div>
                                {item.note && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{item.note}</p>}
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary transition-colors">
                                        <Edit3 size={14} /> Add Note
                                    </button>
                                    <button
                                        onClick={() => onRemoveItem(item.id)}
                                        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-400 transition-colors ml-auto"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer / Totals */}
            <div className="mt-auto p-6 bg-slate-50 dark:bg-[#0c1610] border-t border-slate-200 dark:border-surface-hover">
                <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-sm text-slate-500 dark:text-[#9db9a6]">
                        <span>Subtotal</span>
                        <span>C$ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500 dark:text-[#9db9a6]">
                        <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
                        <span>C$ {tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-surface-hover border-dashed">
                        <span>Total</span>
                        <span>C$ {total.toFixed(2)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                    <button className="col-span-1 rounded-lg border border-slate-200 dark:border-surface-hover text-slate-600 dark:text-slate-300 hover:bg-ring py-3 font-medium text-sm flex flex-col items-center justify-center gap-1">
                        <Printer size={20} />
                        <span className="text-[10px] uppercase tracking-wide">Print</span>
                    </button>
                    <button className="col-span-1 rounded-lg border border-slate-200 dark:border-surface-hover text-slate-600 dark:text-slate-300 hover:bg-ring py-3 font-medium text-sm flex flex-col items-center justify-center gap-1">
                        <Scissors size={20} />
                        <span className="text-[10px] uppercase tracking-wide">Split</span>
                    </button>
                    <button className="col-span-2 rounded-lg border border-slate-200 dark:border-surface-hover text-slate-600 dark:text-slate-300 hover:bg-ring py-3 font-medium text-sm flex flex-col items-center justify-center gap-1">
                        <Save size={18} />
                        Save Draft
                    </button>
                </div>
                <button
                    onClick={onSendToKitchen}
                    disabled={items.length === 0}
                    className="w-full rounded-xl text-white bg-primary hover:bg-primary disabled:opacity-50 disabled:hover:bg-primary text-black py-4 text-base font-extrabold shadow-lg shadow-primary/20 transition-all active:scale-[0.98] uppercase tracking-wide flex items-center justify-center gap-2"
                >
                    <span>Enviar a Cocina</span>
                    <ArrowRight size={20} />
                </button>
            </div>
        </section>
    );
};
