"use client";

import { useState } from "react";
import { AtSign, KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { login } from "@/features/auth/api";

export function AdminLoginForm() {
    const t = useTranslations("loginPage");
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login({ mode: "admin", email, password });
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : t("loginError"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2">
            {/* EMAIL */}
            <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t("emailLabel")}
                </span>
                <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" />
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("emailPlaceholder")}
                        required
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c1c2e] pl-11 pr-4 text-black dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    />
                </div>
            </label>

            {/* PASSWORD */}
            <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t("passwordLabel")}
                </span>
                <div className="relative">
                    <KeyRoundIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("passwordPlaceholder")}
                        required
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c1c2e] pl-11 pr-4 text-black dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    />
                </div>
            </label>

            {error && (
                <p className="text-sm font-medium text-rose-500">{error}</p>
            )}

            {/* SUBMIT */}
            <button
                type="submit"
                disabled={loading}
                className="h-12 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
            >
                {loading && <Loader2Icon className="size-4 animate-spin" />}
                {t("submit")}
            </button>
        </form>
    );
}