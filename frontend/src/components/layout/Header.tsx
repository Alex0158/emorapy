/**
 * 頂部導航欄
 *
 * 遷移: Ant Layout.Header/Menu/Button/Dropdown/Avatar/Badge/Select/Icons
 *       → shadcn DropdownMenu + Select + Button + Avatar + Tailwind + Lucide
 * 保留: 所有導航邏輯、unread count、locale 切換、admin 連結
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, LogIn, User, LogOut, Globe, FileText,
  MessageCircle, Bell, Settings,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { cn } from '@/lib/utils';
import { t, getLocale, onLocaleChange, setLocale, type Locale } from '@/utils/i18n';
import VersionPopover from './VersionPopover';

const NAV_PREFIX_MAP: Record<string, string> = {
  '/case': '/case/list',
  '/judgment': '/case/list',
  '/reconciliation': '/case/list',
  '/execution': '/case/list',
  '/profile': '/profile/index',
  '/chat': '/chat/room',
};

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);
  const [locale, setLocalLocale] = useState<Locale>(getLocale());

  const activeKey = useMemo(() => {
    const { pathname } = location;
    if (pathname === '/') return '/';
    for (const [prefix, key] of Object.entries(NAV_PREFIX_MAP)) {
      if (pathname.startsWith(prefix)) return key;
    }
    return pathname;
  }, [location]);

  useEffect(() => {
    const unsubscribe = onLocaleChange(() => setLocalLocale(getLocale()));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchUnreadCount();
    const handleFocus = () => { void fetchUnreadCount(); };
    window.addEventListener('focus', handleFocus);
    return () => { window.removeEventListener('focus', handleFocus); };
  }, [fetchUnreadCount, isAuthenticated]);

  const handleLocaleChange = useCallback((value: string) => {
    setLocalLocale(value as Locale);
    setLocale(value as Locale);
  }, []);

  const navLinks = isAuthenticated
    ? [
        { key: '/case/list', icon: FileText, label: t('nav.formalHandling') },
        { key: '/chat/room', icon: MessageCircle, label: t('nav.chatToJudgment') },
        { key: '/profile/index', icon: User, label: t('nav.understandYou') },
      ]
    : [
        { key: '/quick-experience/create', icon: undefined, label: t('nav.quickCheck') },
      ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-card/90 backdrop-blur-xl max-md:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 text-base font-bold tracking-tight text-foreground font-heading">
          <span>✨</span>
          <span>{t('nav.logo')}</span>
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-1">
          <NavLink to="/" active={activeKey === '/'}>
            <Home className="size-4" />
            <span>{t('nav.home')}</span>
          </NavLink>
          {navLinks.map((link) => (
            <NavLink key={link.key} to={link.key} active={activeKey === link.key}>
              {link.icon && <link.icon className="size-4" />}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <VersionPopover />

          {/* Notifications */}
          {isAuthenticated && (
            <div data-testid="notification-badge" data-count={unreadCount}>
              <button
                onClick={() => navigate('/notifications')}
                className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={t('nav.notifications')}
              >
                <Bell className="size-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Locale */}
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger
              className="h-8 w-[100px] text-xs border-0 bg-transparent"
              aria-label={t('auth.locale.label')}
            >
              <Globe className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-TW">{t('auth.locale.zhTW')}</SelectItem>
              <SelectItem value="en-US">{t('auth.locale.enUS')}</SelectItem>
            </SelectContent>
          </Select>

          {/* User Menu */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
                  <Avatar className="size-7">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {(user?.nickname || user?.email || '?')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground max-w-[100px] truncate">
                    {user?.nickname || user?.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/profile/index')}>
                  <User className="size-4" />
                  {t('nav.profile')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/profile/settings')}>
                  <Settings className="size-4" />
                  {t('nav.settings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logout(); navigate('/'); }}>
                  <LogOut className="size-4" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth/login" className="gap-1.5">
                  <LogIn className="size-4" />
                  {t('nav.login')}
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/auth/register">{t('nav.register')}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-primary/10 font-medium text-foreground ring-1 ring-primary/20'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}

export default Header;
