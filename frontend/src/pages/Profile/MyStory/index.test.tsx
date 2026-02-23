/**
 * MyStory 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockFetchProfile = vi.fn();
const mockFetchFeedbackHistory = vi.fn();
const mockDeleteAllData = vi.fn();

let mockPsychState = {
  profile: null as Record<string, unknown> | null,
  feedbackHistory: [] as Record<string, unknown>[],
  loading: false,
  error: null as string | null,
  fetchProfile: mockFetchProfile,
  fetchFeedbackHistory: mockFetchFeedbackHistory,
  deleteAllData: mockDeleteAllData,
};

const mockStartSession = vi.fn();
const mockCheckResume = vi.fn().mockResolvedValue({ has_pending: false });
const mockRetryFailed = vi.fn();

vi.mock('@/store/psychProfileStore', () => ({
  usePsychProfileStore: () => mockPsychState,
}));
vi.mock('@/store/interviewStore', () => ({
  useInterviewStore: () => ({
    startSession: mockStartSession,
    checkResume: mockCheckResume,
    retryFailed: mockRetryFailed,
  }),
}));
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));
vi.mock('@/types/interview', () => ({
  getDomainLabel: (d: string) => d,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/Interview/RichnessRing', () => ({
  default: ({ score }: { score: number }) => <div data-testid="richness-ring">score:{score}</div>,
}));

import MyStory from './index';

function renderPage() {
  return render(
    <MemoryRouter>
      <MyStory />
    </MemoryRouter>
  );
}

describe('MyStory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPsychState = {
      profile: null,
      feedbackHistory: [],
      loading: false,
      error: null,
      fetchProfile: mockFetchProfile,
      fetchFeedbackHistory: mockFetchFeedbackHistory,
      deleteAllData: mockDeleteAllData,
    };
    mockCheckResume.mockResolvedValue({ has_pending: false });
  });

  it('loading 且無 profile 時應顯示 loading 狀態', () => {
    mockPsychState.loading = true;
    renderPage();
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('有 error 且無 profile 時應顯示錯誤提示', () => {
    mockPsychState.error = 'load failed';
    renderPage();
    expect(screen.getByText('common.loadFailed')).toBeInTheDocument();
  });

  it('未授權 (consent_given=false) 時應顯示引導', () => {
    mockPsychState.profile = { consent_given: false };
    renderPage();
    expect(screen.getByText('psychProfile.noStoryYet')).toBeInTheDocument();
  });

  it('已授權時應顯示主頁面與豐富度', () => {
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 75,
      narratives: [
        { domain: 'attachment', is_latest: true, completeness: 0.8, ai_summary: 'Summary' },
      ],
      insights: [
        { id: 'i1', domain: 'attachment', is_active: true, insight_type: 'trait', key: 'K', value: 'V', confidence: 0.9 },
      ],
    };
    renderPage();
    expect(screen.getByTestId('richness-ring')).toBeInTheDocument();
    expect(screen.getByText('psychProfile.myStoryTitle')).toBeInTheDocument();
    expect(screen.getByText('psychProfile.continueChat')).toBeInTheDocument();
  });

  it('掛載時應呼叫 fetchProfile 和 fetchFeedbackHistory', () => {
    mockPsychState.profile = { consent_given: true, richness_score: 0, narratives: [], insights: [] };
    renderPage();
    expect(mockFetchProfile).toHaveBeenCalled();
    expect(mockFetchFeedbackHistory).toHaveBeenCalled();
  });

  it('點擊刪除按鈕應打開確認 Modal', async () => {
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    fireEvent.click(screen.getByText('psychProfile.deleteAllData'));
    await waitFor(() => {
      expect(screen.getByText('psychProfile.deleteConfirmTitle')).toBeInTheDocument();
    });
  });

  it('checkResume 有 failed session 時應顯示 failed alert', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false, has_failed: true, failed_session_id: 'fs1' });
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('psychProfile.failedSessionTitle')).toBeInTheDocument();
    });
  });

  it('點擊重試按鈕應呼叫 retryFailed', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false, has_failed: true, failed_session_id: 'fs1' });
    mockRetryFailed.mockResolvedValue(undefined);
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('psychProfile.retryProcessing')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('psychProfile.retryProcessing'));
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledWith('fs1');
    });
  });

  it('確認刪除應呼叫 deleteAllData', async () => {
    mockDeleteAllData.mockResolvedValue(undefined);
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    fireEvent.click(screen.getByText('psychProfile.deleteAllData'));
    await waitFor(() => {
      expect(screen.getByText('psychProfile.deleteConfirmTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('psychProfile.confirmDelete'));
    await waitFor(() => {
      expect(mockDeleteAllData).toHaveBeenCalledOnce();
    });
  });

  it('繼續聊天 (有 pending session) 應導航到該 session', async () => {
    mockCheckResume
      .mockResolvedValueOnce({ has_pending: false })
      .mockResolvedValueOnce({ has_pending: true, session_id: 'resume-sess' });
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0.5,
      narratives: [{ domain: 'attachment', is_latest: true, completeness: 0.5 }],
      insights: [],
    };
    renderPage();
    fireEvent.click(screen.getByText('psychProfile.continueChat'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/interview/resume-sess');
    });
  });
});
