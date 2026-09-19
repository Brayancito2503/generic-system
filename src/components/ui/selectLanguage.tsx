"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GlobeIcon } from "lucide-react"

export function SelectLanguage({ className }: { className?: string }) {
    const router = useRouter()
    const pathname = usePathname()
    const currentLocale = useLocale()
    const t = useTranslations('sidebar');

    const changeLanguage = (locale: string) => {
        // Solo cambia si es diferente
        if (locale === currentLocale) return;

        // Regex anclada al inicio: `^/${currentLocale}(?=/|$)` — reemplaza SOLO
        // el prefijo inicial del pathname. Evita (a) el no-op silencioso cuando
        // el pathname no tiene prefijo de locale y (b) corromper un
        // `/${currentLocale}` que aparece en mitad de ruta, ej. `/settings/es`
        // (el replace suelto lo convertía en `/settings/en`).
        const localePrefix = new RegExp(`^/${currentLocale}(?=/|$)`);
        const newPathname = localePrefix.test(pathname)
            ? pathname.replace(localePrefix, `/${locale}`)
            : `/${locale}${pathname === '/' ? '' : pathname}`;

        router.push(newPathname);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild className={className}>
                {/* Botón nativo en vez de div: operable por teclado y foco (Radix asChild clona los props de aria) */}
                {/* Mantiene el mismo estilo de item de menú, igual que ThemeToggle usa Button */}
                <button
                    type="button"
                    className="flex w-auto cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
                >
                    <GlobeIcon className="size-4 shrink-0" />
                    <span className="flex-1 text-left">{t('language.default')} ({currentLocale.toUpperCase()})</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={() => changeLanguage("en")}
                    className={currentLocale === 'en' ? 'bg-accent' : ''}
                >
                    {t('language.en')}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => changeLanguage("es")}
                    className={currentLocale === 'es' ? 'bg-accent' : ''}
                >
                    {t('language.es')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
