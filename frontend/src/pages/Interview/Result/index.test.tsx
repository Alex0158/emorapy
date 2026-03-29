/**
 * Interview Result 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockGetSession = vi.fn();
const mockRetryFailed = vi.fn();
const mockMessageError = vi.fn();
const mockMessageInfo = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      ...actual.message,
      error: (...args: unknown[]) => mockMessageError(...args),
      info: (...args: unknown[]) => mockMessageInfo(...args),
      success: vi.fn(),
    },
  };
});

let mockStoreState = {
  currentSession: null as Record<string, unknown> | null,
  loading: false,
  error: null as string | null,
  getSession: mockGetSession,
  retryFailed: mockRetryFailed,
};

vi.mock('@/store/interviewStore', () => ({
  useInterviewStore: () => mockStoreState,
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('@/components/business/Interview/FeedbackCard', () => ({
  default: ({ feedback }: { feedback: { summary?: string } }) => (
    <div data-testid="feedback-card">{feedback.summary || 'feedback'}</div>
  ),
}));

import InterviewResult from './index';

function renderWithRouter(sessionId = 'test-session') {
  return render(
    <MemoryRouter initialEntries={[`/interview/${sessionId}/result`]}>
      <Routes>
        <Route path="/interview/:sessionId/result" element={<InterviewResult />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InterviewResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(undefined);
    mockStoreState = {
      currentSession: null,
      loading: false,
      error: null,
      getSession: mockGetSession,
      retryFailed: mockRetryFailed,
    };
  });

  it('loading 且無 session 時應顯示 loading', () => {
    mockStoreState.loading = true;
    renderWithRouter();
    expect(screen.getByText('interview.result.loading')).toBeInTheDocument();
  });

  it('session 為 processing 時應顯示等待中畫面', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'processing' };
    renderWithRouter();
    expect(screen.getByText('interview.result.processingTitle')).toBeInTheDocument();
  });

  it('processing 超時時應顯示 keep waiting 與返回個人資料出口', async () => {
    vi.useFakeTimers();
    try {
      mockStoreState.currentSession = { id: 'test-session', status: 'processing' };
      renderWithRouter();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(screen.getByText('interview.result.processingSlowTitle')).toBeInTheDocument();
      expect(screen.getByText('interview.result.keepWaiting')).toBeInTheDocument();
      expect(screen.getByText('interview.result.backProfile')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('processing 超時時點擊返回個人資料應導向 /profile/index', async () => {
    vi.useFakeTimers();
    try {
      mockStoreState.currentSession = { id: 'test-session', status: 'processing' };
      renderWithRouter();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      fireEvent.click(screen.getByText('interview.result.backProfile'));
      expect(mockNavigate).toHaveBeenCalledWith('/profile/index');
    } finally {
      vi.useRealTimers();
    }
  });

  it('session 為 processing_failed 時應顯示失敗畫面與重試按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    expect(screen.getByText('interview.result.failedTitle')).toBeInTheDocument();
    expect(screen.getByText('interview.result.retry')).toBeInTheDocument();
    expect(screen.getByText('interview.result.backProfile')).toBeInTheDocument();
  });

  it('processing_failed 時應仍可返回個人資料（F06 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    await userEvent.click(screen.getByText('interview.result.backProfile'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/index');
  });

  it('session 為 completed 且有 feedback_card 時應渲染 FeedbackCard', () => {
    mockStoreState.currentSession = {
      id: 'test-session',
      status: 'completed',
      feedback_card: JSON.stringify({ summary: '心理回饋摘要' }),
    };
    renderWithRouter();
    expect(screen.getByTestId('feedback-card')).toBeInTheDocument();
    expect(screen.getByText('心理回饋摘要')).toBeInTheDocument();
  });

  it('session 為 completed 但無有效 feedback_card 時應顯示完成結果', () => {
    mockStoreState.currentSession = {
      id: 'test-session',
      status: 'completed',
      feedback_card: null,
    };
    renderWithRouter();
    expect(screen.getByText('interview.result.doneTitle')).toBeInTheDocument();
  });

  it('session 為 completed 但 feedback_card 為 invalid JSON 時應顯示完成結果', () => {
    mockStoreState.currentSession = {
      id: 'test-session',
      status: 'completed',
      feedback_card: 'not-json',
    };
    renderWithRouter();
    expect(screen.getByText('interview.result.doneTitle')).toBeInTheDocument();
  });

  it('掛載時若無 session 應呼叫 getSession', () => {
    renderWithRouter();
    expect(mockGetSession).toHaveBeenCalledWith('test-session');
  });

  it('已有匹配 session 時不應重新呼叫 getSession', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'completed' };
    renderWithRouter();
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('processing_failed 時點擊重試應呼叫 retryFailed', async () => {
    mockRetryFailed.mockResolvedValue(undefined);
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.result.retry'));
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledWith('test-session');
    });
  });

  it('processing_failed 時 retryFailed 失敗且有 message 應顯示該 message（F06 錯誤處理約定）', async () => {
    mockRetryFailed.mockRejectedValue(new Error('重試失敗'));
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.result.retry'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('重試失敗');
    });
  });

  it('processing_failed 時 retryFailed 失敗且無 message 應顯示 interview.retryFail', async () => {
    mockRetryFailed.mockRejectedValue({ code: 'SERVER_ERROR' });
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.result.retry'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.retryFail');
    });
  });

  it('processing_failed 時 retryFailed 成功但 getSession 失敗且有 message 應顯示該 message', async () => {
    mockRetryFailed.mockResolvedValue(undefined);
    mockGetSession.mockRejectedValueOnce(new Error('get session failed'));
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.result.retry'));
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledWith('test-session');
      expect(mockGetSession).toHaveBeenCalledWith('test-session');
      expect(mockMessageError).toHaveBeenCalledWith('get session failed');
    });
  });

  it('processing_failed 時 retryFailed 成功但 getSession 失敗且無 message 應顯示 interview.retryFail（F06 錯誤處理約定）', async () => {
    mockRetryFailed.mockResolvedValue(undefined);
    mockGetSession.mockRejectedValueOnce({ code: 'SERVER_ERROR' });
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.result.retry'));
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledWith('test-session');
      expect(mockGetSession).toHaveBeenCalledWith('test-session');
      expect(mockMessageError).toHaveBeenCalledWith('interview.retryFail');
    });
  });

  it('processing_failed 時 retryFailed 成功但 getSession 失敗且 message 為空字串應使用 retryFail（F10 邊界）', async () => {
    mockRetryFailed.mockResolvedValue(undefined);
    mockGetSession.mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.result.retry'));
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledWith('test-session');
      expect(mockGetSession).toHaveBeenCalledWith('test-session');
      expect(mockMessageError).toHaveBeenCalledWith('interview.retryFail');
    });
  });

  it('processing_failed 時 retryFailed 失敗且 message 為空字串應使用 retryFail（F10 邊界）', async () => {
    mockRetryFailed.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.result.retry'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.retryFail');
    });
  });

  it('processing_failed 時 retryFailed FORBIDDEN 且無 message 時應使用 retryFail（F06 權限邊界 fallback）', async () => {
    mockRetryFailed.mockRejectedValue({ code: 'FORBIDDEN' });
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.result.retry'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.retryFail');
    });
  });

  it('processing_failed 時 retryFailed 成功但組件已卸載時不應呼叫 message.info（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    let resolveRetryFailed: () => void;
    mockRetryFailed.mockImplementation(
      () => new Promise<void>((resolve) => { resolveRetryFailed = resolve; })
    );
    const { unmount } = renderWithRouter();
    fireEvent.click(screen.getByText('interview.result.retry'));
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledWith('test-session');
    });
    unmount();
    resolveRetryFailed!();
    await Promise.resolve();
    expect(mockMessageInfo).not.toHaveBeenCalled();
  });

  it('processing_failed 時 retryFailed 失敗後應仍可再次點擊 retry，成功時應顯示 retryProcessing（F06 錯誤恢復：失敗不阻塞重試）', async () => {
    mockRetryFailed.mockRejectedValueOnce(new Error('network error'));
    mockRetryFailed.mockResolvedValueOnce(undefined);
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    const retryBtn = screen.getByText('interview.result.retry');
    fireEvent.click(retryBtn);
    await waitFor(() => expect(mockMessageError).toHaveBeenCalledWith('network error'));
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledTimes(2);
      expect(mockMessageInfo).toHaveBeenCalledWith('interview.retryProcessing');
    });
  });

  it('processing_failed 時 retry 快速連點只會送出一次 retryFailed 請求（F06 重試節流）', async () => {
    let resolveRetry: (v: unknown) => void;
    mockRetryFailed.mockImplementation(() => new Promise((resolve) => { resolveRetry = resolve; }));
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    const retryBtn = screen.getByText('interview.result.retry');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockRetryFailed).toHaveBeenCalledTimes(1);
    });
    resolveRetry!(undefined);
  });

  it('getSession 失敗且 currentSession 為 null 且無 storeError 時應顯示完成結果與返回個人資料按鈕（F06 錯誤恢復：失敗不阻塞導航）', async () => {
    mockStoreState.loading = false;
    mockStoreState.currentSession = null;
    mockStoreState.error = null;
    renderWithRouter();
    expect(screen.getByText('interview.result.doneTitle')).toBeInTheDocument();
    const backBtn = screen.getByText('interview.result.backProfile');
    expect(backBtn).toBeInTheDocument();
    await userEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/profile/index');
  });

  it('getSession 失敗且 currentSession 為 null 且有 storeError 時應顯示錯誤與 retry、返回個人資料按鈕（F06 錯誤恢復：失敗不阻塞重試）', async () => {
    mockStoreState.loading = false;
    mockStoreState.currentSession = null;
    mockStoreState.error = '網絡錯誤';
    renderWithRouter();
    expect(screen.getByText('interview.loadFail')).toBeInTheDocument();
    expect(screen.getByText('網絡錯誤')).toBeInTheDocument();
    const retryBtn = screen.getByTestId('interview-result-load-retry');
    expect(retryBtn).toBeInTheDocument();
    await userEvent.click(retryBtn);
    expect(mockGetSession).toHaveBeenCalledWith('test-session');
    const backBtn = screen.getByText('interview.result.backProfile');
    await userEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/profile/index');
  });
});
