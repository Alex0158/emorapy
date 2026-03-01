/**
 * Case Review 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CaseReview from './index';

vi.mock('@/services/api/case', () => ({
  getCase: vi.fn().mockResolvedValue({
    id: '123', status: 'submitted', title: 'Test Case',
    plaintiff_statement: 'A', defendant_statement: 'B',
  }),
}));
vi.mock('@/services/api/judgment', () => ({
  getJudgmentByCaseId: vi.fn().mockResolvedValue(null),
  generateJudgment: vi.fn(),
}));
vi.mock('@/hooks/usePolling', () => ({
  usePolling: () => ({ startPolling: vi.fn(), stopPolling: vi.fn(), isPolling: false }),
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('CaseReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/case/123/review']}>
        <Routes>
          <Route path="/case/:id/review" element={<CaseReview />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('AI正在審理中')).toBeInTheDocument();
    });
  });
});
