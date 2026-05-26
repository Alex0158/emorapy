/**
 * 移動端底部導航
 *
 * 遷移: legacy icons → Lucide + Tailwind（md:hidden 保持只在移動端顯示）
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PlusCircle, MessageCircle, User, FileText } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { t } from '@/utils/i18n';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const navItems = isAuthenticated
    ? [
        { key: '/', icon: Home, label: t('nav.home') },
        { key: '/case/list', icon: FileText, label: t('nav.formalHandling') },
        { key: '/case/create', icon: PlusCircle, label: t('nav.submitFormal'), isPrimary: true },
        { key: '/chat/room', icon: MessageCircle, label: t('nav.chatToJudgment') },
        { key: '/profile/index', icon: User, label: t('nav.understandYou') },
      ]
    : [
        { key: '/', icon: Home, label: t('nav.home') },
        { key: '/quick-experience/create', icon: PlusCircle, label: t('nav.quickCheck'), isPrimary: true },
        { key: '/auth/login', icon: User, label: t('nav.login') },
      ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur-sm md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.key || (item.key !== '/' && location.pathname.startsWith(item.key));
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(item.key)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors',
              item.isPrimary && 'relative -top-2',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className={cn('size-5', item.isPrimary && 'size-7 text-primary')} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
