"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    TrendingUp,
    Package,
    AlertTriangle,
    Users,
    Banknote,
    ShoppingCart,
    ArrowUpRight,
    ArrowDownRight,
    BarChart3,
    Box,
    Clock,
    Loader2,
} from "lucide-react";
import type { DistributionDashboardStats } from "../entities";
import { apiGet } from "../api";

const fmt = (n: number) =>
    new Intl.NumberFormat("es-NI", {
        style: "currency",
        currency: "NIO",
    }).format(n);

function KpiCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    trendUp,
    color,
}: {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ElementType;
    trend?: string;
    trendUp?: boolean;
    color: "emerald" | "blue" | "amber" | "violet" | "rose" | "cyan";
}) {
    const colors = {
        emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
        rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    };
    return (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all">
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-lg border ${colors[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend && (
                    <span
                        className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trendUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}
                    >
                        {trendUp ? (
                            <ArrowUpRight className="w-3 h-3" />
                        ) : (
                            <ArrowDownRight className="w-3 h-3" />
                        )}
                        {trend}
                    </span>
                )}
            </div>
            <div className="mt-1">
                <p className="text-2xl font-bold text-white tracking-tight">
                    {value}
                </p>
                <p className="text-xs font-medium text-zinc-400 mt-0.5">
                    {title}
                </p>
                <p className="text-xs text-zinc-600 mt-1">{subtitle}</p>
            </div>
        </div>
    );
}

function MiniBarChart({ data }: { data: { date: string; total: number }[] }) {
    const max = Math.max(...data.map((d) => d.total), 1);
    return (
        <div className="flex items-end gap-2 h-28 pt-4">
            {data.map((d, i) => (
                <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1.5"
                >
                    <div
                        className="w-full relative flex items-end justify-center"
                        style={{ height: "80px" }}
                    >
                        <div
                            className={`w-full rounded-t-md transition-all ${i === data.length - 1 ? "bg-emerald-500" : "bg-zinc-700"}`}
                            style={{ height: `${(d.total / max) * 80}px` }}
                        />
                    </div>
                    <span className="text-[10px] text-zinc-500">{d.date}</span>
                </div>
            ))}
        </div>
    );
}

