import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAIStreamSubscription } from './useAIStreamSubscription';

const mockConnectAIStream = vi.fn();

vi.mock('@/services/aiStream', () => ({
  connectAIStream: (...args: unknown[]) => mockConnectAIStream(...args),
}));

describe('useAIStreamSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockConnectAIStream.mockResolvedValue(() => undefined);
  });

  it('應基於 ready snapshots 建立可恢復狀態', async () => {
    let callbacks: Record<string, (...args: any[]) => void> | null = null;
    mockConnectAIStream.mockImplementation(async (_scopeType, _scopeId, cbs) => {
      callbacks = cbs as Record<string, (...args: any[]) => void>;
      return () => undefined;
    });

    const { result } = renderHook(() => useAIStreamSubscription<string | null>({
      scopeType: 'interview_session',
      scopeId: 'session-1',
      initialState: null,
      reduceReady: () => 'draft-from-ready',
      reduceEvent: (_prev, event) => event.eventType,
      hasRecoverableState: (state) => Boolean(state),
      shouldClearRecoveringOnEvent: (event) => event.eventType === 'stream.delta',
    }));

    await waitFor(() => {
      expect(mockConnectAIStream).toHaveBeenCalledWith(
        'interview_session',
        'session-1',
        expect.any(Object),
        { afterSeq: 0 }
      );
    });

    act(() => {
      callbacks?.onReady?.({
        scopeType: 'interview_session',
        scopeId: 'session-1',
        snapshots: [{
          streamId: 's1',
          requestId: 'r1',
          scopeType: 'interview_session',
          scopeId: 'session-1',
          status: 'started',
          text: '',
          lastSeq: 3,
        }],
      });
    });

    expect(result.current.state).toBe('draft-from-ready');
    expect(result.current.isRecovering).toBe(true);

    act(() => {
      callbacks?.onEvent?.({
        eventType: 'stream.delta',
        streamId: 's1',
        requestId: 'r1',
        scopeType: 'interview_session',
        scopeId: 'session-1',
        seq: 4,
        createdAt: new Date().toISOString(),
        actorRole: 'assistant',
        deltaText: 'hello',
      });
    });

    expect(result.current.state).toBe('stream.delta');
    expect(result.current.isRecovering).toBe(false);
    expect(result.current.lastSeq).toBe(4);
  });

  it('close 後重連應帶入最後 seq', async () => {
    const callbacksList: Array<Record<string, (...args: any[]) => void>> = [];
    mockConnectAIStream.mockImplementation(async (_scopeType, _scopeId, cbs) => {
      callbacksList.push(cbs as Record<string, (...args: any[]) => void>);
      return () => undefined;
    });

    renderHook(() => useAIStreamSubscription<string | null>({
      scopeType: 'chat_room',
      scopeId: 'room-1',
      initialState: null,
      reduceEvent: (_prev, event) => event.eventType,
      hasRecoverableState: (state) => Boolean(state),
    }));

    await waitFor(() => {
      expect(mockConnectAIStream).toHaveBeenCalledTimes(1);
    });

    act(() => {
      callbacksList[0]?.onEvent?.({
        eventType: 'stream.started',
        streamId: 's1',
        requestId: 'r1',
        scopeType: 'chat_room',
        scopeId: 'room-1',
        seq: 7,
        createdAt: new Date().toISOString(),
        actorRole: 'assistant',
      });
      callbacksList[0]?.onClose?.();
    });

    await waitFor(() => {
      expect(mockConnectAIStream).toHaveBeenCalledTimes(2);
    }, { timeout: 3000 });

    expect(mockConnectAIStream).toHaveBeenLastCalledWith(
      'chat_room',
      'room-1',
      expect.any(Object),
      { afterSeq: 7 }
    );
  });

  it('遇到 terminal error 應重置狀態且不重連', async () => {
    let callbacks: Record<string, (...args: any[]) => void> | null = null;
    mockConnectAIStream.mockImplementation(async (_scopeType, _scopeId, cbs) => {
      callbacks = cbs as Record<string, (...args: any[]) => void>;
      return () => undefined;
    });

    const { result } = renderHook(() => useAIStreamSubscription<string | null>({
      scopeType: 'interview_session',
      scopeId: 'session-2',
      initialState: null,
      reduceEvent: () => 'active',
      isTerminalError: (error) => error.status === 403,
    }));

    await waitFor(() => {
      expect(mockConnectAIStream).toHaveBeenCalledTimes(1);
    });

    act(() => {
      callbacks?.onEvent?.({
        eventType: 'stream.started',
        streamId: 's1',
        requestId: 'r1',
        scopeType: 'interview_session',
        scopeId: 'session-2',
        seq: 1,
        createdAt: new Date().toISOString(),
        actorRole: 'assistant',
      });
    });
    expect(result.current.state).toBe('active');

    act(() => {
      callbacks?.onError?.({ code: 'FORBIDDEN', message: 'forbidden', status: 403 });
    });

    expect(result.current.state).toBeNull();
    expect(mockConnectAIStream).toHaveBeenCalledTimes(1);
  });
});
