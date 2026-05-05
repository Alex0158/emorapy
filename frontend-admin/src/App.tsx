import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { router } from './router';
import { getLocale, onLocaleChange } from '@/utils/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [locale, setLocale] = useState(getLocale());

  useEffect(() => {
    const unsubscribe = onLocaleChange(() => setLocale(getLocale()));
    return unsubscribe;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div className="p-6">Loading...</div>}>
        <RouterProvider key={locale} router={router} />
      </Suspense>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
