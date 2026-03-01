/**
 * Header 組件單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

const { mockGetAdminLoginUrl } = vi.hoisted(() => ({
  mockGetAdminLoginUrl: vi.fn(() => 'https://admin.example.com/admin/login'),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    user: null,
    logout: vi.fn(),
  }),
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

  const Button = ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>;
  const Dropdown = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Avatar = () => <div />;
  const Space = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Select = () => <select aria-label="locale-select" />;

  return { Layout, Menu, Button, Dropdown, Avatar, Space, Select };
});

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminLoginUrl.mockReturnValue('https://admin.example.com/admin/login');
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
});
