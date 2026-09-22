"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
    LayoutDashboard,
    Package,
    Banknote,
    Truck,
    Users,
    Receipt,
    Store,
    ShoppingCart,
    History,
    Contact,
    Undo2,
    HandCoins,
    FileText,
    Settings,
} from "lucide-react";
import { DistributionDashboard } from "./DistributionDashboard";
import { InventoryView } from "./InventoryView";
import { CashRegisterView } from "./CashRegisterView";
import { SalesPOSView } from "./SalesPOSView";
import { SalesHistoryView } from "./SalesHistoryView";
import { SalesReturnsView } from "./SalesReturnsView";
import { ReceivablesView } from "./ReceivablesView";
import { CustomersView } from "./CustomersView";
import SuppliersView from "./SuppliersView";
import EmployeesView from "./EmployeesView";
import TaxAndInvoicingView from "./TaxAndInvoicingView";
import { DailyCloseReportView } from "./DailyCloseReportView";
import TenantSettingsView from "./TenantSettingsView";
import { getMe } from "@/features/auth/api";
import { visibleTabs } from "../lib/roles";

export type DistributionTab =
    | "dashboard"
    | "inventory"
    | "sales"
    | "history"
    | "returns"
    | "customers"
    | "receivables"
    | "cash"
    | "suppliers"
    | "employees"
    | "tax"
    | "reportes"
    | "settings";

export default function DistributionModuleApp() {
    const [activeTab, setActiveTab] = useState<DistributionTab>("dashboard");
    const t = useTranslations("distributionModule");

    // Dynamic session query: header name and role gate reflect real-time query cache
    const { data: me } = useQuery({
        queryKey: ["me"],
        queryFn: getMe,
    });
    const tenantName = me?.tenant?.name ?? null;
    const userRole = me?.user?.role ?? null;

    // Unknown role (still loading) keeps the full tab set: legacy behavior for
    // unrestricted profiles, no flicker for admins. Restricted profiles
    // (CASHIER / ACCOUNTANT) see only their module set.
    const allowedTabs = visibleTabs(userRole);

    const tabs: Array<{ id: DistributionTab; icon: React.ElementType }> = [
        { id: "dashboard", icon: LayoutDashboard },
        { id: "inventory", icon: Package },
        { id: "sales", icon: ShoppingCart },
        { id: "history", icon: History },
        { id: "returns", icon: Undo2 },
        { id: "customers", icon: Contact },
        { id: "receivables", icon: HandCoins },
        { id: "cash", icon: Banknote },
        { id: "suppliers", icon: Truck },
        { id: "employees", icon: Users },
        { id: "tax", icon: Receipt },
        { id: "reportes", icon: FileText },
        { id: "settings", icon: Settings },
    ];
    const navItems = tabs.filter((item) => allowedTabs.includes(item.id));

    // A restricted role may load while the user is already on a tab it hides
    // (clicked before the session resolved): render dashboard instead of the
    // forbidden view — the API would 403 anyway.
    const safeTab: DistributionTab = allowedTabs.includes(activeTab)
        ? activeTab
        : "dashboard";

    return (
        <div className="flex h-full min-h-0 w-full flex-col bg-background text-foreground">
            {/* Top Banner / Header for Distribution Vertical */}
            <header className="bg-card border-b border-border shadow-xs mb-3">
                {/* Identity row: tenant + module badge + description */}
                <div className="flex items-center gap-3 px-6 pt-4 pb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                        <Store className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base font-bold text-foreground">
                                {tenantName || t("header.title")}
                            </h2>
                            <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-primary/10 text-primary border border-primary/20">
                                {t("header.moduleBadge")}
                            </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {t("header.moduleDescription")}
                        </p>
                    </div>
                </div>

                {/* Module navigation: roomier buttons, scrolls only when needed */}
                <nav
                    className="flex items-center gap-2 overflow-x-auto px-6 pb-4"
                    aria-label={t("header.moduleBadge")}
                >
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = safeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                aria-current={isActive ? "page" : undefined}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {t(`tabs.${item.id}`)}
                            </button>
                        );
                    })}
                </nav>
            </header>
            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto px-6 pb-6">
                {safeTab === "dashboard" && <DistributionDashboard />}
                {safeTab === "inventory" && (
                    <InventoryView userRole={userRole} />
                )}
                {safeTab === "sales" && <SalesPOSView />}
                {safeTab === "history" && <SalesHistoryView />}
                {safeTab === "returns" && <SalesReturnsView />}
                {safeTab === "customers" && <CustomersView />}
                {safeTab === "receivables" && <ReceivablesView />}
                {safeTab === "cash" && <CashRegisterView />}
                {safeTab === "suppliers" && (
                    <SuppliersView userRole={userRole} />
                )}
                {safeTab === "employees" && <EmployeesView />}
                {safeTab === "tax" && <TaxAndInvoicingView />}
                {safeTab === "reportes" && <DailyCloseReportView />}
                {safeTab === "settings" && <TenantSettingsView />}
            </main>
        </div>
    );
}
