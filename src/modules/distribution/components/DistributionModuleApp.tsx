"use client";

import React, { useState } from "react";
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

export default function DistributionModuleApp({
    tenantId,
}: {
    tenantId: string;
}) {
    const [activeTab, setActiveTab] = useState<DistributionTab>("dashboard");

    const navItems = [
        { id: "dashboard", label: "Dashboard General", icon: LayoutDashboard },
        { id: "inventory", label: "Inventario & Productos", icon: Package },
        { id: "sales", label: "Ventas (POS)", icon: ShoppingCart },
        { id: "history", label: "Historial de Ventas", icon: History },
        { id: "cash", label: "Control de Caja & Efectivo", icon: Banknote },
        { id: "suppliers", label: "Proveedores & Compras", icon: Truck },
        { id: "employees", label: "Empleados & Comisiones", icon: Users },
        { id: "tax", label: "Impuestos & Facturación CAI", icon: Receipt },
    ];

    return (
        <div className="flex h-full min-h-0 w-full flex-col bg-zinc-950 text-zinc-100">
            {/* Top Banner / Header for Distribution Vertical */}
            <header className="bg-zinc-900 border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-indigo-400">
                        <Store className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            Distribuidora San José{" "}
                            <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Módulo Distribución
                            </span>
                        </h2>
                        <p className="text-xs text-zinc-400">
                            Sucursal Central Managua • Tenant:
                            distribuidora-sanjose
                        </p>
                    </div>
                </div>

                {/* Quick Nav Badges */}
                <div className="hidden sm:flex items-center gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() =>
                                    setActiveTab(item.id as DistributionTab)
                                }
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    isActive
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {item.label.split(" ")[0]}
                            </button>
                        );
                    })}
                </div>
            </header>
            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto">
                {activeTab === "dashboard" && <DistributionDashboard tenantId={tenantId} />}
                {activeTab === "inventory" && <InventoryView tenantId={tenantId} />}
                {activeTab === "sales" && <SalesPOSView tenantId={tenantId} />}
                {activeTab === "history" && <SalesHistoryView tenantId={tenantId} />}
                {activeTab === "cash" && <CashRegisterView tenantId={tenantId} />}
                {activeTab === "suppliers" && <SuppliersView tenantId={tenantId} />}
                {activeTab === "employees" && <EmployeesView tenantId={tenantId} />}
                {activeTab === "tax" && <TaxAndInvoicingView tenantId={tenantId} />}
            </main>
        </div>
    );
}
