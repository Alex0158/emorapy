/**
 * Case Review 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CaseReview from './index';

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));

describe('CaseReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/case/123/review']}>
        <Routes>
          <Route path="/case/:id/review" element={<CaseReview />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
