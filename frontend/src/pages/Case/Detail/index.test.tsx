/**
 * Case Detail 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CaseDetail from './index';

vi.mock('@/services/api/case', () => ({
  getCase: vi.fn(),
  submitCase: vi.fn(),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('CaseDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/case/123']}>
        <Routes>
          <Route path="/case/:id" element={<CaseDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
