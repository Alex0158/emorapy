/**
 * Interview Result 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetSession = vi.fn();
const mockRetryFailed = vi.fn();

let mockStoreState = {
  currentSession: null as Record<string, unknown> | null,
  loading: false,
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

  it('session 為 processing_failed 時應顯示失敗畫面與重試按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'processing_failed' };
    renderWithRouter();
    expect(screen.getByText('interview.result.failedTitle')).toBeInTheDocument();
    expect(screen.getByText('interview.result.retry')).toBeInTheDocument();
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
});
