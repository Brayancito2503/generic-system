"use client";

import React, { useState } from "react";
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
    | "reportes";

export default function DistributionModuleApp() {
    const [activeTab, setActiveTab] = useState<DistributionTab>("dashboard");
    const [tenantName, setTenantName] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const t = useTranslations("distributionModule");

    // The header reflects the real tenant name from the session, never a
    // hardcoded demo label; the session role drives tab-level UI gating
    // (route guards remain the server-side source of truth).
    React.useEffect(() => {
        let active = true;
        getMe().then((me) => {
            if (!active) return;
            setTenantName(me?.tenant?.name ?? null);
            setUserRole(me?.user?.role ?? null);
        });
        return () => { active = false; };
    }, []);

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
            <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-between mb-3 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg text-primary">
                        <Store className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                            {tenantName || t("header.title")}
                            <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-primary/10 text-primary border border-primary/20">
                                {t("header.moduleBadge")}
                            </span>
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {t("header.moduleDescription")}
                        </p>
                    </div>
                </div>

                {/* Quick Nav Badges */}
                <div className="hidden sm:flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border overflow-x-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = safeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {t(`tabs.${item.id}`)}
                            </button>
                        );
                    })}
                </div>
            </header>
            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto px-6 pb-6">
                {safeTab === "dashboard" && <DistributionDashboard />}
                {safeTab === "inventory" && <InventoryView userRole={userRole} />}
                {safeTab === "sales" && <SalesPOSView />}
                {safeTab === "history" && <SalesHistoryView />}
                {safeTab === "returns" && <SalesReturnsView />}
                {safeTab === "customers" && <CustomersView />}
                {safeTab === "receivables" && <ReceivablesView />}
                {safeTab === "cash" && <CashRegisterView />}
                {safeTab === "suppliers" && <SuppliersView userRole={userRole} />}
                {safeTab === "employees" && <EmployeesView />}
                {safeTab === "tax" && <TaxAndInvoicingView />}
                {safeTab === "reportes" && <DailyCloseReportView />}
            </main>
        </div>
    );
}
