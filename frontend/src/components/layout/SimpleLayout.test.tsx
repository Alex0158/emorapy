/**
 * SimpleLayout 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SimpleLayout from './SimpleLayout';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet</div>,
  };
});

vi.mock('@/components/common/ScrollToTop', () => ({ default: () => null }));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));

describe('SimpleLayout', () => {
  it('應渲染 Logo 與 Outlet', () => {
    render(
      <MemoryRouter>
        <SimpleLayout />
      </MemoryRouter>
    );
    expect(screen.getByText('nav.logo')).toBeInTheDocument();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });
});
