export default async function DashboardPage() {
    return (
        <div className="flex h-full min-h-0 w-full flex-col gap-4">
            <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-sm text-muted-foreground">
                Selecciona un módulo del menú para comenzar.
            </p>
        </div>
    );
}