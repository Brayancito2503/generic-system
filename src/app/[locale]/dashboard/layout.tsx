import { AppSidebar } from "@/components/app-sidebar";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DynamicBreadcrumb } from "@/features/dashboard/components/dynamic-breadcrumb";

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <SidebarProvider className="overflow-hidden h-dvh">
            {/* Menu lateral */}
            <AppSidebar />
            {/* Contenedor del contenido principal */}
            <SidebarInset className="min-w-0 overflow-hidden">
                {/* Header compartido para todo el Dashboard */}
                <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                        />
                        <DynamicBreadcrumb />
                    </div>
                </header>

                {/* Contenedor del contenido principal de las páginas */}
                <div className="flex flex-1 flex-col gap-4 p-4 pt-0 min-w-0 overflow-y-auto">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
