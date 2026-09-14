"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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

/** Renders a real percentage point: leading + for gains, one decimal, 0.0% when flat. */
const formatTrend = (pct: number) => `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;

function KpiCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trendPct,
    extra,
    color,
}: {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ElementType;
    trendPct?: number;
    extra?: string;
    color: "emerald" | "blue" | "amber" | "violet" | "rose" | "cyan";
}) {
    const colors = {
        emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        violet: "bg-violet-500/10 text-violet-500 border-violet-500/20",
        rose: "bg-rose-500/10 text-rose-500 border-rose-500/20",
        cyan: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    };
    return (
        <div className="bg-card border border-border rounded-xl p-5 hover:border-accent transition-all shadow-xs">
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-lg border ${colors[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {trendPct !== undefined && (
                    <span
                        className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                            trendPct > 0
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : trendPct < 0
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  : "bg-muted text-muted-foreground"
                        }`}
                    >
                        {trendPct > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                        ) : trendPct < 0 ? (
                            <ArrowDownRight className="w-3 h-3" />
                        ) : null}
                        {formatTrend(trendPct)}
                    </span>
                )}
            </div>
            <div className="mt-1">
                <p className="text-2xl font-bold text-foreground tracking-tight">
                    {value}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    {title}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>
                {extra && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{extra}</p>
                )}
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
                            className={`w-full rounded-t-md transition-all ${i === data.length - 1 ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                            style={{ height: `${(d.total / max) * 80}px` }}
                        />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.date}</span>
                </div>
            ))}
        </div>
    );
}

export function DistributionDashboard() {
    const t = useTranslations("distributionModule");

    const { data: stats, isPending, isError } = useQuery<DistributionDashboardStats>({
        queryKey: ["distribution-dashboard"],
        queryFn: () => apiGet<DistributionDashboardStats>(`/dashboard`),
    });

    if (isPending) {
        return (
            <div className="p-6 flex items-center justify-center py-24 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> {t("dashboard.loading")}
            </div>
        );
    }

    if (isError || !stats) {
        return (
            <div className="p-6 py-24 text-center text-destructive text-sm">
                {t("dashboard.loadError")}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-2">
                        <Package className="w-3.5 h-3.5" /> {t("header.moduleBadge")}
                    </div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        {t("dashboard.title")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t("dashboard.subtitle")}
                    </p>
                </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard
                    title={t("dashboard.kpiSales")}
                    value={fmt(stats.salesToday)}
                    subtitle={t("dashboard.kpiSalesSub")}
                    icon={TrendingUp}
                    trendPct={stats.trends.today.revenue}
                    extra={t("dashboard.trendLine", {
                        orders: formatTrend(stats.trends.today.orders),
                        ticket: formatTrend(stats.trends.today.avgTicket),
                    })}
                    color="emerald"
                />
                <KpiCard
                    title={t("dashboard.kpiMonthSales")}
                    value={fmt(stats.salesThisMonth)}
                    subtitle={t("dashboard.kpiMonthSalesSub")}
                    icon={BarChart3}
                    trendPct={stats.trends.month.revenue}
                    extra={t("dashboard.trendLine", {
                        orders: formatTrend(stats.trends.month.orders),
                        ticket: formatTrend(stats.trends.month.avgTicket),
                    })}
                    color="blue"
                />
                <KpiCard
                    title={t("dashboard.cashInRegister")}
                    value={fmt(stats.cashInRegister)}
                    subtitle={t("dashboard.cashInRegisterSub")}
                    icon={Banknote}
                    color="cyan"
                />
                <KpiCard
                    title={t("inventory.title")}
                    value={stats.totalProducts.toString()}
                    subtitle={t("dashboard.kpiInventorySub")}
                    icon={Box}
                    color="violet"
                />
                <KpiCard
                    title={t("dashboard.kpiAlerts")}
                    value={stats.lowStockItems.toString()}
                    subtitle={t("dashboard.kpiAlertsSub")}
                    icon={AlertTriangle}
                    color="amber"
                />
                <KpiCard
                    title={t("employees.title")}
                    value={stats.activeEmployees.toString()}
                    subtitle={t("employees.active")}
                    icon={Users}
                    color="rose"
                />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Ventas por Día */}
                <div className="lg:col-span-5 bg-card border border-border rounded-xl p-5 shadow-xs">
                    <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-500" />{" "}
                        {t("dashboard.salesWeekTitle")}
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">
                        {t("dashboard.salesWeekSub")}
                    </p>
                    <MiniBarChart data={stats.salesByDay} />
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t("dashboard.weekTotal")}</span>
                        <span className="font-semibold text-foreground">
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
                <div className="lg:col-span-4 bg-card border border-border rounded-xl p-5 shadow-xs">
                    <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />{" "}
                        {t("dashboard.topProductsTitle")}
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">
                        {t("dashboard.topProductsSub")}
                    </p>
                    <div className="space-y-3">
                        {stats.topProducts.map((p, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-xs font-bold text-muted-foreground w-4">
                                    #{i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">
                                        {p.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {t("dashboard.unitsSold", { count: p.sold })}
                                    </p>
                                </div>
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                    {fmt(p.revenue)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Alertas de Stock Mínimo */}
                <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5 shadow-xs">
                    <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />{" "}
                        {t("dashboard.lowStockTitle")}
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">
                        {stats.lowStockItems} {t("dashboard.lowStockCount")}
                    </p>
                    <div className="space-y-2.5">
                        {stats.lowStockItems === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                {t("dashboard.noStockAlerts")}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                {t("dashboard.checkInventory")}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Ventas Recientes */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-emerald-500" />{" "}
                    {t("dashboard.recentSales")}
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left text-xs text-muted-foreground font-medium pb-3">
                                    {t("dashboard.customer")}
                                </th>
                                <th className="text-right text-xs text-muted-foreground font-medium pb-3">
                                    {t("dashboard.items")}
                                </th>
                                <th className="text-right text-xs text-muted-foreground font-medium pb-3">
                                    {t("dashboard.total")}
                                </th>
                                <th className="text-right text-xs text-muted-foreground font-medium pb-3">
                                    {t("dashboard.date")}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {stats.recentSales.map((sale) => (
                                <tr
                                    key={sale.id}
                                    className="hover:bg-accent/50 transition-colors"
                                >
                                    <td className="py-3 text-foreground font-medium">
                                        {sale.customer}
                                    </td>
                                    <td className="py-3 text-right text-muted-foreground">
                                        {sale.items}
                                    </td>
                                    <td className="py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                        {fmt(sale.total)}
                                    </td>
                                    <td className="py-3 text-right text-muted-foreground text-xs flex items-center justify-end gap-1">
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