'use client';

import React from 'react';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';
import { KitchenOrder, OrderStatus } from '../types';
import { Check, CheckCircle2, History, Play } from 'lucide-react';

interface KitchenOrderCardProps {
    order: KitchenOrder;
    onStatusChange?: (orderId: string, nextStatus: OrderStatus) => void;
}

export const KitchenOrderCard: React.FC<KitchenOrderCardProps> = ({ order, onStatusChange }) => {
    const t = useTranslations('kitchenPage');

    // Mapeo dinámico de colores y estilos según el estado
    const getStatusStyles = () => {
        switch (order.status) {
            case OrderStatus.Pending:
                return {
                    border: 'border-slate-400 dark:border-slate-500',
                    headerBg: '',
                    badgeBg: 'bg-slate-400 dark:bg-slate-500',
                    badgeText: 'text-white',
                    timerText: 'text-slate-700 dark:text-slate-400',
                    pulse: false,
                    ring: ''
                };
            case OrderStatus.New:
                return {
                    border: 'border-red-500',
                    headerBg: 'bg-red-50 dark:bg-red-900/10',
                    badgeBg: 'bg-red-500',
                    badgeText: 'text-white',
                    timerText: 'text-red-600 dark:text-red-400',
                    pulse: true, 
                    ring: 'ring-2 ring-red-500/20'
                };
            case OrderStatus.InProgress:
                return {
                    border: 'border-yellow-400',
                    headerBg: '',
                    badgeBg: 'bg-yellow-400',
                    badgeText: 'text-black',
                    timerText: 'text-slate-700 dark:text-yellow-400',
                    pulse: false,
                    ring: ''
                };
            case OrderStatus.Ready:
                return {
                    border: 'border-primary',
                    headerBg: 'bg-green-50 dark:bg-[#111813]', // Usando variables oscuras para consistencia
                    badgeBg: 'bg-primary',
                    badgeText: 'text-black',
                    timerText: 'text-green-600 dark:text-primary',
                    pulse: false,
                    ring: ''
                };
            default:
                return {
                    border: 'border-slate-400', headerBg: '', badgeBg: 'bg-slate-400', badgeText: 'text-white', timerText: 'text-slate-700', pulse: false, ring: ''
                };
        }
    };

    const statusMap: Record<OrderStatus, string> = {
        [OrderStatus.Pending]: t('statuses.pending'),
        [OrderStatus.New]: t('statuses.new'),
        [OrderStatus.InProgress]: t('statuses.inProgress'),
        [OrderStatus.Ready]: t('statuses.ready')
    };

    const styles = getStatusStyles();

    return (
        <article className={clsx(
            "w-80 flex flex-col bg-white dark:bg-[#1A2E22] rounded-xl shadow-md border-t-4 overflow-hidden shrink-0",
            styles.border,
            styles.pulse && "animate-pulse",
            styles.ring,
            order.status === OrderStatus.Ready && "opacity-80 hover:opacity-100 transition-opacity"
        )}>
            {/* Cabecera del ticket */}
            <div className={clsx("p-4 border-b border-slate-100 dark:border-[#28392e] flex justify-between items-start", styles.headerBg)}>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider", styles.badgeBg, styles.badgeText)}>
                            {statusMap[order.status]}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">12:45 PM</span> 
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Mesa {order.tableNumber}</h3>
                    <p className="text-xs text-slate-500 dark:text-[#9db9a6] mt-0.5">
                        {t('card.waiter')}: {order.waiterName} • #{order.ticketNumber}
                    </p>
                </div>
                <div className="text-right">
                    <span className={clsx("text-2xl font-black", styles.timerText)}>{order.timeElapsed}</span>
                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wide">
                        {order.status === OrderStatus.Ready ? t('card.total') : t('card.time')}
                    </p>
                </div>
            </div>

            {/* Listado de items */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                <ul className="flex flex-col gap-4">
                    {order.items.map(item => (
                        <li key={item.id} className={clsx("flex gap-3", item.completed && "opacity-50")}>
                            {item.completed ? (
                                <CheckCircle2 className="size-8 text-primary shrink-0" strokeWidth={1.5} />
                            ) : (
                                <div className="bg-slate-100 dark:bg-[#28392e] text-slate-900 dark:text-white font-bold size-8 rounded flex items-center justify-center shrink-0 text-lg">
                                    {item.quantity}
                                </div>
                            )}
                            <div className={clsx("flex flex-col", item.completed && "line-through decoration-slate-400")}>
                                <span className="text-slate-900 dark:text-white font-semibold text-lg leading-tight">{item.name}</span>
                                {item.notes && (
                                    <span className="text-red-500 text-sm font-medium italic mt-0.5">{item.notes}</span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Botón de acción */}
            <div className="p-3 bg-slate-50 dark:bg-[#111813] border-t border-slate-100 dark:border-[#28392e] mt-auto">
                {order.status === OrderStatus.Pending && (
                    <button 
                        onClick={() => onStatusChange?.(order.id, OrderStatus.InProgress)}
                        className="w-full py-3 bg-slate-200 dark:bg-[#28392e] text-slate-700 dark:text-white font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-[#1c2520] transition-colors flex items-center justify-center gap-2">
                        <Check className="size-5" />
                        {t('card.startOrder')}
                    </button>
                )}
                {order.status === OrderStatus.New && (
                    <button 
                        onClick={() => onStatusChange?.(order.id, OrderStatus.InProgress)}
                        className="w-full py-3 bg-slate-900 dark:bg-primary text-white dark:text-black font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                        <Play className="size-5 fill-current" />
                        {t('card.startOrder')}
                    </button>
                )}
                {order.status === OrderStatus.InProgress && (
                    <button 
                        onClick={() => onStatusChange?.(order.id, OrderStatus.Ready)}
                        className="w-full py-3 bg-slate-200 dark:bg-surface-hover text-slate-700 dark:text-white font-bold rounded-lg hover:bg-green-500 hover:text-white dark:hover:bg-primary dark:hover:text-black transition-colors flex items-center justify-center gap-2">
                        <Check className="size-5" />
                        {t('card.readyToServe')}
                    </button>
                )}
                {order.status === OrderStatus.Ready && (
                    <button 
                        onClick={() => onStatusChange?.(order.id, OrderStatus.InProgress)}
                        className="w-full py-3 bg-transparent border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                        <History className="size-5" />
                        {t('card.recover')}
                    </button>
                )}
            </div>
        </article>
    );
};
