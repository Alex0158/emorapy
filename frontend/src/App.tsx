/**
 * 應用根組件
 */

import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { router } from './router';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loading from './components/common/Loading';
import BackToTop from './components/common/BackToTop';
import NetworkStatus from './components/common/NetworkStatus';
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
    initSEO({
      title: t('nav.logo'),
      description: t('home.description'),
      keywords: t('home.keywords'),
      image: `${window.location.origin}/vite.svg`,
      url: window.location.origin,
    });
    checkAuth();
  }, [checkAuth, locale]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NetworkStatus />
        <Suspense fallback={<Loading />}>
          <RouterProvider key={locale} router={router} />
        </Suspense>
        <BackToTop />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
