/**
 * AuthLayout 組件單元測試
 *
 * 遷移: legacy select → shadcn/Radix Select
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
    expect(screen.getByRole('heading', {
      name: 'auth.brand.taglineLine1 auth.brand.taglineLine2',
    })).toBeInTheDocument();
  });

  it('mobile reading order 應先提供 safety 與操作，再顯示長品牌敘事', () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    const outlet = screen.getByTestId('outlet');
    const heading = screen.getByRole('heading', {
      name: 'auth.brand.taglineLine1 auth.brand.taglineLine2',
    });

    expect(outlet.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
