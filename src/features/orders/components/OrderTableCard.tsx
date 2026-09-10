'use client';

import React from 'react';
import { Table, TableStatusEnum } from '@/types/tables';
import { User, Receipt, MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface OrderTableCardProps {
    table: Table & {
        currentOrder?: {
            totalAmount: number;
            startTime: string;
            customerCount: number;
        }
    };
    onClick?: () => void;
}

const DiningTableIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M22 10c0-1.66-4.48-3-10-3S2 8.34 2 10c0 1.5 3.65 2.76 8.5 2.97V17H8v2h8v-2h-2.5v-4.03c4.85-.21 8.5-1.47 8.5-2.97z" />
    </svg>
);

export const OrderTableCard: React.FC<OrderTableCardProps> = ({ table, onClick }) => {
    const isAvailable = table.status === TableStatusEnum.Available;
    const isOccupied = table.status === TableStatusEnum.Occupied;
    const isPendingPayment = table.status === TableStatusEnum.PendingPayment;

    return (
        <div
            onClick={onClick}
            className={twMerge(
                "group relative flex flex-col rounded-xl border p-0 overflow-hidden transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md h-40",
                isAvailable && "border-border-light dark:border-[#3b5443] bg-surface-light dark:bg-[#1c271f] hover:border-primary",
                isOccupied && "border-red-500/30 bg-surface-light dark:bg-[#1c271f] hover:border-red-500",
                isPendingPayment && "border-yellow-500/30 bg-surface-light dark:bg-[#1c271f] hover:border-yellow-500"
            )}
        >
            <div className="absolute top-0 right-0 p-3">
                <MoreVertical className={clsx(
                    "size-5 text-gray-400 transition-colors",
                    isAvailable && "group-hover:text-primary",
                    isOccupied && "group-hover:text-red-500",
                    isPendingPayment && "group-hover:text-yellow-500"
                )} />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-1 pt-4">
                {isAvailable && (
                    <div className="flex flex-col items-center gap-1 transition-transform group-hover:scale-110 duration-300 text-primary opacity-80">
                        <DiningTableIcon className="size-12" />
                        <h3 className="text-2xl font-bold dark:text-white">{table.tableNumber}</h3>
                    </div>
                )}

                {isOccupied && (
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 text-red-500 mb-1 transition-transform group-hover:scale-110 duration-300">
                            <User className="size-6 fill-current" />
                            <span className="text-xl font-bold">{table.currentOrder?.customerCount || 0}</span>
                        </div>
                        <h3 className="text-3xl font-bold dark:text-white">{table.tableNumber}</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Hace {table.currentOrder?.startTime || '0 min'}</span>
                    </div>
                )}

                {isPendingPayment && (
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 text-yellow-500 mb-1 transition-transform group-hover:scale-110 duration-300">
                            <Receipt className="size-6 fill-current" />
                            <span className="text-xl font-bold">C$ {table.currentOrder?.totalAmount.toFixed(2) || '0.00'}</span>
                        </div>
                        <h3 className="text-3xl font-bold dark:text-white">{table.tableNumber}</h3>
                    </div>
                )}
            </div>

            <div className={twMerge(
                "w-full py-2 border-t flex items-center justify-center gap-2",
                isAvailable && "bg-primary/10 dark:bg-primary/20 border-primary/20",
                isOccupied && "bg-red-500/10 dark:bg-red-900/20 border-red-500/20",
                isPendingPayment && "bg-yellow-500/10 dark:bg-yellow-900/20 border-yellow-500/20"
            )}>
                {isOccupied && <span className="w-2 h-2 rounded-full bg-red-50 animate-pulse bg-red-500" />}
                <span className={twMerge(
                    "text-xs font-bold uppercase tracking-wider",
                    isAvailable && "text-primary",
                    isOccupied && "text-red-600 dark:text-red-400",
                    isPendingPayment && "text-yellow-600 dark:text-yellow-400"
                )}>
                    {isAvailable && "Disponible"}
                    {isOccupied && "Ocupada"}
                    {isPendingPayment && "Pago Pendiente"}
                </span>
            </div>
        </div>
    );
};
