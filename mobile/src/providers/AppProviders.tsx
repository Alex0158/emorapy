import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { paperTheme } from '@/src/ui/theme';

import { AuthSessionBootstrap } from './AuthSessionBootstrap';
import { ObservabilityBootstrap } from './ObservabilityBootstrap';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <SafeAreaProvider>
      <PaperProvider theme={{ ...MD3LightTheme, ...paperTheme }}>
        <QueryClientProvider client={queryClient}>
          <ObservabilityBootstrap />
          <AuthSessionBootstrap />
          {children}
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
