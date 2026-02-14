/**
 * QuickExperience Create 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuickExperienceCreate from './index';

vi.mock('@/store/sessionStore', () => ({
  useSessionStore: () => ({
    createSession: vi.fn().mockResolvedValue(undefined),
    session: null,
    setSession: vi.fn(),
  }),
}));
vi.mock('@/store/caseStore', () => ({
  useCaseStore: () => ({
    createQuickCase: vi.fn(),
    currentCase: null,
    isLoading: false,
  }),
}));
vi.mock('@/utils/storage', () => ({
  localStore: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
  sessionStorage: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
  caseSessionMap: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/BearJudge', () => ({ default: () => <span>BearJudge</span> }));
vi.mock('@/components/business/StatementInput', () => ({ default: () => <input /> }));
vi.mock('@/components/business/FileUpload', () => ({ default: () => <div>FileUpload</div> }));
vi.mock('@/components/common/KeyboardShortcuts', () => ({ default: () => null }));
vi.mock('@/components/common/GuideTooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/services/api/case', () => ({
  getCaseBySessionId: vi.fn().mockResolvedValue(null),
}));

describe('QuickExperienceCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應掛載且不崩潰', () => {
    const { container } = render(
      <MemoryRouter>
        <QuickExperienceCreate />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
