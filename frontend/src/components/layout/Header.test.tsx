/**
 * Header 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

const { mockGetAdminLoginUrl, mockAuthState, mockNotificationState, mockNavigate } = vi.hoisted(() => ({
  mockGetAdminLoginUrl: vi.fn(() => 'https://admin.example.com/admin/login'),
  mockAuthState: {
    isAuthenticated: false,
    user: null as null | { nickname?: string; email?: string; avatar_url?: string },
    logout: vi.fn(),
  },
  mockNotificationState: {
    unreadCount: 0,
    fetchUnreadCount: vi.fn().mockResolvedValue(0),
  },
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

vi.mock('@/store/notificationStore', () => ({
  useNotificationStore: (selector: (state: typeof mockNotificationState) => unknown) => selector(mockNotificationState),
}));

vi.mock('@/utils/adminEntry', () => ({
  getAdminLoginUrl: () => mockGetAdminLoginUrl(),
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'nav.home': '首頁',
      'nav.quickExperience': '快速體驗',
      'nav.chat': '聊天',
      'nav.login': '登錄',
      'nav.register': '註冊',
      'nav.logo': 'CJ',
      'nav.opsConsole': '運維後台',
      'nav.notifications': '通知中心',
      'nav.myCases': '我的案件',
      'nav.execution': '執行',
      'nav.profile': '個人資料',
      'nav.settings': '設置',
      'nav.logout': '登出',
      'auth.locale.zhTW': '繁體中文',
      'auth.locale.enUS': 'English',
    };
    return map[key] ?? key;
  },
  getLocale: () => 'zh-TW',
  onLocaleChange: () => () => {},
  setLocale: vi.fn(),
}));

vi.mock('./VersionPopover', () => ({
  default: () => <div>version-popover</div>,
}));

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminLoginUrl.mockReturnValue('https://admin.example.com/admin/login');
    mockAuthState.isAuthenticated = false;
    mockAuthState.user = null;
    mockNotificationState.unreadCount = 0;
    mockNotificationState.fetchUnreadCount.mockResolvedValue(0);
  });

  it('應渲染首頁與快速體驗連結', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText('首頁')).toBeInTheDocument();
    expect(screen.getByText('快速體驗')).toBeInTheDocument();
  });

  it('未登入時應顯示登入按鈕', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText('登錄')).toBeInTheDocument();
  });

  it('有 admin URL 時應渲染可用連結', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: /運維/ });
    expect(link).toHaveAttribute('href', 'https://admin.example.com/admin/login');
  });

  it('無 admin URL 時不應渲染可點擊連結', () => {
    mockGetAdminLoginUrl.mockReturnValue(null);
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.queryByRole('link', { name: /運維/ })).toBeNull();
    expect(screen.getByText(/運維/)).toBeInTheDocument();
  });

  it('登入後應顯示通知入口並拉取未讀數', async () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { email: 'user@example.com', nickname: 'CJ' };
    mockNotificationState.unreadCount = 3;

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNotificationState.fetchUnreadCount).toHaveBeenCalled();
    });

    expect(screen.getByTestId('notification-badge')).toHaveAttribute('data-count', '3');
    await userEvent.click(screen.getByRole('button', { name: '通知中心' }));
    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });
});
