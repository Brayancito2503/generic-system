"use client";

import { ArrowRightIcon, Delete, Loader2Icon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { login } from "@/features/auth/api";

export function PosPinLogin() {
    const [pin, setPin] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const addNumber = (n: string) => {
        setError(null);
        if (pin.length < 4) setPin(pin + n);
    };

    const removeNumber = () => {
        setPin(pin.slice(0, -1));
    };

    const submitPin = async () => {
        if (pin.length < 4 || loading) return;
        setLoading(true);
        setError(null);
        try {
            await login({ mode: "pos", pin });
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "PIN incorrecto");
            setPin("");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-2">
            {/* PIN DOTS */}
            <div className="flex gap-4">
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className={`w-4 h-4 rounded-full transition-colors duration-100
                                  ${pin.length > i
                                ? "bg-primary"
                                : "bg-slate-300 dark:bg-slate-700"
                            }`}
                    />
                ))}
            </div>

            {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

            {/* KEYPAD */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[320px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button
                        key={n}
                        type="button"
                        disabled={loading}
                        onClick={() => addNumber(n.toString())}
                        className="h-16 rounded-2xl bg-white dark:bg-[#1c1c2e] text-2xl font-bold text-black dark:text-white shadow-sm hover:bg-slate-50 dark:hover:bg-[#25253e] active:scale-95 transition-all disabled:opacity-60"
                    >
                        {n}
                    </button>
                ))}

                <button
                    type="button"
                    disabled={loading || pin.length === 0}
                    onClick={removeNumber}
                    className="h-16 rounded-2xl bg-red-100 dark:bg-red-900/20 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/30 active:scale-95 transition-all flex items-center justify-center font-bold text-xl disabled:opacity-60"
                >
                    <Delete />
                </button>

                <button
                    type="button"
                    disabled={loading}
                    onClick={() => addNumber("0")}
                    className="h-16 rounded-2xl bg-white dark:bg-[#1c1c2e] text-2xl font-bold text-black dark:text-white shadow-sm hover:bg-slate-50 dark:hover:bg-[#25253e] active:scale-95 transition-all disabled:opacity-60"
                >
                    0
                </button>

                <button
                    type="button"
                    disabled={loading || pin.length < 4}
                    onClick={submitPin}
                    className="h-16 rounded-2xl bg-primary text-white text-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center disabled:opacity-60"
                >
                    {loading ? <Loader2Icon className="size-6 animate-spin" /> : <ArrowRightIcon />}
                </button>
            </div>
        </div>
    );
}