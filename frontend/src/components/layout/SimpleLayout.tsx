/**
 * 簡化布局（快速體驗模式：僅 Logo，無 Header 和 Footer）
 */

import { Outlet, Link } from 'react-router-dom';
import ScrollToTop from '@/components/common/ScrollToTop';
import { t } from '@/utils/i18n';

const SimpleLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollToTop />
      <header className="flex h-14 items-center px-6">
        <Link to="/" className="text-base font-bold text-foreground font-heading">
          ✨ {t('nav.logo')}
        </Link>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default SimpleLayout;
