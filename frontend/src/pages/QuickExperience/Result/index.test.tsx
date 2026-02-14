/**
 * QuickExperience Result 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuickExperienceResult from './index';

vi.mock('@/store/judgmentStore', () => ({
  useJudgmentStore: () => ({ isLoading: false, error: null }),
}));
vi.mock('@/store/sessionStore', () => ({
  useSessionStore: () => ({ session: null, refreshSession: vi.fn() }),
}));
vi.mock('@/services/api/judgment', () => ({
  getJudgmentByCaseId: vi.fn(),
}));
vi.mock('@/services/api/case', () => ({
  getCase: vi.fn(),
  uploadEvidence: vi.fn(),
}));
vi.mock('@/utils/storage', () => ({
  sessionStorage: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('./components/ResultHeader', () => ({ default: () => <div>ResultHeader</div> }));
vi.mock('./components/SummarySection', () => ({ default: () => <div>SummarySection</div> }));
vi.mock('./components/ResponsibilitySection', () => ({ default: () => <div>ResponsibilitySection</div> }));
vi.mock('./components/JudgmentSection', () => ({ default: () => <div>JudgmentSection</div> }));
vi.mock('./components/EvidenceUploadSection', () => ({ default: () => <div>EvidenceUploadSection</div> }));
vi.mock('./components/ActionsSection', () => ({ default: () => <div>ActionsSection</div> }));
vi.mock('./components/RegisterPromptSection', () => ({ default: () => <div>RegisterPromptSection</div> }));

describe('QuickExperienceResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/quick-experience/result/case-1']}>
        <Routes>
          <Route path="/quick-experience/result/:id" element={<QuickExperienceResult />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
