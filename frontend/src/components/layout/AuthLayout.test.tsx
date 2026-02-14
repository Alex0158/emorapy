/**
 * AuthLayout 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthLayout from './AuthLayout';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet</div>,
  };
});

describe('AuthLayout', () => {
  it('應渲染 Outlet', () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('應有 auth-layout class', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    );
    expect(container.querySelector('.auth-layout')).toBeInTheDocument();
  });
});
