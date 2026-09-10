'use client';

import React, { useState } from 'react';
import { KitchenHeader } from './KitchenHeader';
import { KitchenOrderCard } from './KitchenOrderCard';
import { KitchenEmptyState } from './KitchenEmptyState';
import { KitchenOrder, OrderStatus } from '../types';
import { Button } from '@/components/ui/button';

// Mock Data representing live incoming orders
const MOCK_KITCHEN_ORDERS: KitchenOrder[] = [
    {
        id: '1',
        tableNumber: '04',
        waiterName: 'Juan',
        ticketNumber: '845',
        timeElapsed: '00:00',
        status: OrderStatus.Pending,
        items: [
            { id: 'i1', name: 'Pizza Margherita', quantity: 1, notes: 'Sin albahaca' },
            { id: 'i2', name: 'Ensalada César', quantity: 2 }
        ]
    },
    {
        id: '2',
        tableNumber: '05',
        waiterName: 'Carlos',
        ticketNumber: '921',
        timeElapsed: '02:15',
        status: OrderStatus.New,
        items: [
            { id: 'i3', name: 'Hamburguesa Deluxe', quantity: 2, notes: 'Sin cebolla, Término Medio' },
            { id: 'i4', name: 'Papas Trufadas', quantity: 1 },
            { id: 'i5', name: 'Soda Italiana', quantity: 2, notes: 'Fresa' }
        ]
    },
    {
        id: '3',
        tableNumber: '12',
        waiterName: 'Ana',
        ticketNumber: '918',
        timeElapsed: '09:42',
        status: OrderStatus.InProgress,
        items: [
            { id: 'i6', name: 'Ensalada César', quantity: 1, completed: true },
            { id: 'i7', name: 'Ribeye 400g', quantity: 1, notes: '3/4, Papas asadas' },
            { id: 'i8', name: 'Salmón Grill', quantity: 1, notes: 'Salsa en lado' }
        ]
    },
    {
        id: '4',
        tableNumber: 'Para Llevar',
        waiterName: 'Uber Eats',
        ticketNumber: 'UE-442',
        timeElapsed: '07:12',
        status: OrderStatus.InProgress,
        items: [
            { id: 'i9', name: 'Tacos al Pastor', quantity: 3, notes: 'Todo separado' },
            { id: 'i10', name: 'Guacamole', quantity: 1 }
        ]
    },
    {
        id: '5',
        tableNumber: 'Barra 02',
        waiterName: 'Juan',
        ticketNumber: '915',
        timeElapsed: '17:30',
        status: OrderStatus.Ready,
        items: [
            { id: 'i11', name: 'Nachos Supremos', quantity: 1, completed: true },
            { id: 'i12', name: 'Cerveza IPA', quantity: 2, completed: true }
        ]
    },
    {
        id: '6',
        tableNumber: 'Barra 02',
        waiterName: 'Juan',
        ticketNumber: '915',
        timeElapsed: '17:30',
        status: OrderStatus.Ready,
        items: [
            { id: 'i11', name: 'Nachos Supremos', quantity: 1, completed: true },
            { id: 'i12', name: 'Cerveza IPA', quantity: 2, completed: true }
        ]
    },
    {
        id: '7',
        tableNumber: 'Barra 02',
        waiterName: 'Juan',
        ticketNumber: '915',
        timeElapsed: '17:30',
        status: OrderStatus.Ready,
        items: [
            { id: 'i11', name: 'Nachos Supremos', quantity: 1, completed: true },
            { id: 'i12', name: 'Cerveza IPA', quantity: 2, completed: true }
        ]
    },
    {
        id: '8',
        tableNumber: 'Barra 02',
        waiterName: 'Juan',
        ticketNumber: '915',
        timeElapsed: '17:30',
        status: OrderStatus.Ready,
        items: [
            { id: 'i11', name: 'Nachos Supremos', quantity: 1, completed: true },
            { id: 'i12', name: 'Cerveza IPA', quantity: 2, completed: true }
        ]
    }
];

export const KitchenDisplayView: React.FC = () => {
    const [orders, setOrders] = useState<KitchenOrder[]>(MOCK_KITCHEN_ORDERS);
    const [activeFilter, setActiveFilter] = useState('all');

    const handleStatusChange = (orderId: string, nextStatus: OrderStatus) => {
        setOrders(prev => prev.map(order =>
            order.id === orderId ? { ...order, status: nextStatus } : order
        ));
    };

    const activeOrdersCount = orders.filter(o => o.status !== OrderStatus.Ready).length;

    // In a real app this would be calculated from order timestamps
    const avgPrepTime = '14:20';

    // Filter logic (mock implementation based on some item names for demonstration)
    const filteredOrders = orders.filter(order => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'coldStation') {
            return order.items.some(i => i.name.toLowerCase().includes('ensalada') || i.name.toLowerCase().includes('guacamole'));
        }
        if (activeFilter === 'grill') {
            return order.items.some(i => i.name.toLowerCase().includes('hamburguesa') || i.name.toLowerCase().includes('ribeye') || i.name.toLowerCase().includes('salmón') || i.name.toLowerCase().includes('pastor'));
        }
        if (activeFilter === 'desserts') {
            return order.items.some(i => i.name.toLowerCase().includes('helado') || i.name.toLowerCase().includes('pastel'));
        }
        return true;
    });

    return (
        <div className="flex-1 flex flex-col w-full h-full min-h-0 min-w-0 overflow-hidden bg-background-light dark:bg-[#102216] text-slate-900 dark:text-white">
            <KitchenHeader
                activeOrdersCount={activeOrdersCount}
                avgPrepTime={avgPrepTime}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
            />

            {/* KDS Grid */}
            <div className="flex-1 flex gap-6 p-6 overflow-x-auto overflow-y-hidden bg-slate-50 dark:bg-black/20">
                {filteredOrders.length > 0 ? (
                    filteredOrders.map(order => (
                        <KitchenOrderCard
                            key={order.id}
                            order={order}
                            onStatusChange={handleStatusChange}
                        />
                    ))
                ) : (
                    <KitchenEmptyState />
                )}
            </div>
        </div>
    );
};
