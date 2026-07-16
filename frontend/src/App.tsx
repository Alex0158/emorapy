/**
 * 應用根組件
 */

import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { router } from './router';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loading from './components/common/Loading';
import NetworkStatus from './components/common/NetworkStatus';
import { Toaster } from './components/ui/sonner';
import { logPageLoadTime } from './utils/performance';
import { initSEO } from './utils/seo';
import { useAuthStore } from './store/authStore';
import { getLocale, onLocaleChange, t } from './utils/i18n';

// 創建React Query客戶端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分鐘
      gcTime: 10 * 60 * 1000, // 10分鐘（原cacheTime）
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { checkAuth } = useAuthStore();
  const [locale, setLocale] = useState(getLocale());

  useEffect(() => {
    const unsubscribe = onLocaleChange(() => setLocale(getLocale()));
    return unsubscribe;
  }, []);

  useEffect(() => {
    logPageLoadTime();
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    initSEO({
      title: t('nav.logo'),
      description: t('home.description'),
      keywords: t('home.keywords'),
      url: window.location.origin,
    });
  }, [locale]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NetworkStatus />
        <Toaster position="top-center" richColors closeButton />
        <Suspense fallback={<Loading />}>
          <RouterProvider router={router} />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
