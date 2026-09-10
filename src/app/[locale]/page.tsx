// import AcmeLogo from "@/app/ui/acme-logo";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SelectLanguage } from "@/components/ui/selectLanguage";
import { Button } from "@/components/ui/button";

export default async function Page() {
    const t = await getTranslations();
    return (
        <main className="flex min-h-screen flex-col p-6 bg-background transition-colors duration-300">
            <div className="flex h-20 shrink-0 items-end rounded-lg bg-blue-500 p-4 md:h-52">
                {/* <AcmeLogo /> */}
            </div>
            <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg">Mesa {1}</h3>
                    <span className={`h-3 w-3 rounded-full ${'available' === 'available' ? 'bg-success' : 'bg-danger'}`} />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                    {'available' === 'available' ? 'Disponible' : 'En consumo...'}
                </p>
                <button className="mt-4 w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
                    Ver Comanda
                </button>
            </div>
            <div className="mt-4 flex grow flex-col gap-4 md:flex-row">
                <div className="flex flex-col justify-center gap-6 rounded-lg bg-background border border-primary px-6 py-10 md:w-2/5 md:px-20">
                    <p
                        className={`text-xl text-foreground md:text-3xl md:leading-normal`}
                    >
                        <strong>{t('homePage.title')}</strong> {t('homePage.description')}

                    </p>
                    <Link
                        href="/login"
                        className="flex items-center gap-5 self-start rounded-lg bg-blue-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-400 md:text-base"
                    >
                        <span>Log in</span>{" "}
                        <ArrowRightIcon className="w-5 md:w-6" />
                    </Link>
                </div>
                <div className="flex items-center justify-center p-6 md:w-3/5 md:px-28 md:py-12">
                    {/* Add Hero Images Here */}
                </div>
            </div>
            <button className="bg-primary text-white px-6 py-4 rounded-2xl text-lg">
                Agregar platillo
            </button>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* tarjetas de mesas */}
            </div>

        </main>
    );
}
