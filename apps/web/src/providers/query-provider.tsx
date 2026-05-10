'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 5 minutes "fresh" — enough that nav between pages doesn't
            // refetch the same data; short enough that scan completion still
            // feels responsive after we explicitly invalidate.
            staleTime: 5 * 60 * 1000,
            // Keep cached data around for 30 minutes after last use, so
            // back/forward navigation paints from cache instantly.
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            retry: 1,
          },
        },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
