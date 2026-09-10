'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface OrderSearchProps {
    value: string;
    onChange: (value: string) => void;
}

export const OrderSearch: React.FC<OrderSearchProps> = ({ value, onChange }) => {
    return (
        <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-5" />
            <input
                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white dark:bg-[#1c271f] border border-border-light dark:border-[#3b5443] rounded-lg text-sm focus:outline-none focus:border-primary dark:text-white placeholder-gray-400 transition-colors"
                placeholder="Buscar mesa..."
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
};
