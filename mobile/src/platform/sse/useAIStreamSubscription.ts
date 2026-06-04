import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AIStreamEvent } from '@cj/contracts/ai-stream';

import type { AIStreamCallbacks, AIStreamReadyEvent } from '@/src/platform/sse/aiStreamState';
import {
  getCurrentLifecycleStatus,
  subscribeLifecycle,
  type AppLifecycleStatus,
} from '@/src/platform/lifecycle/native';
import { getLocalizedStreamDisconnectedMessage } from '@/src/platform/api/errorMessages';

export interface AppStreamError {
  code: string;
  message: string;
  status?: number;
}

interface UseAIStreamSubscriptionOptions<TState> {
  scopeKey?: string | null;
  enabled?: boolean;
  initialState: TState;
  connect: (
    callbacks: AIStreamCallbacks,
    options: { afterSeq?: number; signal?: AbortSignal }
  ) => Promise<void>;
  reduceReady?: (prev: TState, ready: AIStreamReadyEvent) => TState;
  reduceEvent: (prev: TState, event: AIStreamEvent) => TState;
  normalizeError?: (error: unknown) => AppStreamError;
  onReady?: (ready: AIStreamReadyEvent) => void;
  onEvent?: (event: AIStreamEvent) => void;
  onConnectionError?: (error: AppStreamError) => void;
  onTerminalError?: (error: AppStreamError) => void;
  isTerminalError?: (error: AppStreamError) => boolean;
  hasRecoverableState?: (state: TState) => boolean;
  shouldClearRecoveringOnEvent?: (event: AIStreamEvent) => boolean;
  getRetryDelayMs?: (retryCount: number) => number;
}

export interface UseAIStreamSubscriptionResult<TState> {
  state: TState;
  setState: Dispatch<SetStateAction<TState>>;
  isRecovering: boolean;
  lifecycleStatus: AppLifecycleStatus;
  lastSeq: number;
  resetState: () => void;
}

const defaultRetryDelayMs = (retryCount: number) => Math.min(10000, 1000 * Math.max(1, retryCount + 1));

function coerceLifecycleStatus(status: unknown): AppLifecycleStatus {
  return typeof status === 'string' ? status as AppLifecycleStatus : 'active';
}

function isForeground(status: AppLifecycleStatus): boolean {
  return status === 'active' || status === 'unknown';
}

function normalizeStreamError(error: unknown): AppStreamError {
  if (
    error
    && typeof error === 'object'
    && typeof (error as { code?: unknown }).code === 'string'
    && typeof (error as { message?: unknown }).message === 'string'
  ) {
    return {
      code: (error as { code: string }).code,
      message: (error as { message: string }).message,
      ...(typeof (error as { status?: unknown }).status === 'number'
        ? { status: (error as { status: number }).status }
        : {}),
    };
  }

  const status = typeof (error as { status?: unknown })?.status === 'number'
    ? (error as { status: number }).status
    : undefined;
  return {
    code: status ? `HTTP_${status}` : 'STREAM_DISCONNECTED',
    message: getLocalizedStreamDisconnectedMessage(),
    ...(status ? { status } : {}),
  };
}

