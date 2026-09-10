'use client';

import React, { useState } from 'react';
import { Search, Bell, Lock, ChevronLeft } from 'lucide-react';
import { MenuCategories } from './MenuCategories';
import { ProductCard } from './ProductCard';
import { OrderSummary, OrderItem } from './OrderSummary';
import { Product, Category } from '../types';

const MOCK_PRODUCTS: Product[] = [
    { id: '1', name: 'Steak Frites', price: 24.00, category: { id: '1', name: 'Mains' }, image: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?q=80&w=800&auto=format&fit=crop' },
    { id: '2', name: 'Grilled Salmon', price: 22.00, category: { id: '1', name: 'Mains' }, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=800&auto=format&fit=crop' },
    { id: '3', name: 'Carbonara', price: 18.00, category: { id: '1', name: 'Mains' }, image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?q=80&w=800&auto=format&fit=crop' },
    { id: '4', name: 'Caesar Salad', price: 14.00, category: { id: '2', name: 'Starters' }, image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?q=80&w=800&auto=format&fit=crop' },
    { id: '5', name: 'Roast Chicken', price: 20.00, category: { id: '1', name: 'Mains' }, image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?q=80&w=800&auto=format&fit=crop' },
    { id: '6', name: 'Veggie Burger', price: 16.00, category: { id: '1', name: 'Mains' }, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop' },
    { id: '7', name: 'Mushroom Soup', price: 12.00, category: { id: '2', name: 'Starters' }, image: 'https://images.unsplash.com/photo-1547592110-80399722b42a?q=80&w=800&auto=format&fit=crop' },
    { id: '8', name: 'Bruschetta', price: 10.00, category: { id: '2', name: 'Starters' }, image: 'https://images.unsplash.com/photo-1572656631137-7935297eff55?q=80&w=800&auto=format&fit=crop' },
];

import { Utensils, Beef, Wine, CakeSlice, Salad } from 'lucide-react';

const CATEGORIES: Category[] = [
    {
        id: 'starters',
        name: 'Starters',
        icon: Utensils,
        description: 'Entradas deliciosas para comenzar tu comida.',
        image: 'https://images.unsplash.com/photo-1556742400-9b8e7f8c79a0?q=80&w=800&auto=format&fit=crop',
        productsCount: 10,
    },
    {
        id: 'mains',
        name: 'Mains',
        icon: Beef,
        description: 'Platos principales sustanciosos y sabrosos.',
        image: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?q=80&w=800&auto=format&fit=crop',
        productsCount: 15,
    },
    {
        id: 'drinks',
        name: 'Drinks',
        icon: Wine,
        description: 'Bebidas refrescantes para acompañar tus platillos.',
        image: 'https://images.unsplash.com/photo-1590623641592-e6b83ef8cd92?q=80&w=800&auto=format&fit=crop',
        productsCount: 8,
    },
    {
        id: 'desserts',
        name: 'Desserts',
        icon: CakeSlice,
        description: 'Postres dulces para finalizar tu experiencia.',
        image: 'https://images.unsplash.com/photo-1570970817793-8f681cb9d9a4?q=80&w=800&auto=format&fit=crop',
        productsCount: 5,
    },
    {
        id: 'sides',
        name: 'Sides',
        icon: Salad,
        description: 'Acompañamientos perfectos para tus platillos principales.',
        image: 'https://images.unsplash.com/photo-1556742400-9b8e7f8c79a0?q=80&w=800&auto=format&fit=crop',
        productsCount: 6,
    },
];

interface OrderEntryViewProps {
    tableNumber: string;
    onBack: () => void;
}

export const OrderEntryView: React.FC<OrderEntryViewProps> = ({ tableNumber, onBack }) => {
    const [activeCategory, setActiveCategory] = useState('Mains');
    const [searchQuery, setSearchQuery] = useState('');
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

    // Lógica dinámica de impuestos (ej: 10% los fines de semana, 15% días de semana)
    const [taxRate] = useState(() => {
        const day = new Date().getDay();
        return (day === 0 || day === 6) ? 0.10 : 0.15;
    });

    const filteredProducts = MOCK_PRODUCTS.filter(p =>
        (activeCategory === 'All' || p.category.name === activeCategory) &&
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddProduct = (product: Product) => {
        setOrderItems(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                return prev.map(item =>
                    item.productId === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: 1
            }];
        });
    };

    const handleRemoveItem = (id: string) => {
        setOrderItems(prev => prev.filter(item => item.id !== id));
    };

    const handleSendToKitchen = () => {
        alert('Orden enviada a cocina para la Mesa ' + tableNumber);
        onBack();
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0c1610]">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-surface-hover bg-white dark:bg-[#111813] shrink-0">
                <div className="flex items-center gap-6">
                    <button
                        onClick={onBack}
                        className="flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-hover transition-colors text-slate-600 dark:text-slate-300"
                    >
                        <ChevronLeft />
                    </button>
                    <h2 className="text-xl font-bold tracking-tight dark:text-white">Order Entry</h2>
                    {/* Search Bar */}
                    <label className="relative flex items-center w-80">
                        <Search className="absolute left-3 text-slate-400 size-5" />
                        <input
                            className="w-full h-10 pl-10 pr-4 rounded-lg bg-slate-100 dark:bg-surface-dark border-none text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                            placeholder="Search menu items or codes..."
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </label>
                </div>
                <div className="flex items-center gap-4">
                    <button className="size-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:text-primary transition-colors">
                        <Bell size={20} />
                    </button>
                    <button className="size-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:text-primary transition-colors">
                        <Lock size={20} />
                    </button>
                    <div className="h-8 w-px bg-slate-200 dark:bg-surface-hover mx-2"></div>
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold dark:text-white">Shift #22</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">09:41 AM</p>
                    </div>
                </div>
            </header>

            {/* Split View Workspace */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Side: Product Menu */}
                <section className="flex flex-col flex-[2] min-w-0 border-r border-slate-200 dark:border-surface-hover">
                    <MenuCategories
                        categories={CATEGORIES}
                        activeCategory={activeCategory}
                        onCategoryChange={setActiveCategory}
                    />

                    {/* Products Grid */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-[#0c1610]">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map(product => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onAdd={handleAddProduct}
                                />
                            ))}
                        </div>
                    </div>
                </section>

                {/* Right Side: Order Summary */}
                <OrderSummary
                    tableNumber={tableNumber}
                    items={orderItems}
                    taxRate={taxRate}
                    onRemoveItem={handleRemoveItem}
                    onSendToKitchen={handleSendToKitchen}
                />
            </div>
        </div>
    );
};
