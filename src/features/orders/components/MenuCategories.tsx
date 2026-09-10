'use client';

import React from 'react';
import { clsx } from 'clsx';
import { KeyIcon } from 'lucide-react';
import { Category } from '../types';

interface MenuCategoriesProps {
    categories: Category[];
    activeCategory: string;
    onCategoryChange: (category: string) => void;
}

export const MenuCategories: React.FC<MenuCategoriesProps> = ({
    categories,
    activeCategory,
    onCategoryChange
}) => {
    return (
        <div className="flex items-center gap-1 px-6 pt-4 pb-2 border-b border-slate-200 dark:border-surface-hover overflow-x-auto no-scrollbar bg-white dark:bg-[#111813] shrink-0">
            {categories.map((category) => (
                <button
                    key={category.name}
                    onClick={() => onCategoryChange(category.name)}
                    className={clsx(
                        "px-6 py-3 rounded-t-lg border-b-2 font-medium text-sm transition-all",
                        activeCategory === category.name
                            ? "border-primary text-primary font-bold bg-primary/5 dark:bg-surface-hover"
                            : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:bg-[#111813]"
                    )}
                >
                    {category.icon && (
                        <span className='flex items-center justify-center mb-1'>
                            <category.icon className='size-5' />
                        </span>
                    )}

                    {category.name}
                </button>
            ))}
        </div>
    );
};
