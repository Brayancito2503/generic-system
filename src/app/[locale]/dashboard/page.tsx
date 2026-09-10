import { Card } from "@/features/dashboard/components/cards";
import LatestInvoices from "@/features/dashboard/components/latest-invoices";
// import RevenueChart from "@/features/dashboard/components/revenue-chart";

import { monserrat } from "@/components/ui/fonts";
import {
    InvoiceSkeleton,
    RevenueChartSkeleton,
} from "@/components/ui/skeletons";
import { fetchLatestInvoices, fetchRevenue } from "@/lib/data";
import { Suspense } from "react";

export default async function DashboardPage() {
    // const revenue = await fetchRevenue();
    // const latestInvoices = await fetchLatestInvoices();

    return (
        <>
            {/* Solo nos preocupamos por las métricas / gráficas del Home del Dashboard */}
            <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                <div className="aspect-video rounded-xl bg-muted/50" />
                <div className="aspect-video rounded-xl bg-muted/50" />
                <div className="aspect-video rounded-xl bg-muted/50" />
            </div>
            <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min" />
        </>
    );
}
