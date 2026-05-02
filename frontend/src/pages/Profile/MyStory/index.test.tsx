/**
 * MyStory 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockMessageError = vi.fn();
const mockMessageInfo = vi.fn();
const mockMessageSuccess = vi.fn();
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
  getLocale: () => 'zh-TW',
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
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      ...actual.message,
      error: (...args: unknown[]) => mockMessageError(...args),
      info: (...args: unknown[]) => mockMessageInfo(...args),
      success: (...args: unknown[]) => mockMessageSuccess(...args),
    },
  };
});

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
    expect(screen.getByText('load failed')).toBeInTheDocument();
  });

  it('storeError 時點擊 retry 應呼叫 fetchProfile（F06 錯誤恢復：重試載入）', () => {
    mockPsychState.error = 'load failed';
    renderPage();
    expect(screen.getByText('common.retry')).toBeInTheDocument();
    fireEvent.click(screen.getByText('common.retry'));
    expect(mockFetchProfile).toHaveBeenCalledTimes(2); // 1 mount + 1 retry
  });

  it('storeError 時應仍可點擊 retry 或前往個人資料導向 /profile/index（F06 錯誤恢復：失敗不阻塞導航出口）', () => {
    mockPsychState.error = 'load failed';
    renderPage();
    expect(screen.getByText('common.retry')).toBeInTheDocument();
    expect(screen.getByText('settings.goToProfile')).toBeInTheDocument();
    fireEvent.click(screen.getByText('settings.goToProfile'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/index');
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

  it('profile.narratives 或 insights 為非陣列時應不崩潰並顯示空狀態（F06 邊界：API 回傳不完整時防禦）', () => {
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 50,
      narratives: { items: [] } as unknown,
      insights: null,
    };
    expect(() => renderPage()).not.toThrow();
    expect(screen.getByTestId('richness-ring')).toBeInTheDocument();
    expect(screen.getByText('psychProfile.noDomainData')).toBeInTheDocument();
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

  it('retryFailed 成功但組件已卸載時不應呼叫 message.info 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false, has_failed: true, failed_session_id: 'fs1' });
    let resolveRetry: (v: unknown) => void;
    mockRetryFailed.mockImplementation(
      () => new Promise((resolve) => { resolveRetry = resolve; })
    );
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('psychProfile.failedSessionTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('psychProfile.retryProcessing'));
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledWith('fs1');
    });
    unmount();
    resolveRetry!(undefined);
    await Promise.resolve();
    expect(mockMessageInfo).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
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

  it('重試失敗 session 成功後應導航到對應 result 頁（F06 跨頁回流一致性）', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false, has_failed: true, failed_session_id: 'fs1' });
    mockRetryFailed.mockResolvedValue(undefined);
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    const retryBtn = await screen.findByRole('button', { name: 'psychProfile.retryProcessing' });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledWith('fs1');
      expect(mockMessageInfo).toHaveBeenCalledWith('psychProfile.retryProcessing');
      expect(mockNavigate).toHaveBeenCalledWith('/interview/fs1/result');
    });
  });

  it('deleteAllData 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveDelete: (v: unknown) => void;
    mockDeleteAllData.mockImplementation(
      () => new Promise((resolve) => { resolveDelete = resolve; })
    );
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    const { unmount } = renderPage();
    fireEvent.click(screen.getByText('psychProfile.deleteAllData'));
    await waitFor(() => {
      expect(screen.getByText('psychProfile.deleteConfirmTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('psychProfile.confirmDelete'));
    await waitFor(() => {
      expect(mockDeleteAllData).toHaveBeenCalled();
    });
    unmount();
    resolveDelete!(undefined);
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
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

  it('繼續聊天 startSession 成功但組件已卸載時不應呼叫 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveStart: (v: unknown) => void;
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockImplementation(
      () => new Promise((resolve) => { resolveStart = resolve; })
    );
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    const { unmount } = renderPage();
    fireEvent.click(screen.getByText('psychProfile.continueChat'));
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith('organic');
    });
    unmount();
    resolveStart!({ id: 'new-sess' });
    await Promise.resolve();
    expect(mockNavigate).not.toHaveBeenCalled();
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

  it('繼續聊天 (有 failed session) 應導航到 result retry 頁且不再 startSession', async () => {
    mockCheckResume
      .mockResolvedValueOnce({ has_pending: false })
      .mockResolvedValueOnce({
        has_pending: false,
        has_failed: true,
        failed_session_id: 'failed-sess',
      });
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0.5,
      narratives: [{ domain: 'attachment', is_latest: true, completeness: 0.5 }],
      insights: [],
    };
    renderPage();
    fireEvent.click(screen.getByText('psychProfile.continueChat'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/interview/failed-sess/result');
      expect(mockStartSession).not.toHaveBeenCalled();
    });
  });

  it('繼續聊天 startSession 失敗且有 message 應顯示該 message（F06 錯誤處理約定）', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockRejectedValue(new Error('啟動訪談失敗'));
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    fireEvent.click(screen.getByText('psychProfile.continueChat'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('啟動訪談失敗');
    });
  });

  it('繼續聊天 startSession 失敗且無 message 應顯示 interview.startFail', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockRejectedValue({ code: 'SERVER_ERROR' });
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    fireEvent.click(screen.getByText('psychProfile.continueChat'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.startFail');
    });
  });

  it('繼續聊天 startSession 失敗後應仍可再次點擊繼續聊天，成功後應導航（F06 錯誤恢復：失敗不阻塞重試）', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession
      .mockRejectedValueOnce(new Error('網路錯誤'))
      .mockResolvedValueOnce({ id: 'sess-1' });
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    fireEvent.click(screen.getByText('psychProfile.continueChat'));
    await waitFor(() => expect(mockMessageError).toHaveBeenCalledWith('網路錯誤'));
    fireEvent.click(screen.getByText('psychProfile.continueChat'));
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith('/interview/sess-1');
    });
  });

  it('繼續聊天 startSession 失敗且 message 為空字串時應使用 interview.startFail（F10 邊界）', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    fireEvent.click(screen.getByText('psychProfile.continueChat'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.startFail');
    });
  });

  it('繼續聊天 startSession FORBIDDEN 且無 message 時應使用 interview.startFail（F06 權限邊界 fallback）', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockRejectedValue({ code: 'FORBIDDEN' });
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    fireEvent.click(screen.getByText('psychProfile.continueChat'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.startFail');
    });
  });

  it('重試失敗 session 時 retryFailed 失敗且有 message 應顯示該 message', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false, has_failed: true, failed_session_id: 'fs1' });
    mockRetryFailed.mockRejectedValue(new Error('重試處理失敗'));
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    const retryBtn = await screen.findByRole('button', { name: 'psychProfile.retryProcessing' });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('重試處理失敗');
    });
  });

  it('重試失敗 session 時 retryFailed 失敗且無 message 應顯示 interview.retryFail', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false, has_failed: true, failed_session_id: 'fs1' });
    mockRetryFailed.mockRejectedValue({ code: 'UNKNOWN' });
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    const retryBtn = await screen.findByRole('button', { name: 'psychProfile.retryProcessing' });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.retryFail');
    });
  });

  it('重試失敗 session 時 retryFailed FORBIDDEN 且無 message 時應使用 interview.retryFail（F06 權限邊界 fallback）', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false, has_failed: true, failed_session_id: 'fs1' });
    mockRetryFailed.mockRejectedValue({ code: 'FORBIDDEN' });
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    const retryBtn = await screen.findByRole('button', { name: 'psychProfile.retryProcessing' });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.retryFail');
    });
  });

  it('重試失敗 session 時 retryFailed 失敗且 message 為空字串時應使用 interview.retryFail（F10 邊界）', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false, has_failed: true, failed_session_id: 'fs1' });
    mockRetryFailed.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    const retryBtn = await screen.findByRole('button', { name: 'psychProfile.retryProcessing' });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.retryFail');
    });
  });

  it('重試失敗 session 時 retryFailed 失敗後應仍可再次點擊 retry，成功後應導回 result（F06 錯誤恢復：失敗不阻塞重試）', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false, has_failed: true, failed_session_id: 'fs1' });
    mockRetryFailed
      .mockRejectedValueOnce(new Error('第一次重試失敗'))
      .mockResolvedValueOnce(undefined);
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    const retryBtn = await screen.findByRole('button', { name: 'psychProfile.retryProcessing' });
    fireEvent.click(retryBtn);
    await waitFor(() => expect(mockMessageError).toHaveBeenCalledWith('第一次重試失敗'));
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledTimes(2);
      expect(mockRetryFailed).toHaveBeenLastCalledWith('fs1');
      expect(mockNavigate).toHaveBeenCalledWith('/interview/fs1/result');
    });
  });

  it('重試失敗 session 時 retryFailed 快速連點只會送出一次請求（F06 重試節流）', async () => {
    let resolveRetry: (v: unknown) => void;
    mockCheckResume.mockResolvedValue({ has_pending: false, has_failed: true, failed_session_id: 'fs1' });
    mockRetryFailed.mockImplementation(() => new Promise((resolve) => { resolveRetry = resolve; }));
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    const retryBtn = await screen.findByRole('button', { name: 'psychProfile.retryProcessing' });
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledTimes(1);
    });
    resolveRetry!(undefined);
  });

  it('刪除資料 deleteAllData 失敗且有 message 應顯示該 message', async () => {
    mockDeleteAllData.mockRejectedValue(new Error('刪除資料失敗'));
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
      expect(mockMessageError).toHaveBeenCalledWith('刪除資料失敗');
    });
  });

  it('刪除資料 deleteAllData 失敗且無 message 應顯示 psychProfile.deleteFail', async () => {
    mockDeleteAllData.mockRejectedValue({ code: 'SERVER_ERROR' });
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
      expect(mockMessageError).toHaveBeenCalledWith('psychProfile.deleteFail');
    });
  });

  it('刪除資料 deleteAllData 失敗後應仍可再次點擊確認刪除，成功後應導航（F06 錯誤恢復：失敗不阻塞重試）', async () => {
    mockDeleteAllData
      .mockRejectedValueOnce(new Error('暫無法刪除'))
      .mockResolvedValueOnce(undefined);
    mockPsychState.profile = {
      consent_given: true,
      richness_score: 0,
      narratives: [],
      insights: [],
    };
    renderPage();
    fireEvent.click(screen.getByText('psychProfile.deleteAllData'));
    await waitFor(() => expect(screen.getByText('psychProfile.deleteConfirmTitle')).toBeInTheDocument());
    fireEvent.click(screen.getByText('psychProfile.confirmDelete'));
    await waitFor(() => expect(mockMessageError).toHaveBeenCalledWith('暫無法刪除'));
    fireEvent.click(screen.getByText('psychProfile.confirmDelete'));
    await waitFor(() => {
      expect(mockDeleteAllData).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith('/profile/index');
    });
  });

  it('刪除資料 deleteAllData FORBIDDEN 且無 message 時應使用 psychProfile.deleteFail（F06 權限邊界 fallback）', async () => {
    mockDeleteAllData.mockRejectedValue({ code: 'FORBIDDEN' });
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
      expect(mockMessageError).toHaveBeenCalledWith('psychProfile.deleteFail');
    });
  });

  it('刪除資料 deleteAllData 失敗且 message 為空字串時應使用 psychProfile.deleteFail（F10 邊界）', async () => {
    mockDeleteAllData.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
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
      expect(mockMessageError).toHaveBeenCalledWith('psychProfile.deleteFail');
    });
  });
});
