import React from 'react';

export interface Product {
    id: string;
    name: string;
    price: number;
    image: string;
    category: Category;
}


export interface Category {
    id: string;
    name: string;
    icon?: React.ElementType;
    description?: string;
    image?: string;
    productsCount?: number;
}