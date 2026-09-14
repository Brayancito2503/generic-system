'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/react-query';
import { ThemeProvider } from 'next-themes';

export function Providers({ children, ...props }: React.ComponentProps<typeof ThemeProvider>) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider {...props}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
