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

vi.mock('antd', () => {
  const Layout = {
    Header: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <header className={className}>{children}</header>
    ),
  };

  const Menu = ({ items }: { items: Array<{ key: string; label: React.ReactNode; disabled?: boolean }> }) => (
    <nav>
      {items.map((item) => (
        <div key={item.key} aria-disabled={item.disabled ? 'true' : 'false'}>
          {item.label}
        </div>
      ))}
    </nav>
  );

  const Button = ({ children, onClick, 'aria-label': ariaLabel }: { children?: React.ReactNode; onClick?: () => void; 'aria-label'?: string }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
  const Dropdown = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Avatar = () => <div />;
  const Space = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>;
  const Select = () => <select aria-label="locale-select" />;
  const Badge = ({ children, count }: { children: React.ReactNode; count?: number }) => (
    <div data-testid="notification-badge" data-count={count ?? 0}>{children}</div>
  );

  return { Layout, Menu, Button, Dropdown, Avatar, Space, Select, Badge };
});

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
