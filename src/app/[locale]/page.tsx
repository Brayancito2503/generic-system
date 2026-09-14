import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { getTranslations } from 'next-intl/server';

export default async function LandingPage() {
  const t = await getTranslations('homePage');

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background p-6 text-foreground">
      <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
      <p className="max-w-md text-center text-muted-foreground">{t('description')}</p>
      <Link
        href="/login"
        className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <span>{t('login')}</span>
        <ArrowRightIcon className="size-4" />
      </Link>
    </main>
  );
}