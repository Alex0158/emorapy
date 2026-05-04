/**
 * 應用主布局（Header + Content + Footer + BottomNav）
 *
 * 遷移: Ant Layout → 原生 div + Tailwind flex
 */

import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import BottomNav from './BottomNav';
import ScrollToTop from '@/components/common/ScrollToTop';

const AppLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default AppLayout;
