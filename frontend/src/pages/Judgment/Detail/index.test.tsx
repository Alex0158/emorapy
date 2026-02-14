/**
 * Judgment Detail 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JudgmentDetail from './index';

vi.mock('@/services/api/judgment', () => ({
  getJudgmentByCaseId: vi.fn(),
  getJudgment: vi.fn(),
}));
vi.mock('@/services/api/case', () => ({
  getCase: vi.fn(),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));

describe('JudgmentDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/judgment/case-1']}>
        <Routes>
          <Route path="/judgment/:caseId" element={<JudgmentDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
