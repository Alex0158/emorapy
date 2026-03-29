/**
 * 路由配置單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { router, AdminRedirect, LazyWrapper } from './index';

const mockGetAdminLoginUrl = vi.fn();
vi.mock('@/utils/adminEntry', () => ({
  getAdminLoginUrl: () => mockGetAdminLoginUrl(),
}));

describe('router', () => {
  it('應導出 router 實例', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('object');
  });

  it('quick-experience 索引路由應重定向到 /quick-experience/create', () => {
    const quickExperienceRoute = router.routes.find((route) => route.path === '/quick-experience');
    const indexRoute = quickExperienceRoute?.children?.find((child) => child.index);
    const navigateElement = indexRoute?.element as { props?: { to?: string; replace?: boolean } } | undefined;

    expect(indexRoute).toBeDefined();
    expect(navigateElement?.props?.to).toBe('/quick-experience/create');
    expect(navigateElement?.props?.replace).toBe(true);
  });
});

describe('LazyWrapper', () => {
  it('應以 Suspense 包裝 children 並渲染', () => {
    render(
      <LazyWrapper>
        <div>LazyChild</div>
      </LazyWrapper>
    );
    expect(screen.getByText('LazyChild')).toBeInTheDocument();
  });
});

describe('AdminRedirect', () => {
  const assignMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: { assign: assignMock },
      writable: true,
    });
  });

  it('無 admin URL 時應顯示可理解 fallback 與可行出口', () => {
    mockGetAdminLoginUrl.mockReturnValue(null);
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminRedirect />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('管理後台入口未配置')).toBeInTheDocument();
    expect(screen.getByText('未配置管理端登入網址，請聯繫管理員')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /返回首頁/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /前往快速體驗/ })).toBeInTheDocument();
  });

  it('無 admin URL 時點擊返回首頁應導向 /', async () => {
    mockGetAdminLoginUrl.mockReturnValue(null);
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminRedirect />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('管理後台入口未配置');
    screen.getByRole('button', { name: /返回首頁/ }).click();
    expect(assignMock).toHaveBeenCalledWith('/');
  });

  it('無 admin URL 時點擊前往快速體驗應導向 /quick-experience/create', async () => {
    mockGetAdminLoginUrl.mockReturnValue(null);
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminRedirect />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('管理後台入口未配置');
    screen.getByRole('button', { name: /前往快速體驗/ }).click();
    expect(assignMock).toHaveBeenCalledWith('/quick-experience/create');
  });

  it('有 admin URL 時應呼叫 window.location.assign', () => {
    mockGetAdminLoginUrl.mockReturnValue('https://admin.example.com/login');
    render(<AdminRedirect />);
    expect(assignMock).toHaveBeenCalledWith('https://admin.example.com/login');
  });

  it('assign 拋錯時不應阻斷', () => {
    mockGetAdminLoginUrl.mockReturnValue('https://admin.example.com/login');
    assignMock.mockImplementation(() => {
      throw new Error('assign not supported');
    });
    expect(() => render(<AdminRedirect />)).not.toThrow();
  });
});
