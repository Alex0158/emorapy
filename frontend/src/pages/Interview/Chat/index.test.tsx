/**
 * Interview Chat 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();
const mockMessageInfo = vi.fn();
const mockGetSession = vi.fn();
const mockSyncSessionSilently = vi.fn();
const mockRespond = vi.fn();
const mockSkipTurn = vi.fn();
const mockEndSession = vi.fn();
const mockCancelStream = vi.fn();
const mockDismissSafetyAlert = vi.fn();
const mockConnectAIStream = vi.fn();
const mockBeginStreaming = vi.fn();
const mockFinishStreaming = vi.fn();
const mockApplyStreamFailure = vi.fn();
const mockApplyStreamSafetyAlert = vi.fn();
const mockApplyShouldEnd = vi.fn();

let mockStoreState = {
  currentSession: null as Record<string, unknown> | null,
  turns: [] as Record<string, unknown>[],
  streamingText: '',
  isStreaming: false,
  streamingStatus: null as 'thinking' | 'streaming' | 'persisting' | null,
  loading: false,
  error: null as string | null,
  errorCode: null as string | null,
  shouldEnd: false,
  safetyAlert: null as Record<string, unknown> | null,
  beginStreaming: mockBeginStreaming,
  finishStreaming: mockFinishStreaming,
  applyStreamFailure: mockApplyStreamFailure,
  applyStreamSafetyAlert: mockApplyStreamSafetyAlert,
  applyShouldEnd: mockApplyShouldEnd,
  respond: mockRespond,
  skipTurn: mockSkipTurn,
  getSession: mockGetSession,
  syncSessionSilently: mockSyncSessionSilently,
  endSession: mockEndSession,
  cancelStream: mockCancelStream,
  dismissSafetyAlert: mockDismissSafetyAlert,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/store/interviewStore', () => ({
  useInterviewStore: () => mockStoreState,
}));
vi.mock('@/services/aiStream', () => ({
  connectAIStream: (...args: unknown[]) => mockConnectAIStream(...args),
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('@/components/business/Interview/ChatBubble', () => ({
  default: ({ content, isUser }: { content: string; isUser: boolean }) => (
    <div data-testid={isUser ? 'user-bubble' : 'ai-bubble'}>{content}</div>
  ),
}));
vi.mock('@/components/business/Interview/InterviewInput', () => ({
  default: () => <div data-testid="interview-input" />,
}));
vi.mock('@/components/business/Interview/SafetyAlert', () => ({
  default: ({ message }: { message: string }) => <div data-testid="safety-alert">{message}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({
  default: () => <div data-testid="mediator-avatar" />,
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockMessageError(...args),
    success: (...args: unknown[]) => mockMessageSuccess(...args),
    info: (...args: unknown[]) => mockMessageInfo(...args),
  },
}));

import InterviewChat from './index';

function renderWithRouter(sessionId = 'test-session') {
  return render(
    <MemoryRouter initialEntries={[`/interview/${sessionId}`]}>
      <Routes>
        <Route path="/interview/:sessionId" element={<InterviewChat />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InterviewChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(undefined);
    mockStoreState = {
      currentSession: null,
      turns: [],
      streamingText: '',
      isStreaming: false,
      streamingStatus: null,
      loading: false,
      error: null,
      errorCode: null,
      shouldEnd: false,
      safetyAlert: null,
      beginStreaming: mockBeginStreaming,
      finishStreaming: mockFinishStreaming,
      applyStreamFailure: mockApplyStreamFailure,
      applyStreamSafetyAlert: mockApplyStreamSafetyAlert,
      applyShouldEnd: mockApplyShouldEnd,
      respond: mockRespond,
      skipTurn: mockSkipTurn,
      getSession: mockGetSession,
      syncSessionSilently: mockSyncSessionSilently,
      endSession: mockEndSession,
      cancelStream: mockCancelStream,
      dismissSafetyAlert: mockDismissSafetyAlert,
    };
    mockConnectAIStream.mockResolvedValue(() => undefined);
  });

  it('掛載時應呼叫 getSession', () => {
    renderWithRouter();
    expect(mockGetSession).toHaveBeenCalledWith('test-session');
  });

  it('session 存在時應訂閱 interview_session AI Stream', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    renderWithRouter();
    await waitFor(() => {
      expect(mockConnectAIStream).toHaveBeenCalledWith(
        'interview_session',
        'test-session',
        expect.objectContaining({
          onReady: expect.any(Function),
          onEvent: expect.any(Function),
          onError: expect.any(Function),
          onClose: expect.any(Function),
        }),
        { afterSeq: 0 }
      );
    });
  });

  it('loading 且無 session 時應顯示 loading', () => {
    mockStoreState.loading = true;
    renderWithRouter();
    expect(screen.getByText('interview.loadingChat')).toBeInTheDocument();
  });

  it('有 turns 時應渲染 ChatBubble', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [
      { id: 't1', turn_order: 1, ai_message: 'AI 問候', user_response: '使用者回覆', skipped: false, safety_flag: false, created_at: '2025-01-01' },
    ];
    renderWithRouter();
    expect(screen.getByText('AI 問候')).toBeInTheDocument();
    expect(screen.getByText('使用者回覆')).toBeInTheDocument();
  });

  it('有 error 時應顯示錯誤訊息', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = '發生錯誤';
    mockStoreState.errorCode = 'RATE_LIMIT_EXCEEDED';
    renderWithRouter();
    expect(screen.getByText('interview.error.rateLimit')).toBeInTheDocument();
  });

  it('RATE_LIMIT_EXCEEDED 時仍可透過 header 返回按鈕導向 /profile/index（F06 錯誤恢復：無專用按鈕時仍有導航出口）', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [{ id: 't1', turn_order: 1, ai_message: 'Q1', user_response: 'A1', skipped: false, safety_flag: false, created_at: '2025-01-01' }];
    mockStoreState.error = 'rate limited';
    mockStoreState.errorCode = 'RATE_LIMIT_EXCEEDED';
    renderWithRouter();
    expect(screen.getByText('interview.error.rateLimit')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(buttons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/profile/index');
  });

  it('有 safetyAlert 時應渲染 SafetyAlert', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.safetyAlert = { message: '安全警告', severity: 'warning' };
    renderWithRouter();
    expect(screen.getByTestId('safety-alert')).toBeInTheDocument();
  });

  it('session 為 in_progress 時應渲染 InterviewInput', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    renderWithRouter();
    expect(screen.getByTestId('interview-input')).toBeInTheDocument();
  });

  it('critical safety alert 應持續顯示並暫停一般輸入', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.safetyAlert = { message: '需要先確保安全', severity: 'critical' };
    renderWithRouter();
    expect(screen.getByTestId('safety-alert')).toHaveTextContent('需要先確保安全');
    expect(screen.queryByTestId('interview-input')).not.toBeInTheDocument();
  });

  it('session 為 processing 時應顯示處理中提示', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'processing' };
    renderWithRouter();
    expect(screen.getByText('interview.processing')).toBeInTheDocument();
  });

  it('session 為 completed 時應顯示查看結果按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'completed' };
    renderWithRouter();
    expect(screen.getByText('interview.viewResult')).toBeInTheDocument();
  });

  it('isStreaming 時應渲染 streaming bubble', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.isStreaming = true;
    mockStoreState.streamingStatus = 'streaming';
    mockStoreState.streamingText = '正在生成...';
    renderWithRouter();
    expect(screen.getByText('正在生成...')).toBeInTheDocument();
    expect(screen.getByText('正在生成...').closest('[data-ai-stream-status="streaming"]')).toBeInTheDocument();
  });

  it('isStreaming 且尚未收到 token 時應顯示 thinking 文案', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.isStreaming = true;
    mockStoreState.streamingStatus = 'thinking';
    mockStoreState.streamingText = '';
    renderWithRouter();
    expect(screen.getByText('interview.thinking')).toBeInTheDocument();
    expect(screen.getByText('interview.thinking').closest('[data-ai-stream-status="thinking"]')).toBeInTheDocument();
  });

  it('AI Stream ready snapshot 有活動 draft 時應顯示 recovering 文案', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockConnectAIStream.mockImplementation(async (_scope: string, _scopeId: string, callbacks: { onReady?: (payload: { snapshots?: Array<Record<string, unknown>> }) => void }) => {
      callbacks.onReady?.({
        snapshots: [
          {
            streamId: 'stream-1',
            requestId: 'request-1',
            scopeType: 'interview_session',
            scopeId: 'test-session',
            status: 'started',
            lastSeq: 3,
            text: '',
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      return () => undefined;
    });
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('interview.recoveringBadge')).toBeInTheDocument();
    });
    expect(screen.getByText('interview.recoveringBadge')).toHaveAttribute('data-ai-recovery-badge', 'true');
    expect(screen.getByText('interview.thinking').closest('[data-ai-stream-status="thinking"]')).toBeInTheDocument();
  });

  it('AI Stream ready snapshot 為 cancelled 時不應以對話氣泡顯示（避免像多一則 AI 訊息）', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockConnectAIStream.mockImplementation(async (_scope: string, _scopeId: string, callbacks: { onReady?: (payload: { snapshots?: Array<Record<string, unknown>> }) => void }) => {
      callbacks.onReady?.({
        snapshots: [
          {
            streamId: 'stream-1',
            requestId: 'request-1',
            scopeType: 'interview_session',
            scopeId: 'test-session',
            status: 'cancelled',
            lastSeq: 4,
            text: '已中止的回覆',
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      return () => undefined;
    });
    renderWithRouter();
    await waitFor(() => {
      expect(mockConnectAIStream).toHaveBeenCalled();
    });
    expect(document.querySelector('[data-ai-stream-status="cancelled"]')).toBeNull();
    expect(screen.queryByText('已中止的回覆')).not.toBeInTheDocument();
  });

  it('生成中收到 AI Stream delta 時應優先顯示鏡像 draft', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.isStreaming = true;
    mockStoreState.streamingStatus = 'streaming';
    mockStoreState.streamingText = '本地草稿';
    mockConnectAIStream.mockImplementation(async (_scope: string, _scopeId: string, callbacks: { onEvent?: (payload: Record<string, unknown>) => void }) => {
      queueMicrotask(() => {
        callbacks.onEvent?.({
          eventType: 'stream.delta',
          streamId: 'stream-2',
          requestId: 'request-2',
          scopeType: 'interview_session',
          scopeId: 'test-session',
          seq: 8,
          createdAt: new Date().toISOString(),
          deltaText: '鏡像草稿',
        });
      });
      return () => undefined;
    });
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('鏡像草稿')).toBeInTheDocument();
    });
    expect(screen.queryByText('本地草稿')).not.toBeInTheDocument();
  });

  it('收到 stream.persisted 時應靜默同步 canonical session', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockConnectAIStream.mockImplementation(async (_scope: string, _scopeId: string, callbacks: { onEvent?: (payload: Record<string, unknown>) => void }) => {
      queueMicrotask(() => {
        callbacks.onEvent?.({
          eventType: 'stream.persisted',
          streamId: 'stream-3',
          requestId: 'request-3',
          scopeType: 'interview_session',
          scopeId: 'test-session',
          seq: 9,
          createdAt: new Date().toISOString(),
          fullText: 'final',
        });
      });
      return () => undefined;
    });
    renderWithRouter();
    await waitFor(() => {
      expect(mockSyncSessionSilently).toHaveBeenCalledWith('test-session');
    });
  });

  it('收到 safety_alert phase 時應交給 store 顯示 backend 受控文案', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockConnectAIStream.mockImplementation(async (_scope: string, _scopeId: string, callbacks: { onEvent?: (payload: Record<string, unknown>) => void }) => {
      queueMicrotask(() => {
        callbacks.onEvent?.({
          eventType: 'stream.phase',
          phase: 'safety_alert',
          streamId: 'stream-safety',
          requestId: 'request-safety',
          scopeType: 'interview_session',
          scopeId: 'test-session',
          seq: 10,
          createdAt: new Date().toISOString(),
          metadata: {
            message: 'We detected a possible safety risk and switched to a safety-first response.',
            severity: 'warning',
          },
        });
      });
      return () => undefined;
    });

    renderWithRouter();
    await waitFor(() => {
      expect(mockApplyStreamSafetyAlert).toHaveBeenCalledWith({
        message: 'We detected a possible safety risk and switched to a safety-first response.',
        severity: 'warning',
      });
    });
  });

  it('reconnect 後 ready snapshot 若已是 persisted，應結束 streaming 並同步 canonical session（P03 回歸）', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.isStreaming = true;
    mockStoreState.streamingStatus = 'thinking';
    mockConnectAIStream.mockImplementation(async (_scope: string, _scopeId: string, callbacks: { onReady?: (payload: { snapshots?: Array<Record<string, unknown>> }) => void }) => {
      queueMicrotask(() => {
        callbacks.onReady?.({
          snapshots: [
            {
              streamId: 'stream-4',
              requestId: 'request-4',
              scopeType: 'interview_session',
              scopeId: 'test-session',
              status: 'persisted',
              lastSeq: 10,
              text: '已落庫的下一輪 AI 回覆',
              metadata: { shouldEnd: false },
              updatedAt: new Date().toISOString(),
            },
          ],
        });
      });
      return () => undefined;
    });
    renderWithRouter();
    await waitFor(() => {
      expect(mockFinishStreaming).toHaveBeenCalledTimes(1);
      expect(mockSyncSessionSilently).toHaveBeenCalledWith('test-session');
      expect(mockApplyShouldEnd).toHaveBeenCalledWith(false);
    });
  });

  it('streaming 中若 SSE 漏掉 persisted，應定期同步 canonical session 自愈（P03 回歸）', async () => {
    vi.useFakeTimers();
    try {
      mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
      mockStoreState.isStreaming = true;
      mockStoreState.streamingStatus = 'thinking';

      renderWithRouter();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });

      expect(mockSyncSessionSilently).toHaveBeenCalledWith('test-session');
    } finally {
      vi.useRealTimers();
    }
  });

  it('AI Stream 初始連線返回 500 時應結束 thinking 並套用 connectionLost 錯誤', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.isStreaming = true;
    mockStoreState.streamingStatus = 'thinking';
    mockConnectAIStream.mockImplementation(async (_scope: string, _scopeId: string, callbacks: { onError?: (error: { code: string; message: string; status?: number }) => void }) => {
      queueMicrotask(() => {
        callbacks.onError?.({ code: 'HTTP_500', message: 'HTTP 500', status: 500 });
      });
      return () => undefined;
    });
    renderWithRouter();
    await waitFor(() => {
      expect(mockFinishStreaming).toHaveBeenCalledTimes(1);
      expect(mockApplyStreamFailure).toHaveBeenCalledWith({
        code: 'CONNECTION_LOST',
        message: 'interview.error.connectionLost',
      });
    });
  });

  it('errorCode=NOT_FOUND 時應顯示返回個人頁按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'not found';
    mockStoreState.errorCode = 'NOT_FOUND';
    renderWithRouter();
    expect(screen.getByText('interview.error.notFound')).toBeInTheDocument();
    expect(screen.getByText('interview.backToProfile')).toBeInTheDocument();
  });

  it('errorCode=AI_CALL_FAILED 時應顯示重新載入按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'ai error';
    mockStoreState.errorCode = 'AI_CALL_FAILED';
    renderWithRouter();
    expect(screen.getByText('interview.error.aiCallFailed')).toBeInTheDocument();
    expect(screen.getByText('interview.reloadConversation')).toBeInTheDocument();
  });

  it('errorCode=MAX_TURNS_REACHED 時應顯示查看結果按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'max turns';
    mockStoreState.errorCode = 'MAX_TURNS_REACHED';
    renderWithRouter();
    expect(screen.getByText('interview.error.maxTurns')).toBeInTheDocument();
    expect(screen.getByText('interview.viewResult')).toBeInTheDocument();
  });

  it('errorCode=CONSENT_REQUIRED 時應顯示返回個人頁按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'consent required';
    mockStoreState.errorCode = 'CONSENT_REQUIRED';
    renderWithRouter();
    expect(screen.getByText('interview.error.consentRequired')).toBeInTheDocument();
    expect(screen.getByText('interview.backToProfile')).toBeInTheDocument();
  });

  it('errorCode 為未知時應顯示重新載入按鈕，點擊應呼叫 getSession（F06 錯誤恢復：未知錯誤提供 retry 出口）', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'network error';
    mockStoreState.errorCode = 'NETWORK_ERROR';
    renderWithRouter();
    expect(screen.getByText('common.networkError')).toBeInTheDocument();
    const reloadBtn = screen.getByTestId('interview-chat-reload-fallback');
    expect(reloadBtn).toBeInTheDocument();
    const callCountBefore = mockGetSession.mock.calls.length;
    fireEvent.click(reloadBtn);
    expect(mockGetSession).toHaveBeenCalledTimes(callCountBefore + 1);
  });

  it('errorCode 未知時應保留已正規化 message，不直出錯誤碼', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = '後端已正規化錯誤';
    mockStoreState.errorCode = 'UNKNOWN_BACKEND_CODE';
    renderWithRouter();
    expect(screen.getByText('後端已正規化錯誤')).toBeInTheDocument();
    expect(screen.queryByText('UNKNOWN_BACKEND_CODE')).not.toBeInTheDocument();
  });

  it('errorCode 為未知時 reload 快速連點只會送出一次 getSession 請求（F06 重試節流）', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'network error';
    mockStoreState.errorCode = 'NETWORK_ERROR';
    let resolveReload: (value: unknown) => void;
    const reloadPromise = new Promise((resolve) => { resolveReload = resolve; });
    mockGetSession.mockResolvedValueOnce({ data: { data: { id: 'test-session', status: 'in_progress', turns: [] } } }).mockImplementation(() => reloadPromise);
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByTestId('interview-chat-reload-fallback')).toBeInTheDocument();
    });
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    const reloadBtn = screen.getByTestId('interview-chat-reload-fallback');
    fireEvent.click(reloadBtn);
    fireEvent.click(reloadBtn);
    fireEvent.click(reloadBtn);
    expect(mockGetSession).toHaveBeenCalledTimes(2);
    resolveReload!({ data: { data: { id: 'test-session', status: 'in_progress', turns: [] } } });
  });

  it('isTerminalError 時不應渲染 InterviewInput', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'done';
    mockStoreState.errorCode = 'SESSION_COMPLETED';
    renderWithRouter();
    expect(screen.queryByTestId('interview-input')).not.toBeInTheDocument();
  });

  it('有 safetyAlert 時不應顯示 error 區塊', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.error = 'some error';
    mockStoreState.errorCode = 'AI_CALL_FAILED';
    mockStoreState.safetyAlert = { message: '安全警告', severity: 'warning' };
    renderWithRouter();
    expect(screen.getByTestId('safety-alert')).toBeInTheDocument();
    expect(screen.queryByText('interview.error.aiCallFailed')).not.toBeInTheDocument();
  });

  it('turns >= 3 且 in_progress 時應顯示暫停對話按鈕', () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [
      { id: 't1', turn_order: 1, ai_message: 'Q1', user_response: 'A1', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't2', turn_order: 2, ai_message: 'Q2', user_response: 'A2', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't3', turn_order: 3, ai_message: 'Q3', user_response: undefined, skipped: false, safety_flag: false, created_at: '2025-01-01' },
    ];
    renderWithRouter();
    expect(screen.getByText('interview.pauseChat')).toBeInTheDocument();
  });

  it('getSession 失敗且有 raw message 時應顯示頁內 fallback 與 retry/back 出口（P1-03）', async () => {
    mockGetSession.mockRejectedValue(new Error('會話載入失敗'));
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('interview.loadFail')).toBeInTheDocument();
      expect(screen.getByTestId('interview-chat-load-retry')).toBeInTheDocument();
      expect(screen.getByText('interview.backToProfile')).toBeInTheDocument();
    });
  });

  it('getSession 失敗且無 message 應顯示 interview.loadFail 並停留當前頁', async () => {
    mockGetSession.mockRejectedValue({ code: 'SERVER_ERROR' });
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('interview.loadFail')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('getSession 失敗且 message 為空字串時應使用 interview.loadFail（F10 邊界：空 message 視為無）', async () => {
    mockGetSession.mockRejectedValue({ code: 'UNKNOWN', message: '' });
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('interview.loadFail')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('getSession 失敗 FORBIDDEN 且無 message 時應使用 interview.loadFail（F06 權限邊界 fallback）', async () => {
    mockGetSession.mockRejectedValue({ code: 'FORBIDDEN' });
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('interview.loadFail')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('getSession 首次失敗時點擊 retry 應重新呼叫 getSession，成功後清除頁內錯誤（P1-03）', async () => {
    mockGetSession
      .mockRejectedValueOnce(new Error('會話載入失敗'))
      .mockResolvedValueOnce(undefined);
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('interview.loadFail')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('interview-chat-load-retry'));
    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('interview.loadFail')).not.toBeInTheDocument();
    });
  });

  it('getSession 首次失敗時點擊 back 應導向 /profile/index（P1-03）', async () => {
    mockGetSession.mockRejectedValue(new Error('會話載入失敗'));
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('interview.loadFail')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('interview.backToProfile'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/index');
  });

  it('getSession 首次失敗時 retry 快速連點只會送出一次額外請求（P1-05）', async () => {
    let resolveReload: (value: unknown) => void;
    const retryPromise = new Promise((resolve) => { resolveReload = resolve; });
    mockGetSession
      .mockRejectedValueOnce(new Error('會話載入失敗'))
      .mockImplementationOnce(() => retryPromise);
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByTestId('interview-chat-load-retry')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('interview-chat-load-retry'));
    fireEvent.click(screen.getByTestId('interview-chat-load-retry'));
    fireEvent.click(screen.getByTestId('interview-chat-load-retry'));
    expect(mockGetSession).toHaveBeenCalledTimes(2);
    resolveReload!(undefined);
    await waitFor(() => {
      expect(screen.queryByTestId('interview-chat-load-retry')).not.toBeInTheDocument();
    });
  });

  it('暫停對話時 endSession 失敗且有 raw message 應顯示受控 fallback', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [
      { id: 't1', turn_order: 1, ai_message: 'Q1', user_response: 'A1', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't2', turn_order: 2, ai_message: 'Q2', user_response: 'A2', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't3', turn_order: 3, ai_message: 'Q3', user_response: undefined, skipped: false, safety_flag: false, created_at: '2025-01-01' },
    ];
    mockEndSession.mockRejectedValue(new Error('結束對話失敗'));
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.pauseChat'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.endFail');
    });
  });

  it('暫停對話時 endSession 失敗且無 message 應顯示 interview.endFail', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [
      { id: 't1', turn_order: 1, ai_message: 'Q1', user_response: 'A1', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't2', turn_order: 2, ai_message: 'Q2', user_response: 'A2', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't3', turn_order: 3, ai_message: 'Q3', user_response: undefined, skipped: false, safety_flag: false, created_at: '2025-01-01' },
    ];
    mockEndSession.mockRejectedValue({ code: 'UNKNOWN' });
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.pauseChat'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.endFail');
    });
  });

  it('暫停對話時 endSession 失敗且 SERVER_ERROR message 為空字串時應使用 common.serverError（F10 邊界：空 message 視為無）', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [
      { id: 't1', turn_order: 1, ai_message: 'Q1', user_response: 'A1', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't2', turn_order: 2, ai_message: 'Q2', user_response: 'A2', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't3', turn_order: 3, ai_message: 'Q3', user_response: undefined, skipped: false, safety_flag: false, created_at: '2025-01-01' },
    ];
    mockEndSession.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.pauseChat'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('common.serverError');
    });
  });

  it('暫停對話時 endSession FORBIDDEN 且無 message 時應使用 common.forbidden（F06 權限邊界 fallback）', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [
      { id: 't1', turn_order: 1, ai_message: 'Q1', user_response: 'A1', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't2', turn_order: 2, ai_message: 'Q2', user_response: 'A2', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't3', turn_order: 3, ai_message: 'Q3', user_response: undefined, skipped: false, safety_flag: false, created_at: '2025-01-01' },
    ];
    mockEndSession.mockRejectedValue({ code: 'FORBIDDEN' });
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.pauseChat'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('common.forbidden');
    });
  });

  it('暫停對話時 endSession 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [
      { id: 't1', turn_order: 1, ai_message: 'Q1', user_response: 'A1', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't2', turn_order: 2, ai_message: 'Q2', user_response: 'A2', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't3', turn_order: 3, ai_message: 'Q3', user_response: undefined, skipped: false, safety_flag: false, created_at: '2025-01-01' },
    ];
    let resolveEndSession: () => void;
    mockEndSession.mockImplementation(
      () => new Promise<void>((resolve) => { resolveEndSession = resolve; })
    );
    const { unmount } = renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('interview.pauseChat')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('interview.pauseChat'));
    await waitFor(() => {
      expect(mockEndSession).toHaveBeenCalledWith('test-session');
    });
    unmount();
    resolveEndSession!();
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('暫停對話時 endSession 失敗後應仍可再次點擊暫停對話，成功後應導向 result（F06 錯誤恢復：失敗不阻塞重試）', async () => {
    mockStoreState.currentSession = { id: 'test-session', status: 'in_progress' };
    mockStoreState.turns = [
      { id: 't1', turn_order: 1, ai_message: 'Q1', user_response: 'A1', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't2', turn_order: 2, ai_message: 'Q2', user_response: 'A2', skipped: false, safety_flag: false, created_at: '2025-01-01' },
      { id: 't3', turn_order: 3, ai_message: 'Q3', user_response: undefined, skipped: false, safety_flag: false, created_at: '2025-01-01' },
    ];
    mockEndSession
      .mockRejectedValueOnce(new Error('暫時無法結束'))
      .mockResolvedValueOnce(undefined);
    renderWithRouter();
    fireEvent.click(screen.getByText('interview.pauseChat'));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.endFail');
    });
    fireEvent.click(screen.getByText('interview.pauseChat'));
    await waitFor(() => {
      expect(mockEndSession).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith('/interview/test-session/result', { replace: true });
    });
  });
});
