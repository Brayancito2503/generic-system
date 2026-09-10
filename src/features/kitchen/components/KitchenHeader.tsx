'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';

interface KitchenHeaderProps {
    activeOrdersCount: number;
    avgPrepTime: string;
    activeFilter: string;
    onFilterChange: (filter: string) => void;
}

export const KitchenHeader: React.FC<KitchenHeaderProps> = ({ activeOrdersCount, avgPrepTime, activeFilter, onFilterChange }) => {
    const t = useTranslations('kitchenPage');

    const filters = [
        { id: 'all', label: t('filters.all') },
        { id: 'coldStation', label: t('filters.coldStation') },
        { id: 'grill', label: t('filters.grill') },
        { id: 'desserts', label: t('filters.desserts') }
    ];

    return (
        <header className="min-h-16 py-3 lg:py-0 lg:h-16 flex flex-col lg:flex-row items-start lg:items-center justify-between px-6 border-b border-border-light dark:border-[#28392e] bg-surface-light dark:bg-[#111813] shrink-0 gap-4 overflow-x-auto">
            {/* Title & Subtitle */}
            <div className="flex flex-col shrink-0">
                <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    {t('title')}
                    <span className="bg-primary/20 text-green-700 dark:text-primary text-xs px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap">
                        {t('liveBadge')}
                    </span>
                </h2>
                <p className="text-slate-500 dark:text-[#9db9a6] text-sm">
                    {t('subtitle', { count: activeOrdersCount })}
                </p>
            </div>

            {/* Stats & Actions */}
            <div className="flex items-center gap-4 lg:gap-8 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
                {/* Stats */}
                <div className="flex gap-4 lg:gap-6 border-x border-border-light dark:border-[#28392e] px-4 lg:px-8 py-1 hidden sm:flex shrink-0">
                    <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-[#9db9a6] uppercase tracking-widest">{t('avgPrep')}</p>
                        <p className="text-lg lg:text-xl font-black dark:text-white">{avgPrepTime}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-[#9db9a6] uppercase tracking-widest">{t('tickets')}</p>
                        <p className="text-lg lg:text-xl font-black text-primary">{activeOrdersCount}</p>
                    </div>
                </div>

                {/* Filters & Notifications */}
                <div className="flex items-center gap-2 lg:gap-4 shrink-0 justify-between flex-1 lg:flex-none">
                    <div className="flex p-1 bg-slate-100 dark:bg-[#1c271f] rounded-lg overflow-x-auto">
                        {filters.map(f => (
                            <button
                                key={f.id}
                                onClick={() => onFilterChange(f.id)}
                                className={clsx(
                                    "px-3 lg:px-4 py-1.5 text-xs lg:text-sm font-semibold transition-all rounded-md whitespace-nowrap",
                                    activeFilter === f.id
                                        ? "bg-white dark:bg-[#28392e] shadow-sm text-slate-900 dark:text-white"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <button className="flex items-center justify-center size-10 shrink-0 rounded-lg border border-slate-200 dark:border-[#28392e] hover:bg-slate-50 dark:hover:bg-[#28392e] text-slate-500 dark:text-slate-300 transition-colors">
                        <Bell className="size-5" />
                    </button>
                </div>
            </div>
        </header>
    );
};
