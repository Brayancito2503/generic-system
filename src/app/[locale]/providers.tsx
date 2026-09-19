'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/react-query';
import { NextIntlClientProvider } from 'next-intl';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Falls back to the ICU key path (namespace.key) whenever a message is
 * missing, so an incomplete locale renders a readable placeholder instead of
 * crashing the shell (tenant-dynamic-shell spec: missing key → fallback).
 */
export function IntlErrorHandlingProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
  return (
    <NextIntlClientProvider
      locale={locale}
      onError={(error) => console.error('[i18n]', error)}
      getMessageFallback={({ namespace, key }) => `${namespace}.${key}`}
    >
      {children}
    </NextIntlClientProvider>
  );
}