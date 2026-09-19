import "./globals.css";
import { IntlErrorHandlingProvider, Providers } from "@/app/[locale]/providers";
import { ThemeProvider } from "@wrksz/themes/next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { TooltipProvider } from "@/components/ui/tooltip";

type Props = {
    children: React.ReactNode;
    params: Promise<{
        locale: string;
    }>;
};

export default async function RootLayout({
    children,
    params,
}: Props) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) return notFound();

    return (
        <html lang="en" suppressHydrationWarning>
<body>
                <NextIntlClientProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem={true} >
                        <Providers>
                            {/* GLOBAL SELECTORS (Absolute to avoid layout displacement) */}
                            {/* <div className="absolute top-2 left-2 z-[100] flex gap-2 pointer-events-none">
                                <div className="pointer-events-auto">
                                    <SelectLanguage />
                                </div>
                               
                            </div> */}
                            {/* {children} */}
                            <TooltipProvider delayDuration={200}>
                                <IntlErrorHandlingProvider locale={locale}>
                                    {children}
                                </IntlErrorHandlingProvider>
                            </TooltipProvider>
                        </Providers>
                    </ThemeProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
