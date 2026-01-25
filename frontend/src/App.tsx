/**
 * 應用根組件
 */

import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect } from 'react';
import { router } from './router';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loading from './components/common/Loading';
import BackToTop from './components/common/BackToTop';
import NetworkStatus from './components/common/NetworkStatus';
import { logPageLoadTime } from './utils/performance';
import { initSEO } from './utils/seo';
import { useAuthStore } from './store/authStore';
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

  useEffect(() => {
    // 記錄頁面加載時間
    logPageLoadTime();

    // 初始化全局SEO
    initSEO({
      title: '熊媽媽法庭',
      description: '大愛、包容、保護、呵護，為您的關係提供公正溫暖的判決。',
      keywords: '情侶衝突,關係修復,AI判決,和好方案,熊媽媽法庭',
      image: `${window.location.origin}/images/bear-judge/mother-bear-judge-large.png`,
      url: window.location.origin,
    });

    // 檢查認證狀態
    checkAuth();
  }, [checkAuth]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={theme} locale={zhCN}>
          <NetworkStatus />
          <Suspense fallback={<Loading />}>
            <RouterProvider router={router} />
          </Suspense>
          <BackToTop />
        </ConfigProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
