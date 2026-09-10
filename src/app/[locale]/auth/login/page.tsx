"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AdminLoginForm, LoginForm, PosPinLogin } from "@/features/auth/components";
import { useTranslations } from "next-intl";
import { SelectLanguage } from "@/components/ui/selectLanguage";

export default function LoginPage() {
    /* =======================
         TABS (ADMIN / POS)
      ======================= */
    const [mode, setMode] = useState<"admin" | "pos">("pos");

    const t = useTranslations("loginPage");

    return (
        <div className="relative flex min-h-screen w-full bg-background-light dark:bg-background-dark text-black dark:text-white overflow-hidden">
            {/* LEFT BRAND */}
            <div className="hidden lg:flex relative w-1/2 flex-col justify-between p-12 overflow-hidden bg-zinc-900">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage:
                            'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAU0SX_IgAfJgWGeCYJkuL8Q7xGmm_dkxUL3ZOB68o_7AiaFBZsjL6uz7M0akobfSpdNAUo0XUbFWxvEPXXMgIZ8w8x4zWHQCE3yVf1iuiXsRjVknATk6whSnxu__nYcy6DYtOgcaUiwYvq1hbj5M6te-zeVzjZ_QH7c7IdjXel7H9_WfE-pWQgLqcXbuaEoMaN9BODQ1xSdC6DQG-ockS5gMod1ll1DJ8XXKZTbnGs-njY6FWTMJWPQ-6J8b1z1lM39d4AOIPumgo")',
                    }}
                />
                <div className="absolute inset-0 bg-black/40" />

                <div className="relative z-10 flex items-center gap-2">
                    {/* <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">restaurant_menu</span>
                    </div> */}
                    <span className="text-xl font-bold text-white tracking-tight">
                        {t("title")}
                    </span>
                </div>

                <div className="relative z-10 max-w-lg">
                    <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
                        {t("title")}
                    </h2>
                    <p className="text-slate-300 text-lg leading-relaxed">
                        {t("description")}
                    </p>
                </div>
            </div>

            {/* RIGHT LOGIN */}
            <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-6 bg-white/50 dark:bg-transparent backdrop-blur-sm">
                <SelectLanguage className="absolute top-4 right-14" />
                <ThemeToggle className="absolute top-4 right-4" />
                <div className="w-full max-w-[440px] flex flex-col gap-8">
                    {/* HEADER */}
                    <div className="text-center lg:text-left">
                        <h1 className="text-3xl font-bold mb-2 tracking-tight">
                            {t("title")}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            {t("description")}
                        </p>
                    </div>

                    {/* TABS */}
                    <div className="flex p-1 bg-slate-200 dark:bg-[#1c1c2e] rounded-xl">
                        <button
                            onClick={() => setMode("admin")}
                            className={`flex-1 py-2.5 rounded-lg font-semibold transition-all duration-200
                                ${mode === "admin"
                                    ? "bg-white dark:bg-[#2e2e4a] text-primary shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                }`}
                        >
                            {t("adminLogin")}
                        </button>
                        <button
                            onClick={() => setMode("pos")}
                            className={`flex-1 py-2.5 rounded-lg font-semibold transition-all duration-200
                                 ${mode === "pos"
                                    ? "bg-white dark:bg-[#2e2e4a] text-primary shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                }`}
                        >
                            {t("posAccess")}
                        </button>
                    </div>

                    {/* FORM AREA */}
                    <div className="min-h-[400px]">
                        {mode === "admin" ? <AdminLoginForm /> : <PosPinLogin />}
                    </div>
                </div>
            </div>
        </div>
    );
}
