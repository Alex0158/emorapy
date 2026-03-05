/**
 * 應用根組件
 */

import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { router } from './router';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loading from './components/common/Loading';
import BackToTop from './components/common/BackToTop';
import NetworkStatus from './components/common/NetworkStatus';
import { logPageLoadTime } from './utils/performance';
import { initSEO } from './utils/seo';
import { useAuthStore } from './store/authStore';
import { getLocale, onLocaleChange, t } from './utils/i18n';
import './App.less';

// 配置Ant Design主題
const theme = {
  token: {
    colorPrimary: '#FF8C42', // 溫暖橘
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    colorInfo: '#1890FF',
    borderRadius: 8,
  },
};

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
    // 記錄頁面加載時間
    logPageLoadTime();

    // 初始化全局SEO
    initSEO({
      title: t('nav.logo'),
      description: t('home.description'),
      keywords: t('home.keywords'),
      image: `${window.location.origin}/vite.svg`,
      url: window.location.origin,
    });

    // 檢查認證狀態
    checkAuth();
  }, [checkAuth, locale]);

  const antdLocale = useMemo(() => (locale === 'en-US' ? enUS : zhCN), [locale]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={theme} locale={antdLocale}>
          <NetworkStatus />
          <Suspense fallback={<Loading />}>
            <RouterProvider key={locale} router={router} />
          </Suspense>
          <BackToTop />
        </ConfigProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
