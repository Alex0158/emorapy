/**
 * AuthLayout 組件單元測試
 *
 * 遷移: Ant Design Select → shadcn/Radix Select
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet</div>,
  };
});

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
  getLocale: () => 'zh-TW',
  setLocale: vi.fn(),
  onLocaleChange: () => () => {},
}));

import AuthLayout from './AuthLayout';

describe('AuthLayout', () => {
  it('應渲染 Outlet', () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('應有語言切換 Select 觸發按鈕', () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    expect(screen.getByRole('combobox', { name: 'auth.locale.ariaLabel' })).toBeInTheDocument();
  });

  it('應顯示品牌標語', () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    expect(screen.getByText('auth.brand.taglineLine1')).toBeInTheDocument();
  });

  it('應顯示品牌 Logo 文字', () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    expect(screen.getByText('nav.logo')).toBeInTheDocument();
  });
});