export function useAIStreamSubscription<TState>({
  scopeKey,
  enabled = true,
  initialState,
  connect,
  reduceReady,
  reduceEvent,
  normalizeError = normalizeStreamError,
  onReady,
  onEvent,
  onConnectionError,
  onTerminalError,
  isTerminalError,
  hasRecoverableState,
  shouldClearRecoveringOnEvent,
  getRetryDelayMs = defaultRetryDelayMs,
}: UseAIStreamSubscriptionOptions<TState>): UseAIStreamSubscriptionResult<TState> {
  const [state, setInnerState] = useState<TState>(initialState);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lifecycleStatus, setLifecycleStatus] = useState<AppLifecycleStatus>(() => (
    coerceLifecycleStatus(getCurrentLifecycleStatus())
  ));

  const abortRef = useRef<(() => void) | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeqRef = useRef(0);
  const lastScopeKeyRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const initialStateRef = useRef(initialState);

  const connectRef = useRef(connect);
  const reduceReadyRef = useRef(reduceReady);
  const reduceEventRef = useRef(reduceEvent);
  const normalizeErrorRef = useRef(normalizeError);
  const onReadyRef = useRef(onReady);
  const onEventRef = useRef(onEvent);
  const onConnectionErrorRef = useRef(onConnectionError);
  const onTerminalErrorRef = useRef(onTerminalError);
  const isTerminalErrorRef = useRef(isTerminalError);
  const hasRecoverableStateRef = useRef(hasRecoverableState);
  const shouldClearRecoveringOnEventRef = useRef(shouldClearRecoveringOnEvent);
  const getRetryDelayMsRef = useRef(getRetryDelayMs);

  useEffect(() => subscribeLifecycle((status) => setLifecycleStatus(coerceLifecycleStatus(status))), []);

  useEffect(() => {
    initialStateRef.current = initialState;
  }, [initialState]);

  useEffect(() => {
    connectRef.current = connect;
    reduceReadyRef.current = reduceReady;
    reduceEventRef.current = reduceEvent;
    normalizeErrorRef.current = normalizeError;
    onReadyRef.current = onReady;
    onEventRef.current = onEvent;
    onConnectionErrorRef.current = onConnectionError;
    onTerminalErrorRef.current = onTerminalError;
    isTerminalErrorRef.current = isTerminalError;
    hasRecoverableStateRef.current = hasRecoverableState;
    shouldClearRecoveringOnEventRef.current = shouldClearRecoveringOnEvent;
    getRetryDelayMsRef.current = getRetryDelayMs;
  }, [
    connect,
    getRetryDelayMs,
    hasRecoverableState,
    isTerminalError,
    normalizeError,
    onConnectionError,
    onEvent,
    onReady,
    onTerminalError,
    reduceEvent,
    reduceReady,
    shouldClearRecoveringOnEvent,
  ]);

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

  const abortCurrent = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
  }, []);

  const resetState = useCallback(() => {
    abortCurrent();
    clearRetry();
    lastSeqRef.current = 0;
    stateRef.current = initialStateRef.current;
    setInnerState(initialStateRef.current);
    setIsRecovering(false);
  }, [abortCurrent, clearRetry]);

  useEffect(() => {
    const nextScopeKey = scopeKey ?? null;
    if (lastScopeKeyRef.current === nextScopeKey) return;
    lastScopeKeyRef.current = nextScopeKey;
    resetState();
  }, [resetState, scopeKey]);

  useEffect(() => {
    if (!enabled || !scopeKey) {
      resetState();
      return undefined;
    }

    let cancelled = false;
    abortCurrent();
    clearRetry();

    if (!isForeground(lifecycleStatus)) {
      const recoverable = hasRecoverableStateRef.current?.(stateRef.current) ?? false;
      setIsRecovering(recoverable);
      return undefined;
    }

    const bind = async (retryCount = 0) => {
      if (cancelled || !isForeground(lifecycleStatus)) return;

      const controller = new AbortController();
      let reconnectScheduled = false;
      abortRef.current = () => controller.abort();

      const scheduleReconnect = (rawError?: unknown) => {
        if (cancelled || controller.signal.aborted || reconnectScheduled || !isForeground(lifecycleStatus)) return;
        reconnectScheduled = true;
        const error = rawError ? normalizeErrorRef.current(rawError) : null;
        if (error && (isTerminalErrorRef.current?.(error) ?? false)) {
          clearRetry();
          setIsRecovering(false);
          onTerminalErrorRef.current?.(error);
          return;
        }

        if (error) {
          onConnectionErrorRef.current?.(error);
        }
        const recoverable = hasRecoverableStateRef.current?.(stateRef.current) ?? false;
        setIsRecovering(recoverable);
        clearRetry();
        retryRef.current = setTimeout(() => {
          if (cancelled) return;
          void bind(retryCount + 1);
        }, getRetryDelayMsRef.current(retryCount));
      };

      try {
        await connectRef.current(
          {
            onReady: (ready) => {
              if (cancelled || controller.signal.aborted) return;
              const snapshots = Array.isArray(ready.snapshots) ? ready.snapshots : [];
              if (snapshots.length > 0) {
                lastSeqRef.current = Math.max(
                  lastSeqRef.current,
                  ...snapshots.map((snapshot) => snapshot.lastSeq)
                );
              }
              if (reduceReadyRef.current) {
                setState((prev) => reduceReadyRef.current?.(prev, ready) ?? prev);
              }
              const recoverable = hasRecoverableStateRef.current?.(stateRef.current) ?? false;
              setIsRecovering(recoverable);
              onReadyRef.current?.(ready);
            },
            onEvent: (event) => {
              if (cancelled || controller.signal.aborted) return;
              lastSeqRef.current = Math.max(lastSeqRef.current, event.seq);
              setState((prev) => reduceEventRef.current(prev, event));
              const shouldClear = shouldClearRecoveringOnEventRef.current?.(event) ?? false;
              if (shouldClear || !(hasRecoverableStateRef.current?.(stateRef.current) ?? false)) {
                setIsRecovering(false);
              }
              onEventRef.current?.(event);
            },
            onError: scheduleReconnect,
            onClose: () => scheduleReconnect(),
          },
          {
            afterSeq: lastSeqRef.current > 0 ? lastSeqRef.current : undefined,
            signal: controller.signal,
          }
        );

        scheduleReconnect();
      } catch (error) {
        scheduleReconnect(error);
      }
    };

    void bind();

    return () => {
      cancelled = true;
      abortCurrent();
      clearRetry();
    };
  }, [
    abortCurrent,
    clearRetry,
    enabled,
    lifecycleStatus,
    resetState,
    scopeKey,
    setState,
  ]);

  return {
    state,
    setState,
    isRecovering,
    lifecycleStatus,
    lastSeq: lastSeqRef.current,
    resetState,
  };
}
