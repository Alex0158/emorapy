/**
 * interviewStore 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInterviewStore } from './interviewStore';

const mockStartSession = vi.fn();
const mockCheckResume = vi.fn();
const mockGetSession = vi.fn();
const mockRespondApi = vi.fn();
const mockSkipApi = vi.fn();
const mockCancelApi = vi.fn();
const mockEndSession = vi.fn();
const mockRetryFailed = vi.fn();

vi.mock('@/services/api/interview', () => ({
  interviewApi: {
    startSession: (...args: unknown[]) => mockStartSession(...args),
    checkResume: (...args: unknown[]) => mockCheckResume(...args),
    getSession: (...args: unknown[]) => mockGetSession(...args),
    respond: (...args: unknown[]) => mockRespondApi(...args),
    skip: (...args: unknown[]) => mockSkipApi(...args),
    cancel: (...args: unknown[]) => mockCancelApi(...args),
    endSession: (...args: unknown[]) => mockEndSession(...args),
    retryFailed: (...args: unknown[]) => mockRetryFailed(...args),
  },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

const initialState = {
  currentSession: null,
  turns: [],
  streamingText: '',
  isStreaming: false,
  streamingStatus: null,
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
      mockStartSession.mockResolvedValue(session);
      const result = await useInterviewStore.getState().startSession('organic');
      const state = useInterviewStore.getState();
      expect(result).toEqual(session);
      expect(state.currentSession).toEqual(session);
      expect(state.turns).toEqual(session.turns);
      expect(state.loading).toBe(false);
    });

    it('API 返回 null session 時應拋錯', async () => {
      mockStartSession.mockResolvedValue(null);
      await expect(useInterviewStore.getState().startSession()).rejects.toThrow();
      expect(useInterviewStore.getState().error).toBeTruthy();
      expect(useInterviewStore.getState().loading).toBe(false);
    });

    it('失敗時應設置 error 並拋出', async () => {
      mockStartSession.mockRejectedValue(new Error('start fail'));
      await expect(useInterviewStore.getState().startSession()).rejects.toThrow('start fail');
      expect(useInterviewStore.getState().error).toBe('start fail');
    });

    it('shared invalid-response fallback 不應直出英文診斷字串', async () => {
      mockStartSession.mockRejectedValue({
        code: 'INVALID_INTERVIEW_RESPONSE',
        message: 'Invalid interview session response from server',
      });

      await expect(useInterviewStore.getState().startSession()).rejects.toEqual({
        code: 'INVALID_INTERVIEW_RESPONSE',
        message: 'Invalid interview session response from server',
      });

      expect(useInterviewStore.getState().error).toBe('apiError.invalidResponse');
      expect(useInterviewStore.getState().errorCode).toBe('INVALID_INTERVIEW_RESPONSE');
    });

    it('應重置殘留的 shouldEnd/streamingText/isStreaming/streamingStatus/safetyAlert', async () => {
      useInterviewStore.setState({
        shouldEnd: true,
        streamingText: 'stale',
        isStreaming: true,
        streamingStatus: 'streaming',
        safetyAlert: { message: 'old', severity: 'warning' },
      });
      const session = { id: 's1', status: 'in_progress', turns: [] };
      mockStartSession.mockResolvedValue(session);
      await useInterviewStore.getState().startSession('organic');
      const state = useInterviewStore.getState();
      expect(state.shouldEnd).toBe(false);
      expect(state.streamingText).toBe('');
      expect(state.isStreaming).toBe(false);
      expect(state.streamingStatus).toBeNull();
      expect(state.safetyAlert).toBeNull();
    });
  });

  describe('checkResume', () => {
    it('成功時應返回 resume data', async () => {
      mockCheckResume.mockResolvedValue({ has_pending: true, session_id: 's1' });
      const result = await useInterviewStore.getState().checkResume();
      expect(result).toEqual({ has_pending: true, session_id: 's1' });
    });

    it('成功時應保留 failed resume data', async () => {
      mockCheckResume.mockResolvedValue({
        has_pending: false,
        has_failed: true,
        failed_session_id: 'fs1',
      });
      const result = await useInterviewStore.getState().checkResume();
      expect(result).toEqual({
        has_pending: false,
        has_failed: true,
        failed_session_id: 'fs1',
      });
    });

    it('失敗時應返回 { has_pending: false }', async () => {
      mockCheckResume.mockRejectedValue(new Error('fail'));
      const result = await useInterviewStore.getState().checkResume();
      expect(result).toEqual({ has_pending: false });
    });

    it('API 返回 undefined 時應返回 { has_pending: false }', async () => {
      mockCheckResume.mockResolvedValue(undefined);
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
      mockGetSession.mockResolvedValue(session);
      await useInterviewStore.getState().getSession('s2');
      expect(useInterviewStore.getState().currentSession).toEqual(session);
      expect(useInterviewStore.getState().loading).toBe(false);
    });

    it('API 返回 null session 時應拋錯', async () => {
      mockGetSession.mockResolvedValue(null);
      await expect(useInterviewStore.getState().getSession('s2')).rejects.toThrow();
      expect(useInterviewStore.getState().error).toBeTruthy();
    });

    it('404 錯誤時應清除 currentSession', async () => {
      mockGetSession.mockRejectedValue({ message: 'not found', code: 'NOT_FOUND', status: 404 });
      await expect(useInterviewStore.getState().getSession('s3')).rejects.toBeTruthy();
      expect(useInterviewStore.getState().currentSession).toBeNull();
      expect(useInterviewStore.getState().errorCode).toBe('NOT_FOUND');
    });

    it('應重置殘留的 shouldEnd/streamingText/isStreaming/streamingStatus/safetyAlert', async () => {
      useInterviewStore.setState({
        shouldEnd: true,
        streamingText: 'stale',
        isStreaming: true,
        streamingStatus: 'thinking',
        safetyAlert: { message: 'old', severity: 'info' },
      });
      const session = { id: 's2', status: 'in_progress', turns: [] };
      mockGetSession.mockResolvedValue(session);
      await useInterviewStore.getState().getSession('s2');
      const state = useInterviewStore.getState();
      expect(state.shouldEnd).toBe(false);
      expect(state.streamingText).toBe('');
      expect(state.isStreaming).toBe(false);
      expect(state.streamingStatus).toBeNull();
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

  describe('syncSessionSilently', () => {
    it('成功時應靜默覆蓋 currentSession 和 turns', async () => {
      useInterviewStore.setState({
        currentSession: { id: 'old', status: 'in_progress' } as never,
        turns: [{ id: 'old-turn' }] as never,
        shouldEnd: false,
      });
      mockGetSession.mockResolvedValue({
        id: 's-sync',
        status: 'in_progress',
        turns: [{ id: 'turn-sync', ai_message: 'canonical' }],
      });

      await useInterviewStore.getState().syncSessionSilently('s-sync');

      expect(useInterviewStore.getState().currentSession).toEqual({
        id: 's-sync',
        status: 'in_progress',
        turns: [{ id: 'turn-sync', ai_message: 'canonical' }],
      });
      expect(useInterviewStore.getState().turns).toEqual([{ id: 'turn-sync', ai_message: 'canonical' }]);
    });

    it('canonical session 已前進到下一輪 AI 時應結束 optimistic streaming（P03 回歸）', async () => {
      useInterviewStore.setState({
        currentSession: { id: 's-sync', status: 'in_progress' } as never,
        turns: [
          {
            id: 'turn-1',
            turn_order: 1,
            ai_message: '第一題',
            user_response: '我需要冷靜',
            skipped: false,
            safety_flag: false,
            created_at: '2026-04-18T00:00:00.000Z',
          },
        ] as never,
        isStreaming: true,
        streamingText: '我正在整理你的分享......',
        streamingStatus: 'thinking',
      });
      mockGetSession.mockResolvedValue({
        id: 's-sync',
        status: 'in_progress',
        turns: [
          {
            id: 'turn-1',
            turn_order: 1,
            ai_message: '第一題',
            user_response: '我需要冷靜',
            skipped: false,
            safety_flag: false,
            created_at: '2026-04-18T00:00:00.000Z',
          },
          {
            id: 'turn-2',
            turn_order: 2,
            ai_message: '第二題',
            skipped: false,
            safety_flag: false,
            created_at: '2026-04-18T00:00:10.000Z',
          },
        ],
      });

      await useInterviewStore.getState().syncSessionSilently('s-sync');

      const state = useInterviewStore.getState();
      expect(state.turns).toHaveLength(2);
      expect(state.turns[1].ai_message).toBe('第二題');
      expect(state.isStreaming).toBe(false);
      expect(state.streamingText).toBe('');
      expect(state.streamingStatus).toBeNull();
      expect(state.abortController).toBeNull();
    });

    it('失敗時應保留既有本地狀態', async () => {
      useInterviewStore.setState({
        currentSession: { id: 'local', status: 'in_progress' } as never,
        turns: [{ id: 'local-turn' }] as never,
      });
      mockGetSession.mockRejectedValue(new Error('network fail'));

      await useInterviewStore.getState().syncSessionSilently('s-sync');

      expect(useInterviewStore.getState().currentSession).toEqual({ id: 'local', status: 'in_progress' });
      expect(useInterviewStore.getState().turns).toEqual([{ id: 'local-turn' }]);
    });
  });

  describe('cancelStream', () => {
    it('應調用 cancel API 並清除串流狀態（不保留 cancelled draft）', async () => {
      mockCancelApi.mockResolvedValue({});
      useInterviewStore.setState({
        isStreaming: true,
        streamingText: 'partial',
        streamingStatus: 'streaming',
      });
      await useInterviewStore.getState().cancelStream('s1');
      expect(mockCancelApi).toHaveBeenCalledWith('s1');
      expect(useInterviewStore.getState().isStreaming).toBe(false);
      expect(useInterviewStore.getState().streamingText).toBe('');
      expect(useInterviewStore.getState().streamingStatus).toBeNull();
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
        streamingStatus: 'persisting',
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
      expect(state.streamingStatus).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.errorCode).toBeNull();
      expect(state.shouldEnd).toBe(false);
      expect(state.safetyAlert).toBeNull();
    });
  });

  describe('respond', () => {
    it('提交成功時應立即寫入使用者回覆並進入 thinking', async () => {
      const existingTurn = {
        id: 't1', turn_order: 1, ai_message: 'Hello',
        user_response: undefined, skipped: false, safety_flag: false,
        created_at: '2025-01-01T00:00:00Z',
      };
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [existingTurn] as never,
      });
      mockRespondApi.mockResolvedValue({ data: { accepted: true } });

      await useInterviewStore.getState().respond('s1', 'User msg');
      const state = useInterviewStore.getState();
      expect(mockRespondApi).toHaveBeenCalledWith('s1', 'User msg');
      expect(state.isStreaming).toBe(true);
      expect(state.streamingStatus).toBe('thinking');
      expect(state.turns.length).toBe(1);
      expect(state.turns[0].user_response).toBe('User msg');
    });

    it('已在 streaming 時應直接返回不重複呼叫', async () => {
      useInterviewStore.setState({ isStreaming: true });
      await useInterviewStore.getState().respond('s1', 'msg');
      expect(mockRespondApi).not.toHaveBeenCalled();
    });

    it('無既有 turns 時 respond 應建立 temp user turn', async () => {
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [],
      });
      mockRespondApi.mockResolvedValue({ data: { accepted: true } });

      await useInterviewStore.getState().respond('s1', 'Hello');
      const state = useInterviewStore.getState();
      expect(state.turns.length).toBe(1);
      expect(state.turns[0].user_response).toBe('Hello');
      expect(state.turns[0].ai_message).toBe('');
    });

    it('提交失敗時應設置 error 狀態', async () => {
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [],
      });
      mockRespondApi.mockRejectedValue({ code: 'AI_CALL_FAILED', message: 'AI error' });

      await expect(useInterviewStore.getState().respond('s1', 'test')).rejects.toEqual({
        code: 'AI_CALL_FAILED',
        message: 'AI error',
      });
      const state = useInterviewStore.getState();
      expect(state.error).toBe('AI error');
      expect(state.errorCode).toBe('AI_CALL_FAILED');
      expect(state.isStreaming).toBe(false);
      expect(state.streamingStatus).toBeNull();
    });

    it('提交 shared invalid-response fallback 時應本地化 store error', async () => {
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [],
      });
      mockRespondApi.mockRejectedValue({
        code: 'INVALID_INTERVIEW_RESPONSE',
        message: 'Invalid interview response acknowledgement from server',
      });

      await expect(useInterviewStore.getState().respond('s1', 'test')).rejects.toEqual({
        code: 'INVALID_INTERVIEW_RESPONSE',
        message: 'Invalid interview response acknowledgement from server',
      });

      const state = useInterviewStore.getState();
      expect(state.error).toBe('apiError.invalidResponse');
      expect(state.errorCode).toBe('INVALID_INTERVIEW_RESPONSE');
      expect(state.isStreaming).toBe(false);
    });

    it('網路錯誤時應保留原始錯誤訊息並退出 streaming', async () => {
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [],
      });
      mockRespondApi.mockRejectedValue(new Error('Failed to fetch'));

      await expect(useInterviewStore.getState().respond('s1', 'test')).rejects.toThrow('Failed to fetch');
      const state = useInterviewStore.getState();
      expect(state.error).toBe('Failed to fetch');
      expect(state.errorCode).toBeNull();
      expect(state.isStreaming).toBe(false);
    });

    it('用戶訊息應在提交請求返回前立即寫入 turns', async () => {
      const existingTurn = {
        id: 't1', turn_order: 1, ai_message: 'Question?',
        user_response: undefined, skipped: false, safety_flag: false,
        created_at: '2025-01-01',
      };
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [existingTurn] as never,
      });

      let resolveRequest!: () => void;
      mockRespondApi.mockImplementation(
        () => new Promise<void>((resolve) => { resolveRequest = resolve; })
      );

      const promise = useInterviewStore.getState().respond('s1', '我很難過');

      const midState = useInterviewStore.getState();
      expect(midState.turns[0].user_response).toBe('我很難過');
      expect(midState.isStreaming).toBe(true);
      expect(midState.streamingStatus).toBe('thinking');

      resolveRequest();
      await promise;

      expect(useInterviewStore.getState().isStreaming).toBe(true);
      expect(useInterviewStore.getState().streamingStatus).toBe('thinking');
    });

    it('beginStreaming 應切到 thinking 並清除錯誤', () => {
      useInterviewStore.setState({
        isStreaming: false,
        streamingStatus: null,
        error: 'old',
        errorCode: 'OLD',
      });

      useInterviewStore.getState().beginStreaming();

      const state = useInterviewStore.getState();
      expect(state.isStreaming).toBe(true);
      expect(state.streamingStatus).toBe('thinking');
      expect(state.error).toBeNull();
      expect(state.errorCode).toBeNull();
    });
  });

  describe('skipTurn', () => {
    it('提交成功時應標記最後一個 turn 為 skipped 並進入 thinking', async () => {
      const turn = {
        id: 't1', turn_order: 1, ai_message: 'Question?',
        user_response: undefined, skipped: false, safety_flag: false,
        created_at: '2025-01-01T00:00:00Z',
      };
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [turn] as never,
      });
      mockSkipApi.mockResolvedValue({ data: { accepted: true } });

      await useInterviewStore.getState().skipTurn('s1');
      const state = useInterviewStore.getState();
      expect(mockSkipApi).toHaveBeenCalledWith('s1');
      expect(state.turns.length).toBe(1);
      expect(state.turns[0].skipped).toBe(true);
      expect(state.turns[0].user_response).toBe('');
      expect(state.isStreaming).toBe(true);
      expect(state.streamingStatus).toBe('thinking');
    });

    it('提交失敗時應回退 skip 狀態並設置錯誤', async () => {
      const turn = {
        id: 't1', turn_order: 1, ai_message: 'Question?',
        user_response: undefined, skipped: false, safety_flag: false,
        created_at: '2025-01-01T00:00:00Z',
      };
      useInterviewStore.setState({
        currentSession: { id: 's1', status: 'in_progress' } as never,
        turns: [turn] as never,
      });
      mockSkipApi.mockRejectedValue({ code: 'SKIP_FAILED', message: 'skip fail' });

      await expect(useInterviewStore.getState().skipTurn('s1')).rejects.toEqual({
        code: 'SKIP_FAILED',
        message: 'skip fail',
      });

      const state = useInterviewStore.getState();
      expect(state.turns[0].skipped).toBe(false);
      expect(state.error).toBe('skip fail');
      expect(state.errorCode).toBe('SKIP_FAILED');
      expect(state.isStreaming).toBe(false);
    });
  });

  describe('stream actions', () => {
    it('finishStreaming 應清除 streaming 狀態', () => {
      useInterviewStore.setState({
        isStreaming: true,
        streamingText: 'partial',
        streamingStatus: 'persisting',
      });

      useInterviewStore.getState().finishStreaming();

      expect(useInterviewStore.getState().isStreaming).toBe(false);
      expect(useInterviewStore.getState().streamingText).toBe('');
      expect(useInterviewStore.getState().streamingStatus).toBeNull();
    });

    it('applyStreamFailure 應退出 streaming 並設置錯誤', () => {
      useInterviewStore.setState({
        isStreaming: true,
        streamingText: 'partial',
        streamingStatus: 'streaming',
      });

      useInterviewStore.getState().applyStreamFailure({
        code: 'AI_STREAM_FAILED',
        message: 'stream failed',
      });

      const state = useInterviewStore.getState();
      expect(state.isStreaming).toBe(false);
      expect(state.streamingText).toBe('');
      expect(state.streamingStatus).toBeNull();
      expect(state.error).toBe('stream failed');
      expect(state.errorCode).toBe('AI_STREAM_FAILED');
    });

    it('applyStreamFailure 應本地化 shared invalid-response fallback', () => {
      useInterviewStore.getState().applyStreamFailure({
        code: 'INVALID_INTERVIEW_RESPONSE',
        message: 'Invalid interview stream response from server',
      });

      const state = useInterviewStore.getState();
      expect(state.error).toBe('apiError.invalidResponse');
      expect(state.errorCode).toBe('INVALID_INTERVIEW_RESPONSE');
    });

    it('applyStreamSafetyAlert 應標準化 severity', () => {
      useInterviewStore.getState().applyStreamSafetyAlert({
        message: 'alert',
        severity: 'unknown',
      });

      expect(useInterviewStore.getState().safetyAlert).toEqual({
        message: 'alert',
        severity: 'info',
      });
    });

    it('applyShouldEnd 應只增不減', () => {
      useInterviewStore.getState().applyShouldEnd(false);
      expect(useInterviewStore.getState().shouldEnd).toBe(false);

      useInterviewStore.getState().applyShouldEnd(true);
      expect(useInterviewStore.getState().shouldEnd).toBe(true);

      useInterviewStore.getState().applyShouldEnd(false);
      expect(useInterviewStore.getState().shouldEnd).toBe(true);
    });
  });
});
