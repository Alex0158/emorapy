/**
 * interviewStore 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInterviewStore } from './interviewStore';

const mockStartSession = vi.fn();
const mockCheckResume = vi.fn();
const mockGetSession = vi.fn();
const mockEndSession = vi.fn();
const mockRetryFailed = vi.fn();

vi.mock('@/services/api/interview', () => ({
  interviewApi: {
    startSession: (...args: unknown[]) => mockStartSession(...args),
    checkResume: (...args: unknown[]) => mockCheckResume(...args),
    getSession: (...args: unknown[]) => mockGetSession(...args),
    endSession: (...args: unknown[]) => mockEndSession(...args),
    retryFailed: (...args: unknown[]) => mockRetryFailed(...args),
  },
}));

const mockSseRequest = vi.fn();
vi.mock('@/services/sseRequest', () => ({
  sseRequest: (...args: unknown[]) => mockSseRequest(...args),
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

const initialState = {
  currentSession: null,
  turns: [],
  streamingText: '',
  isStreaming: false,
  loading: false,
  error: null,
  errorCode: null,
  abortController: null,
  shouldEnd: false,
  safetyAlert: null,
};

describe('interviewStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInterviewStore.setState(initialState);
  });

  describe('startSession', () => {
    it('成功時應設置 currentSession 和 turns', async () => {
      const session = {
        id: 's1',
        status: 'in_progress',
        turns: [{ id: 't1', turn_order: 1, ai_message: 'hi' }],
      };
      mockStartSession.mockResolvedValue({ data: { data: session } });
      const result = await useInterviewStore.getState().startSession('organic');
      const state = useInterviewStore.getState();
      expect(result).toEqual(session);
      expect(state.currentSession).toEqual(session);
      expect(state.turns).toEqual(session.turns);
      expect(state.loading).toBe(false);
    });

    it('API 返回 null session 時應拋錯', async () => {
      mockStartSession.mockResolvedValue({ data: { data: null } });
      await expect(useInterviewStore.getState().startSession()).rejects.toThrow();
      expect(useInterviewStore.getState().error).toBeTruthy();
      expect(useInterviewStore.getState().loading).toBe(false);
    });

    it('失敗時應設置 error 並拋出', async () => {
      mockStartSession.mockRejectedValue(new Error('start fail'));
      await expect(useInterviewStore.getState().startSession()).rejects.toThrow('start fail');
      expect(useInterviewStore.getState().error).toBe('start fail');
    });

    it('應重置殘留的 shouldEnd/streamingText/isStreaming/safetyAlert', async () => {
      useInterviewStore.setState({
        shouldEnd: true,
        streamingText: 'stale',
        isStreaming: true,
        safetyAlert: { message: 'old', severity: 'warning' },
      });
      const session = { id: 's1', status: 'in_progress', turns: [] };
      mockStartSession.mockResolvedValue({ data: { data: session } });
      await useInterviewStore.getState().startSession('organic');
      const state = useInterviewStore.getState();
      expect(state.shouldEnd).toBe(false);
      expect(state.streamingText).toBe('');
      expect(state.isStreaming).toBe(false);
      expect(state.safetyAlert).toBeNull();
    });
  });

  describe('checkResume', () => {
    it('成功時應返回 resume data', async () => {
      mockCheckResume.mockResolvedValue({ data: { data: { has_pending: true, session_id: 's1' } } });
      const result = await useInterviewStore.getState().checkResume();
      expect(result).toEqual({ has_pending: true, session_id: 's1' });
    });

    it('失敗時應返回 { has_pending: false }', async () => {
      mockCheckResume.mockRejectedValue(new Error('fail'));
      const result = await useInterviewStore.getState().checkResume();
      expect(result).toEqual({ has_pending: false });
    });

    it('API 返回 undefined 時應返回 { has_pending: false }', async () => {
      mockCheckResume.mockResolvedValue({ data: {} });
      const result = await useInterviewStore.getState().checkResume();
      expect(result).toEqual({ has_pending: false });
    });
  });

  describe('endSession', () => {
    it('成功時應更新 currentSession status 為 processing', async () => {
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
      });
      mockEndSession.mockResolvedValue({});
      await useInterviewStore.getState().endSession('s1');
      expect(useInterviewStore.getState().currentSession?.status).toBe('processing');
      expect(useInterviewStore.getState().loading).toBe(false);
    });

    it('無 currentSession 時 endSession 成功也不崩潰', async () => {
      mockEndSession.mockResolvedValue({});
      await useInterviewStore.getState().endSession('s1');
      expect(useInterviewStore.getState().currentSession).toBeNull();
    });

    it('失敗時應設置 error 並拋出', async () => {
      mockEndSession.mockRejectedValue(new Error('end fail'));
      await expect(useInterviewStore.getState().endSession('s1')).rejects.toThrow('end fail');
      expect(useInterviewStore.getState().error).toBe('end fail');
    });
  });

  describe('getSession', () => {
    it('成功時應設置 currentSession 和 turns', async () => {
      const session = { id: 's2', status: 'completed', turns: [] };
      mockGetSession.mockResolvedValue({ data: { data: session } });
      await useInterviewStore.getState().getSession('s2');
      expect(useInterviewStore.getState().currentSession).toEqual(session);
      expect(useInterviewStore.getState().loading).toBe(false);
    });

    it('API 返回 null session 時應拋錯', async () => {
      mockGetSession.mockResolvedValue({ data: {} });
      await expect(useInterviewStore.getState().getSession('s2')).rejects.toThrow();
      expect(useInterviewStore.getState().error).toBeTruthy();
    });

    it('404 錯誤時應清除 currentSession', async () => {
      mockGetSession.mockRejectedValue({ message: 'not found', code: 'NOT_FOUND', status: 404 });
      await expect(useInterviewStore.getState().getSession('s3')).rejects.toBeTruthy();
      expect(useInterviewStore.getState().currentSession).toBeNull();
      expect(useInterviewStore.getState().errorCode).toBe('NOT_FOUND');
    });

    it('應重置殘留的 shouldEnd/streamingText/isStreaming/safetyAlert', async () => {
      useInterviewStore.setState({
        shouldEnd: true,
        streamingText: 'stale',
        isStreaming: true,
        safetyAlert: { message: 'old', severity: 'info' },
      });
      const session = { id: 's2', status: 'in_progress', turns: [] };
      mockGetSession.mockResolvedValue({ data: { data: session } });
      await useInterviewStore.getState().getSession('s2');
      const state = useInterviewStore.getState();
      expect(state.shouldEnd).toBe(false);
      expect(state.streamingText).toBe('');
      expect(state.isStreaming).toBe(false);
      expect(state.safetyAlert).toBeNull();
    });
  });

  describe('retryFailed', () => {
    it('成功時應結束 loading', async () => {
      mockRetryFailed.mockResolvedValue({});
      await useInterviewStore.getState().retryFailed('s1');
      expect(useInterviewStore.getState().loading).toBe(false);
    });

    it('失敗時應設置 error 並拋出', async () => {
      mockRetryFailed.mockRejectedValue(new Error('retry fail'));
      await expect(useInterviewStore.getState().retryFailed('s1')).rejects.toThrow('retry fail');
      expect(useInterviewStore.getState().error).toBe('retry fail');
    });
  });

  describe('cancelStream', () => {
    it('應 abort 現有 controller 並清除 streaming 狀態', () => {
      const abortFn = vi.fn();
      useInterviewStore.setState({
        isStreaming: true,
        streamingText: 'partial',
        abortController: { abort: abortFn } as never,
      });
      useInterviewStore.getState().cancelStream();
      expect(abortFn).toHaveBeenCalledOnce();
      expect(useInterviewStore.getState().isStreaming).toBe(false);
      expect(useInterviewStore.getState().streamingText).toBe('');
      expect(useInterviewStore.getState().abortController).toBeNull();
    });
  });

  describe('dismissSafetyAlert', () => {
    it('應清除 safetyAlert', () => {
      useInterviewStore.setState({
        safetyAlert: { message: 'warning', severity: 'info' },
      });
      useInterviewStore.getState().dismissSafetyAlert();
      expect(useInterviewStore.getState().safetyAlert).toBeNull();
    });
  });

  describe('reset', () => {
    it('應還原所有狀態並 abort 現有 stream', () => {
      const abortFn = vi.fn();
      useInterviewStore.setState({
        currentSession: { id: 's1' } as never,
        turns: [{ id: 't1' }] as never,
        streamingText: 'text',
        isStreaming: true,
        loading: true,
        error: 'err',
        errorCode: 'CODE',
        abortController: { abort: abortFn } as never,
        shouldEnd: true,
        safetyAlert: { message: 'x', severity: 'warning' },
      });
      useInterviewStore.getState().reset();
      const state = useInterviewStore.getState();
      expect(abortFn).toHaveBeenCalledOnce();
      expect(state.currentSession).toBeNull();
      expect(state.turns).toEqual([]);
      expect(state.streamingText).toBe('');
      expect(state.isStreaming).toBe(false);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.errorCode).toBeNull();
      expect(state.shouldEnd).toBe(false);
      expect(state.safetyAlert).toBeNull();
    });
  });

  describe('respond', () => {
    it('SSE 成功時應更新 turns 含使用者回覆和 AI 回覆', async () => {
      const existingTurn = {
        id: 't1', turn_order: 1, ai_message: 'Hello',
        user_response: undefined, skipped: false, safety_flag: false,
        created_at: '2025-01-01T00:00:00Z',
      };
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [existingTurn] as never,
      });
      mockSseRequest.mockImplementation(
        async (_url: string, _body: unknown, callbacks: Record<string, Function>) => {
          callbacks.onToken?.('AI reply');
          callbacks.onComplete?.({ status: 'in_progress' });
        }
      );
      await useInterviewStore.getState().respond('s1', 'User msg');
      const state = useInterviewStore.getState();
      expect(mockSseRequest).toHaveBeenCalledWith(
        '/interview/s1/respond',
        { message: 'User msg' },
        expect.any(Object),
        expect.any(AbortSignal),
      );
      expect(state.isStreaming).toBe(false);
      expect(state.turns.length).toBe(2);
      expect(state.turns[0].user_response).toBe('User msg');
      expect(state.turns[1].ai_message).toBe('AI reply');
    });

    it('已在 streaming 時應直接返回不重複呼叫', async () => {
      useInterviewStore.setState({ isStreaming: true });
      await useInterviewStore.getState().respond('s1', 'msg');
      expect(mockSseRequest).not.toHaveBeenCalled();
    });

    it('無既有 turns 時 respond 應建立 temp user turn', async () => {
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [],
      });
      mockSseRequest.mockImplementation(
        async (_url: string, _body: unknown, callbacks: Record<string, Function>) => {
          callbacks.onToken?.('First AI');
          callbacks.onComplete?.({});
        }
      );
      await useInterviewStore.getState().respond('s1', 'Hello');
      const state = useInterviewStore.getState();
      expect(state.turns.length).toBe(2);
      expect(state.turns[0].user_response).toBe('Hello');
      expect(state.turns[0].ai_message).toBe('');
      expect(state.turns[1].ai_message).toBe('First AI');
    });

    it('SSE onError 時應設置 error 狀態', async () => {
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [],
      });
      mockSseRequest.mockImplementation(
        async (_url: string, _body: unknown, callbacks: Record<string, Function>) => {
          callbacks.onError?.({ code: 'AI_CALL_FAILED', message: 'AI error' });
        }
      );
      await useInterviewStore.getState().respond('s1', 'test');
      const state = useInterviewStore.getState();
      expect(state.error).toBe('AI error');
      expect(state.errorCode).toBe('AI_CALL_FAILED');
    });

    it('網路錯誤時應設置 CONNECTION_LOST', async () => {
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [],
      });
      mockSseRequest.mockRejectedValue(new Error('Failed to fetch'));
      await useInterviewStore.getState().respond('s1', 'test');
      const state = useInterviewStore.getState();
      expect(state.error).toBe('interview.error.connectionLost');
      expect(state.errorCode).toBe('CONNECTION_LOST');
    });

    it('用戶訊息應在 SSE 完成前立即寫入 turns（即時顯示）', async () => {
      const existingTurn = {
        id: 't1', turn_order: 1, ai_message: 'Question?',
        user_response: undefined, skipped: false, safety_flag: false,
        created_at: '2025-01-01',
      };
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [existingTurn] as never,
      });

      let resolveSSE!: () => void;
      mockSseRequest.mockImplementation(() => new Promise<void>((r) => { resolveSSE = r; }));

      const promise = useInterviewStore.getState().respond('s1', '我很難過');

      const midState = useInterviewStore.getState();
      expect(midState.turns[0].user_response).toBe('我很難過');
      expect(midState.isStreaming).toBe(true);

      resolveSSE();
      await promise;

      expect(useInterviewStore.getState().isStreaming).toBe(false);
    });

    it('SSE onSafetyAlert 時應設置 safetyAlert', async () => {
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [{ id: 't1', turn_order: 1, ai_message: 'Hi', user_response: undefined, skipped: false, safety_flag: false, created_at: '2025-01-01' }] as never,
      });
      mockSseRequest.mockImplementation(
        async (_url: string, _body: unknown, callbacks: Record<string, Function>) => {
          callbacks.onSafetyAlert?.({ message: '偵測到安全風險', severity: 'critical' });
          callbacks.onToken?.('response');
          callbacks.onComplete?.({});
        }
      );
      await useInterviewStore.getState().respond('s1', 'msg');
      const state = useInterviewStore.getState();
      expect(state.safetyAlert).toEqual({ message: '偵測到安全風險', severity: 'critical' });
    });
  });

  describe('skipTurn', () => {
    it('SSE 成功時應標記最後一個 turn 為 skipped 並添加 AI 回覆', async () => {
      const turn = {
        id: 't1', turn_order: 1, ai_message: 'Question?',
        user_response: undefined, skipped: false, safety_flag: false,
        created_at: '2025-01-01T00:00:00Z',
      };
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [turn] as never,
      });
      mockSseRequest.mockImplementation(
        async (_url: string, _body: unknown, callbacks: Record<string, Function>) => {
          callbacks.onToken?.('Next question');
          callbacks.onComplete?.({});
        }
      );
      await useInterviewStore.getState().skipTurn('s1');
      const state = useInterviewStore.getState();
      expect(mockSseRequest).toHaveBeenCalledWith(
        '/interview/s1/skip', {}, expect.any(Object), expect.any(AbortSignal),
      );
      expect(state.turns.length).toBe(2);
      expect(state.turns[0].skipped).toBe(true);
      expect(state.turns[0].user_response).toBe('');
      expect(state.turns[1].ai_message).toBe('Next question');
    });
  });
});
