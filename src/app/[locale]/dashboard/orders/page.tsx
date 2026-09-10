import { OrderManagementView } from "@/features/orders";

export default function OrdersPage() {
    return (
        <div className="h-[calc(100vh-5rem)] min-h-0 flex flex-col rounded-xl overflow-hidden border border-border-light dark:border-surface-hover shadow-sm">
            <OrderManagementView />
        </div>
    );
}
