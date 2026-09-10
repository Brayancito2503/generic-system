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
        const newPathname = pathname.replace(`/${currentLocale}`, `/${locale}`)
        router.push(newPathname)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild className={className}>
                {/* Este div actúa como el trigger, igual que ThemeToggle usa Button */}
                {/* Le damos clases para que parezca un elemento de menú de texto normal */}
                <div className="flex w-auto cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
                    <GlobeIcon className="size-4 shrink-0" />
                    <span className="flex-1 text-left">{t('language.default')} ({currentLocale.toUpperCase()})</span>
                </div>
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
