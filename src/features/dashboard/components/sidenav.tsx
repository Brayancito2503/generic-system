import Link from "next/link";
import NavLinks from "./nav-links";
import { PowerIcon, BuildingStorefrontIcon } from "@heroicons/react/24/outline";

export default function SideNav() {
    return (
        <div className="flex h-full flex-col px-3 pt-4 pb-8 md:px-2 bg-zinc-950 border-r border-zinc-800">
            <Link
                className="mb-4 flex h-16 items-center justify-start rounded-lg bg-zinc-900 border border-zinc-800 px-4 hover:bg-zinc-800 transition-colors"
                href="/dashboard"
            >
                <BuildingStorefrontIcon className="w-6 h-6 text-emerald-400 shrink-0" />
                <span className="ml-3 hidden md:block font-bold text-white text-sm tracking-wide">Generic System</span>
            </Link>
            <div className="flex flex-col flex-1 min-h-0 justify-between gap-4">
                <div className="flex flex-col gap-1 overflow-y-auto">
                    <NavLinks />
                </div>
                <form className="mt-auto pt-3 border-t border-zinc-800 shrink-0">
                    <button className="flex h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 hover:bg-red-900/30 hover:text-red-400 text-zinc-400 text-sm font-medium transition-colors md:justify-start md:px-3">
                        <PowerIcon className="w-5 h-5" />
                        <span className="hidden md:block">Cerrar Sesión</span>
                    </button>
                </form>
            </div>
        </div>
    );
}
