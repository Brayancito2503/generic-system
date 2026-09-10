"use client";

import { ArrowRightIcon, Delete } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PosPinLogin() {
    const CORRECT_PIN = "1234";
    const [pin, setPin] = useState("");
    const router = useRouter();

    const addNumber = (n: string) => {
        if (pin.length < 4) setPin(pin + n);
    };

    const removeNumber = () => {
        setPin(pin.slice(0, -1));
    };

    const submitPin = () => {
        if (pin.length < 4) return;

        if (pin === CORRECT_PIN) {
            alert("✅ Acceso concedido");
            router.push("/dashboard");
        } else {
            alert("❌ PIN incorrecto");
            setPin("");
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

            {/* KEYPAD */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[320px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button
                        key={n}
                        onClick={() => addNumber(n.toString())}
                        className="h-16 rounded-2xl bg-white dark:bg-[#1c1c2e] text-2xl font-bold text-black dark:text-white shadow-sm hover:bg-slate-50 dark:hover:bg-[#25253e] active:scale-95 transition-all"
                    >
                        {n}
                    </button>
                ))}

                <button
                    onClick={removeNumber}
                    className="h-16 rounded-2xl bg-red-100 dark:bg-red-900/20 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/30 active:scale-95 transition-all flex items-center justify-center font-bold text-xl"
                >
                    <Delete />
                </button>

                <button
                    onClick={() => addNumber("0")}
                    className="h-16 rounded-2xl bg-white dark:bg-[#1c1c2e] text-2xl font-bold text-black dark:text-white shadow-sm hover:bg-slate-50 dark:hover:bg-[#25253e] active:scale-95 transition-all"
                >
                    0
                </button>

                <button
                    onClick={submitPin}
                    className="h-16 rounded-2xl bg-primary text-white text-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center"
                >
                    <ArrowRightIcon />
                </button>
            </div>
        </div>
    );
}
