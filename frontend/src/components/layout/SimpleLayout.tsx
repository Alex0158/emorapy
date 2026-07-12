/**
 * 簡化布局（快速體驗模式：僅 Logo，無 Header 和 Footer）
 */

import { Outlet } from 'react-router-dom';
import ScrollToTop from '@/components/common/ScrollToTop';
import BrandMark from '@/components/common/BrandMark';

const SimpleLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollToTop />
      <header className="border-b border-border px-5">
        <div className="mx-auto flex h-16 max-w-6xl items-center">
          <BrandMark compact />
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default SimpleLayout;
