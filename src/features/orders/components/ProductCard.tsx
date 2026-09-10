'use client';

import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
    product: Product;
    onAdd: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAdd }) => {
    return (
        <button
            onClick={() => onAdd(product)}
            className="group flex flex-col bg-white dark:bg-[#111813] rounded-xl shadow-sm hover:shadow-md dark:shadow-none border dark:border-surface-hover hover:border-primary dark:hover:border-primary transition-all overflow-hidden text-left relative"
        >
            <div
                className="aspect-[4/3] w-full bg-cover bg-center"
                style={{ backgroundImage: `url("${product.image}")` }}
                aria-label={product.name}
            />
            <div className="p-4 flex flex-col gap-1">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
                    {product.name}
                </h3>
                <p className="text-slate-500 dark:text-[#9db9a6] text-sm font-medium">
                    C$ {product.price.toFixed(2)}
                </p>
            </div>
            <div className="absolute top-2 right-2 bg-chart-2 text-black text-xs font-bold px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                Add
            </div>
        </button>
    );
};
