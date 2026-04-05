import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { connectAIStream, type AIStreamReadyEvent } from '@/services/aiStream';
import type { AIStreamEvent, AIStreamScopeType } from '@/types/aiStream';

type StreamError = { code: string; message: string; status?: number };

interface UseAIStreamSubscriptionOptions<TState> {
  scopeType: AIStreamScopeType;
  scopeId?: string | null;
  enabled?: boolean;
  initialState: TState;
  reduceReady?: (prev: TState, ready: AIStreamReadyEvent) => TState;
  reduceEvent: (prev: TState, event: AIStreamEvent) => TState;
  onReady?: (ready: AIStreamReadyEvent) => void;
  onEvent?: (event: AIStreamEvent) => void;
  onConnectionError?: (error: StreamError) => void;
  onTerminalError?: (error: StreamError) => void;
  isTerminalError?: (error: StreamError) => boolean;
  hasRecoverableState?: (state: TState) => boolean;
  shouldClearRecoveringOnEvent?: (event: AIStreamEvent) => boolean;
  getRetryDelayMs?: (retryCount: number) => number;
  resetOnTerminalError?: boolean;
}

interface UseAIStreamSubscriptionResult<TState> {
  state: TState;
  setState: Dispatch<SetStateAction<TState>>;
  isRecovering: boolean;
  lastSeq: number;
  resetState: () => void;
}

const defaultRetryDelayMs = (retryCount: number) => Math.min(10000, 1000 * Math.max(1, retryCount + 1));

export function useAIStreamSubscription<TState>({
  scopeType,
  scopeId,
  enabled = true,
  initialState,
  reduceReady,
  reduceEvent,
  onReady,
  onEvent,
  onConnectionError,
  onTerminalError,
  isTerminalError,
  hasRecoverableState,
  shouldClearRecoveringOnEvent,
  getRetryDelayMs = defaultRetryDelayMs,
  resetOnTerminalError = true,
}: UseAIStreamSubscriptionOptions<TState>): UseAIStreamSubscriptionResult<TState> {
  const [state, setInnerState] = useState<TState>(initialState);
  const [isRecovering, setIsRecovering] = useState(false);
  const stateRef = useRef(state);
  const initialStateRef = useRef(initialState);
  const cleanupRef = useRef<(() => void) | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeqRef = useRef(0);

  const reduceReadyRef = useRef(reduceReady);
  const reduceEventRef = useRef(reduceEvent);
  const onReadyRef = useRef(onReady);
  const onEventRef = useRef(onEvent);
  const onConnectionErrorRef = useRef(onConnectionError);
  const onTerminalErrorRef = useRef(onTerminalError);
  const isTerminalErrorRef = useRef(isTerminalError);
  const hasRecoverableStateRef = useRef(hasRecoverableState);
  const shouldClearRecoveringOnEventRef = useRef(shouldClearRecoveringOnEvent);
  const getRetryDelayMsRef = useRef(getRetryDelayMs);

  useEffect(() => {
    reduceReadyRef.current = reduceReady;
    reduceEventRef.current = reduceEvent;
    onReadyRef.current = onReady;
    onEventRef.current = onEvent;
    onConnectionErrorRef.current = onConnectionError;
    onTerminalErrorRef.current = onTerminalError;
    isTerminalErrorRef.current = isTerminalError;
    hasRecoverableStateRef.current = hasRecoverableState;
    shouldClearRecoveringOnEventRef.current = shouldClearRecoveringOnEvent;
    getRetryDelayMsRef.current = getRetryDelayMs;
  }, [
    getRetryDelayMs,
    hasRecoverableState,
    isTerminalError,
    onConnectionError,
    onEvent,
    onReady,
    onTerminalError,
    reduceEvent,
    reduceReady,
    shouldClearRecoveringOnEvent,
  ]);

  useEffect(() => {
    initialStateRef.current = initialState;
  }, [initialState]);

  const setState = useCallback<Dispatch<SetStateAction<TState>>>((value) => {
    setInnerState((prev) => {
      const next = typeof value === 'function'
        ? (value as (prevState: TState) => TState)(prev)
        : value;
      stateRef.current = next;
      return next;
    });
  }, []);

  const clearRetry = useCallback(() => {
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    clearRetry();
    lastSeqRef.current = 0;
    stateRef.current = initialStateRef.current;
    setInnerState(initialStateRef.current);
    setIsRecovering(false);
  }, [clearRetry]);

  useEffect(() => {
    if (!enabled || !scopeId) {
      resetState();
      return;
    }

    let cancelled = false;
    cleanupRef.current?.();
    cleanupRef.current = null;
    clearRetry();
    lastSeqRef.current = 0;
    stateRef.current = initialStateRef.current;
    setInnerState(initialStateRef.current);
    setIsRecovering(false);

    const bind = async (retryCount = 0) => {
      const scheduleReconnect = () => {
        const canRecover = hasRecoverableStateRef.current?.(stateRef.current) ?? false;
        if (canRecover) {
          setIsRecovering(true);
        }
        clearRetry();
        retryRef.current = setTimeout(() => {
          if (cancelled) return;
          void bind(retryCount + 1);
        }, getRetryDelayMsRef.current(retryCount));
      };

      let cleanup: () => void;
      try {
        cleanup = await connectAIStream(
          scopeType,
          scopeId,
          {
            onReady: (ready) => {
              if (cancelled) return;
              const snapshots = Array.isArray(ready.snapshots) ? ready.snapshots : [];
              if (snapshots.length > 0) {
                const maxSeq = Math.max(...snapshots.map((snapshot) => snapshot.lastSeq));
                lastSeqRef.current = Math.max(lastSeqRef.current, maxSeq);
              }
              if (reduceReadyRef.current) {
                setState((prev) => reduceReadyRef.current?.(prev, ready) ?? prev);
              }
              const recoverable = hasRecoverableStateRef.current?.(stateRef.current) ?? false;
              setIsRecovering(recoverable);
              onReadyRef.current?.(ready);
            },
            onEvent: (event) => {
              if (cancelled) return;
              lastSeqRef.current = Math.max(lastSeqRef.current, event.seq);
              setState((prev) => reduceEventRef.current(prev, event));
              const shouldClear = shouldClearRecoveringOnEventRef.current?.(event) ?? false;
              if (shouldClear || !(hasRecoverableStateRef.current?.(stateRef.current) ?? false)) {
                setIsRecovering(false);
              }
              onEventRef.current?.(event);
            },
            onError: (error) => {
              if (cancelled) return;
              const terminal = isTerminalErrorRef.current?.(error) ?? false;
              if (terminal) {
                clearRetry();
                if (resetOnTerminalError) {
                  stateRef.current = initialStateRef.current;
                  setInnerState(initialStateRef.current);
                }
                setIsRecovering(false);
                onTerminalErrorRef.current?.(error);
                return;
              }
              onConnectionErrorRef.current?.(error);
              scheduleReconnect();
            },
            onClose: () => {
              if (cancelled) return;
              scheduleReconnect();
            },
          },
          { afterSeq: lastSeqRef.current }
        );
      } catch {
        if (!cancelled) {
          scheduleReconnect();
        }
        return;
      }

      if (cancelled) {
        cleanup();
        return;
      }
      cleanupRef.current = cleanup;
    };

    void bind();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      clearRetry();
      setIsRecovering(false);
    };
  }, [clearRetry, enabled, resetOnTerminalError, resetState, scopeId, scopeType, setState]);

  return {
    state,
    setState,
    isRecovering,
    lastSeq: lastSeqRef.current,
    resetState,
  };
}
