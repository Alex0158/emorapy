import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { router } from './router';
import { getLocale, onLocaleChange } from '@/utils/i18n';
import '@/App.less';

const theme = {
  token: {
    colorPrimary: '#FF8C42',
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    colorInfo: '#1890FF',
    borderRadius: 8,
  },
};

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

  const antdLocale = useMemo(() => (locale === 'en-US' ? enUS : zhCN), [locale]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={theme} locale={antdLocale}>
        <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
          <RouterProvider key={locale} router={router} />
        </Suspense>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
