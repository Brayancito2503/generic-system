'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableStatusEnum } from '@/types/tables';
import { OrderActionBar } from './OrderActionBar';
import { OrderFilters } from './OrderFilters';
import { OrderSearch } from './OrderSearch';
import { OrderTableGrid } from './OrderTableGrid';
import { OrderTableCard } from './OrderTableCard';
import { OrderEntryView } from './OrderEntryView';
import { Table as TableIcon, LogOut } from 'lucide-react';

interface CurrentOrder {
    customerCount: number;
    startTime: string;
    totalAmount: number;
}

type TableWithCurrentOrder = Table & { currentOrder?: CurrentOrder };

// Datos de ejemplo iniciales
const DEFAULT_TABLES: TableWithCurrentOrder[] = [
    { tableId: 1, tableNumber: '01', capacity: 4, status: TableStatusEnum.Available },
    { tableId: 2, tableNumber: '02', capacity: 4, status: TableStatusEnum.Occupied, currentOrder: { customerCount: 2, startTime: '45 min', totalAmount: 0 } },
    { tableId: 3, tableNumber: '03', capacity: 2, status: TableStatusEnum.PendingPayment, currentOrder: { customerCount: 2, startTime: '1h', totalAmount: 45.00 } },
    { tableId: 4, tableNumber: '04', capacity: 4, status: TableStatusEnum.Available },
    { tableId: 5, tableNumber: '05', capacity: 6, status: TableStatusEnum.Occupied, currentOrder: { customerCount: 4, startTime: '12 min', totalAmount: 0 } },
    { tableId: 6, tableNumber: '06', capacity: 4, status: TableStatusEnum.Available },
    { tableId: 7, tableNumber: '07', capacity: 4, status: TableStatusEnum.Available },
    { tableId: 8, tableNumber: '08', capacity: 4, status: TableStatusEnum.Occupied, currentOrder: { customerCount: 3, startTime: '1h 10m', totalAmount: 0 } },
    { tableId: 9, tableNumber: '09', capacity: 4, status: TableStatusEnum.PendingPayment, currentOrder: { customerCount: 4, startTime: '2h', totalAmount: 128.50 } },
    { tableId: 10, tableNumber: '10', capacity: 2, status: TableStatusEnum.Available },
    { tableId: 11, tableNumber: '11', capacity: 2, status: TableStatusEnum.Available },
    { tableId: 12, tableNumber: '12', capacity: 4, status: TableStatusEnum.Available },
    { tableId: 13, tableNumber: '13', capacity: 4, status: TableStatusEnum.Available },
];

export const OrderManagementView: React.FC = () => {
    const [tables, setTables] = useState<TableWithCurrentOrder[]>(DEFAULT_TABLES);
    const [filter, setFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'PENDING_PAYMENT'>('ALL');
    const [search, setSearch] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);
    const [selectedTableNumber, setSelectedTableNumber] = useState<string | null>(null); // Added selectedTableNumber state

    // Cargar datos del localStorage al montar el componente
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const timer = window.setTimeout(() => {
            const savedTables = localStorage.getItem('dashboard_tables');
            if (savedTables) {
                try {
                    setTables(JSON.parse(savedTables) as TableWithCurrentOrder[]);
                } catch (error) {
                    console.error('Error parsing saved tables:', error);
                }
            }
            setIsLoaded(true);
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    // Guardar en localStorage cada vez que cambien las mesas
    useEffect(() => {
        if (isLoaded && typeof window !== 'undefined') {
            localStorage.setItem('dashboard_tables', JSON.stringify(tables));
        }
    }, [tables, isLoaded]);

    const handleAddTable = () => {
        const nextId = tables.length > 0 ? Math.max(...tables.map(t => t.tableId)) + 1 : 1;
        const nextNumber = (nextId).toString().padStart(2, '0');

        const newTable: Table = {
            tableId: nextId,
            tableNumber: nextNumber,
            capacity: 4,
            status: TableStatusEnum.Available
        };

        setTables([...tables, newTable]);
    };

    const filteredTables = tables.filter(table => {
        const matchesSearch = table.tableNumber.includes(search);
        const matchesFilter =
            filter === 'ALL' ||
            (filter === 'AVAILABLE' && table.status === TableStatusEnum.Available) ||
            (filter === 'OCCUPIED' && table.status === TableStatusEnum.Occupied) ||
            (filter === 'PENDING_PAYMENT' && table.status === TableStatusEnum.PendingPayment);
        return matchesSearch && matchesFilter;
    });

    const counts = {
        available: tables.filter(t => t.status === TableStatusEnum.Available).length,
        occupied: tables.filter(t => t.status === TableStatusEnum.Occupied).length,
        pendingPayment: tables.filter(t => t.status === TableStatusEnum.PendingPayment).length,
    };

    // Evitar desajustes de hidratación mostrando un estado consistente inicialmente
    if (!isLoaded) {
        return <div className="flex-1 bg-background-light dark:bg-background-dark h-full animate-pulse" />;
    }

    if (selectedTableNumber) {
        return (
            <OrderEntryView
                tableNumber={selectedTableNumber}
                onBack={() => setSelectedTableNumber(null)}
            />
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
            {/* Top Header */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-border-light dark:border-[#28392e] bg-surface-light dark:bg-[#111813] shrink-0">
                <div className="flex items-center gap-2">
                    <TableIcon className="text-primary size-6" />
                    <h2 className="text-lg font-bold leading-tight dark:text-white">Gestión de Mesas - Salón Principal</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-[#1c271f] rounded-lg">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-xs font-medium dark:text-gray-300">Sistema en línea</span>
                    </div>
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold transition-colors">
                        <LogOut className="size-5" />
                        <span>Salir</span>
                    </button>
                </div>
            </header>

            <OrderActionBar onNewTable={handleAddTable}>
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <OrderFilters
                        activeFilter={filter}
                        onFilterChange={setFilter}
                        counts={counts}
                    />
                    <OrderSearch value={search} onChange={setSearch} />
                </div>
            </OrderActionBar>

            <OrderTableGrid>
                {filteredTables.map(table => (
                    <OrderTableCard
                        key={`${table.tableId}-${table.tableNumber}`}
                        table={table}
                        onClick={() => setSelectedTableNumber(table.tableNumber)}
                    />
                ))}
            </OrderTableGrid>
        </div>
    );
};