export function DistributionDashboard({
    tenantId = "distribuidora-demo",
}: {
    tenantId?: string;
}) {
    const [activeTab, setActiveTab] = useState<"hoy" | "semana" | "mes">("hoy");

    const { data: stats, isPending, isError } = useQuery<DistributionDashboardStats>({
        queryKey: ["distribution-dashboard", tenantId],
        queryFn: () => apiGet<DistributionDashboardStats>(`/dashboard?tenantId=${tenantId}`),
        enabled: !!tenantId,
    });

    if (isPending) {
        return (
            <div className="p-6 flex items-center justify-center py-24 text-zinc-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando dashboard...
            </div>
        );
    }

    if (isError || !stats) {
        return (
            <div className="p-6 py-24 text-center text-rose-400 text-sm">
                Error al cargar el dashboard.
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
                        <Package className="w-3.5 h-3.5" /> Módulo Activo:
                        Distribuidora
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Dashboard Distribuidora
                    </h1>
                    <p className="text-sm text-zinc-400">
                        Vista general del negocio —{" "}
                        {new Date().toLocaleDateString("es", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {(["hoy", "semana", "mes"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${activeTab === tab ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"}`}
                        >
                            {tab === "hoy"
                                ? "Hoy"
                                : tab === "semana"
                                  ? "Esta semana"
                                  : "Este mes"}
                        </button>
                    ))}
                </div>
            </div>
            {/* KPIs Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard
                    title="Ventas del Día"
                    value={fmt(stats.salesToday)}
                    subtitle="Facturado hoy"
                    icon={TrendingUp}
                    trend="+12.4%"
                    trendUp
                    color="emerald"
                />
                <KpiCard
                    title="Ventas del Mes"
                    value={fmt(stats.salesThisMonth)}
                    subtitle="Acumulado del mes"
                    icon={BarChart3}
                    trend="+8.1%"
                    trendUp
                    color="blue"
                />
                <KpiCard
                    title="En Caja"
                    value={fmt(stats.cashInRegister)}
                    subtitle="Efectivo disponible"
                    icon={Banknote}
                    color="cyan"
                />
                <KpiCard
                    title="Productos"
                    value={stats.totalProducts.toString()}
                    subtitle="En catálogo activo"
                    icon={Box}
                    color="violet"
                />
                <KpiCard
                    title="Stock Mínimo"
                    value={stats.lowStockItems.toString()}
                    subtitle="Productos bajo mínimo"
                    icon={AlertTriangle}
                    trend="¡Atención!"
                    trendUp={false}
                    color="amber"
                />
                <KpiCard
                    title="Empleados"
                    value={stats.activeEmployees.toString()}
                    subtitle="Personal activo"
                    icon={Users}
                    color="rose"
                />
            </div>
            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Ventas por Día */}
                <div className="lg:col-span-5 bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-400" />{" "}
                        Ventas — Últimos 7 días
                    </h2>
                    <p className="text-xs text-zinc-500 mb-4">
                        Monto vendido por día (L)
                    </p>
                    <MiniBarChart data={stats.salesByDay} />
                    <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">Total semana</span>
                        <span className="font-semibold text-white">
                            {fmt(
                                stats.salesByDay.reduce(
                                    (a, b) => a + b.total,
                                    0,
                                ),
                            )}
                        </span>
                    </div>
                </div>

                {/* Productos más vendidos */}
                <div className="lg:col-span-4 bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-400" /> Top 5
                        Productos
                    </h2>
                    <p className="text-xs text-zinc-500 mb-4">
                        Por ventas del mes
                    </p>
                    <div className="space-y-3">
                        {stats.topProducts.map((p, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-xs font-bold text-zinc-600 w-4">
                                    #{i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-zinc-200 truncate">
                                        {p.name}
                                    </p>
                                    <p className="text-[11px] text-zinc-500">
                                        {p.sold} unidades
                                    </p>
                                </div>
                                <span className="text-xs font-semibold text-emerald-400">
                                    {fmt(p.revenue)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Alertas de Stock Mínimo */}
                <div className="lg:col-span-3 bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />{" "}
                        Stock Crítico
                    </h2>
                    <p className="text-xs text-zinc-500 mb-4">
                        {stats.lowStockItems} producto(s) bajo mínimo
                    </p>
                    <div className="space-y-2.5">
                        {stats.lowStockItems === 0 ? (
                            <p className="text-xs text-zinc-500">
                                Sin alertas de stock.
                            </p>
                        ) : (
                            <p className="text-xs text-zinc-500">
                                Revisa la vista de inventario para ver los
                                productos con stock bajo.
                            </p>
                        )}
                    </div>
                </div>
            </div>
            {/* Ventas Recientes */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-emerald-400" /> Ventas
                    Recientes
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800">
                                <th className="text-left text-xs text-zinc-500 font-medium pb-3">
                                    Cliente
                                </th>
                                <th className="text-right text-xs text-zinc-500 font-medium pb-3">
                                    Ítems
                                </th>
                                <th className="text-right text-xs text-zinc-500 font-medium pb-3">
                                    Total
                                </th>
                                <th className="text-right text-xs text-zinc-500 font-medium pb-3">
                                    Hora
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {stats.recentSales.map((sale) => (
                                <tr
                                    key={sale.id}
                                    className="hover:bg-zinc-800/30 transition-colors"
                                >
                                    <td className="py-3 text-zinc-200 font-medium">
                                        {sale.customer}
                                    </td>
                                    <td className="py-3 text-right text-zinc-400">
                                        {sale.items}
                                    </td>
                                    <td className="py-3 text-right font-semibold text-emerald-400">
                                        {fmt(sale.total)}
                                    </td>
                                    <td className="py-3 text-right text-zinc-500 text-xs flex items-center justify-end gap-1">
                                        <Clock className="w-3 h-3" />{" "}
                                        {sale.time}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}