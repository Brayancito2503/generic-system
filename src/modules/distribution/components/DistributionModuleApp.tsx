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
} from "lucide-react";
import { DistributionDashboard } from "./DistributionDashboard";
import { InventoryView } from "./InventoryView";
import { CashRegisterView } from "./CashRegisterView";
import { SalesPOSView } from "./SalesPOSView";
import { SalesHistoryView } from "./SalesHistoryView";
import SuppliersView from "./SuppliersView";
import EmployeesView from "./EmployeesView";
import TaxAndInvoicingView from "./TaxAndInvoicingView";

export type DistributionTab =
    | "dashboard"
    | "inventory"
    | "sales"
    | "history"
    | "cash"
    | "suppliers"
    | "employees"
    | "tax";

export default function DistributionModuleApp() {
    const [activeTab, setActiveTab] = useState<DistributionTab>("dashboard");
    const t = useTranslations("distributionModule");

    const navItems: { id: DistributionTab; icon: React.ElementType }[] = [
        { id: "dashboard", icon: LayoutDashboard },
        { id: "inventory", icon: Package },
        { id: "sales", icon: ShoppingCart },
        { id: "history", icon: History },
        { id: "cash", icon: Banknote },
        { id: "suppliers", icon: Truck },
        { id: "employees", icon: Users },
        { id: "tax", icon: Receipt },
    ];

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
                            {t("header.title")}
                            <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-primary/10 text-primary border border-primary/20">
                                {t("header.moduleBadge")}
                            </span>
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {t("header.branchInfo")}
                        </p>
                    </div>
                </div>

                {/* Quick Nav Badges */}
                <div className="hidden sm:flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
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
                {activeTab === "dashboard" && <DistributionDashboard />}
                {activeTab === "inventory" && <InventoryView />}
                {activeTab === "sales" && <SalesPOSView />}
                {activeTab === "history" && <SalesHistoryView />}
                {activeTab === "cash" && <CashRegisterView />}
                {activeTab === "suppliers" && <SuppliersView />}
                {activeTab === "employees" && <EmployeesView />}
                {activeTab === "tax" && <TaxAndInvoicingView />}
            </main>
        </div>
    );
}
