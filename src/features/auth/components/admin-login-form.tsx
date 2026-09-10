"use client";

import { AtSign, KeyRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function AdminLoginForm() {
    const t = useTranslations("loginPage");
    return (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2">
            {/* EMAIL */}
            <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email Address
                </span>
                <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
                    <input
                        type="email"
                        placeholder="name@restaurant.com"
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c1c2e] pl-11 pr-4 text-black dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    />
                </div>
            </label>

            {/* PASSWORD */}
            <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Password
                </span>
                <div className="relative">
                    <KeyRoundIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />

                    <input
                        type="password"
                        placeholder="••••••••"
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c1c2e] pl-11 pr-4 text-black dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    />
                </div>
            </label>

            {/* REMEMBER */}
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                    type="checkbox"
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                />
                Remember this device
            </label>

            {/* SUBMIT */}
            <button className="h-12 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform">
                {t("adminLogin")}
            </button>
        </div>
    );
}
