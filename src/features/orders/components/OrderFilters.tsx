'use client';

import React from 'react';
import { clsx } from 'clsx';

interface OrderFiltersProps {
    counts: {
        available: number;
        occupied: number;
        pendingPayment: number;
    };
    activeFilter: 'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'PENDING_PAYMENT';
    onFilterChange: (filter: 'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'PENDING_PAYMENT') => void;
}

export const OrderFilters: React.FC<OrderFiltersProps> = ({ counts, activeFilter, onFilterChange }) => {
    return (
        <div className="flex flex-wrap gap-2">
            <button
                onClick={() => onFilterChange('ALL')}
                className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-95",
                    activeFilter === 'ALL'
                        ? "border-gray-500 bg-gray-500/20 text-gray-700 dark:text-gray-300"
                        : "border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400 hover:bg-gray-500/20"
                )}
            >
                <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                <span className="text-xs font-bold">Todas ({counts.available + counts.occupied + counts.pendingPayment})</span>
            </button>

            <button
                onClick={() => onFilterChange('AVAILABLE')}
                className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-95",
                    activeFilter === 'AVAILABLE'
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20"
                )}
            >
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-xs font-bold">Disponibles ({counts.available})</span>
            </button>

            <button
                onClick={() => onFilterChange('OCCUPIED')}
                className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-95",
                    activeFilter === 'OCCUPIED'
                        ? "border-red-500 bg-red-500/20 text-red-500"
                        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20"
                )}
            >
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-xs font-bold">Ocupadas ({counts.occupied})</span>
            </button>

            <button
                onClick={() => onFilterChange('PENDING_PAYMENT')}
                className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-95",
                    activeFilter === 'PENDING_PAYMENT'
                        ? "border-yellow-500 bg-yellow-500/20 text-yellow-500"
                        : "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20"
                )}
            >
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span className="text-xs font-bold">Pago Pendiente ({counts.pendingPayment})</span>
            </button>
        </div>
    );
};
