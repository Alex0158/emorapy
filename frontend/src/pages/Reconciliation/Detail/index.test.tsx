/**
 * Reconciliation Detail 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReconciliationDetail from './index';

vi.mock('@/services/api/reconciliation', () => ({
  getPlans: vi.fn(),
  selectPlan: vi.fn(),
  getPlanById: vi.fn(),
}));
vi.mock('@/services/api/execution', () => ({
  confirmExecution: vi.fn(),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ReconciliationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/reconciliation/j1/plan-1']}>
        <Routes>
          <Route path="/reconciliation/:judgmentId/:id" element={<ReconciliationDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
