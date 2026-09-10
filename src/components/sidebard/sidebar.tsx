"use client";
import {
    ArrowLeft,
    BarChart3,
    Bell,
    FolderClosed,
    LayoutGrid,
    Package2,
    PieChart,
    Settings,
    SquareCheck,
    Users,
} from "lucide-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sidebarOpen } from "@/hooks/atoms";
import { cn } from "@/lib/utils";
import { NavbarLink } from "./NavbarLink";
import UserMenu from "./UserMenu";
import { usePathname } from "next/navigation";

export default function Sidebar() {
    const [isOpen, setOpen] = useAtom(sidebarOpen);
    const path = usePathname();

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 border-r z-20 bg-white transition-[width] ease-in-out overflow-hidden",
                "flex flex-col max-h-screen h-full",
                isOpen ? "w-[18rem]" : "w-[3.5rem]",
            )}
        >
            {/* Sidebar header */}
            <div
                className={cn(
                    "flex items-center h-[60px] border-b",
                    isOpen ? "px-6" : "flex-col justify-center animate-sidebar-closed"
                )}
            >
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Package2 className="h-6 w-6" />
                    <span className={cn(!isOpen && "sr-only")}>Aprendo</span>
                </Link>
                {isOpen ? (
                    <Button
                        variant="secondary"
                        size="icon"
                        className="ml-auto h-6 w-6"
                        onClick={() => setOpen((prev) => !prev)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Toggle Navbar</span>
                    </Button>
                ) : null}
            </div>
            <nav className="flex flex-col flex-1 text-sm font-medium">
                {/* Main menu links */}
                <div
                    className={cn(
                        "flex flex-col",
                        isOpen ? "p-4" : "items-center gap-y-4 py-4 animate-sidebar-closed"
                    )}
                >
                    <NavbarLink
                        href="/"
                        isSidebarOpen={isOpen}
                        icon={<LayoutGrid className="h-4 w-4 shrink-0" />}
                        label="Dashboard"
                        isSelected={path === "/"}
                    />
                    <NavbarLink
                        href="/activity"
                        isSidebarOpen={isOpen}
                        icon={<BarChart3 className="h-4 w-4 shrink-0" />}
                        label="Activity"
                        isSelected={path === "/activity"}
                    />
                    <NavbarLink
                        href="/tasks"
                        isSelected={path === "/tasks"}
                        isSidebarOpen={isOpen}
                        icon={<SquareCheck className="h-4 w-4 shrink-0" />}
                        label={
                            <div className="flex w-full justify-between gap-x-2">
                                Tasks
                                <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                                    6
                                </Badge>
                            </div>
                        }
                    />
                    <NavbarLink
                        href="/projects"
                        isSelected={path === "/projects"}
                        isSidebarOpen={isOpen}
                        icon={<FolderClosed className="h-4 w-4 shrink-0" />}
                        label="Projects"
                    />
                    <NavbarLink
                        href="/team"
                        isSelected={path === "/team"}
                        isSidebarOpen={isOpen}
                        icon={<Users className="h-4 w-4 shrink-0" />}
                        label="Team"
                    />
                    <NavbarLink
                        href="/reports"
                        isSelected={path === "/reports"}
                        isSidebarOpen={isOpen}
                        icon={<PieChart className="h-4 w-4 shrink-0" />}
                        label="Reports"
                    />
                </div>
                {/* Bottom section of the sidebar */}
                <div
                    className={cn(
                        "mt-auto flex flex-col border-b border-t",
                        isOpen ? "p-4" : "items-center gap-y-4 py-4 animate-sidebar-closed"
                    )}
                >
                    <NavbarLink
                        href="/settings"
                        isSelected={path === "/settings"}
                        isSidebarOpen={isOpen}
                        icon={<Settings className="h-4 w-4 shrink-0" />}
                        label="Settings"
                    />
                    <NavbarLink
                        isSelected={path === "/notifications"}
                        href="/notifications"
                        isSidebarOpen={isOpen}
                        icon={<Bell className="h-4 w-4 shrink-0" />}
                        label="Notifications"
                    />
                </div>
                {/* User menu */}
                <UserMenu isSidebarOpen={isOpen} />
            </nav>
        </aside>
    );
}

