'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface OrderActionBarProps {
    children: React.ReactNode;
    onNewTable?: () => void;
}

export const OrderActionBar: React.FC<OrderActionBarProps> = ({ children, onNewTable }) => {
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 shrink-0">
            {children}
            <button
                onClick={onNewTable}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-secondary hover:bg-[#58c384] rounded-lg font-bold text-sm shadow-lg shadow-primary/20 transition-all active:scale-95 whitespace-nowrap"
            >
                <Plus className="size-5 fill-current" />
                Nueva Mesa
            </button>
        </div>
    );
};
