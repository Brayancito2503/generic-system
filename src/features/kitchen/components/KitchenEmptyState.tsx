'use client';

import React from 'react';
import { ChefHat } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const KitchenEmptyState = () => {
    const t = useTranslations('kitchenPage.empty');

    return (
        <div className="w-80 flex flex-col justify-center items-center text-center p-8 border-2 border-dashed border-slate-300 dark:border-surface-hover rounded-xl text-slate-400 dark:text-slate-500">
            <ChefHat className="size-16 mb-4 text-slate-300 dark:text-surface-hover" strokeWidth={1.5} />
            <p className="font-medium text-slate-500 dark:text-slate-400">{t('message')}</p>
        </div>
    );
};
