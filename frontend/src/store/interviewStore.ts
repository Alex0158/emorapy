/**
 * 訪談狀態管理
 */

import { create } from 'zustand';
import { interviewApi } from '@/services/api/interview';
import { t } from '@/utils/i18n';
import type { AIStreamDraftStatus } from '@/utils/aiStreamState';
import type { InterviewResumeStatus, InterviewSession, InterviewTrigger, InterviewTurn } from '@/types/interview';
import {
  extractInterviewErrorInfo,
  getInterviewStreamFailureMessage,
  getStreamingIdleWithAbortState,
  getStreamingIdleState,
  getStreamingStartState,
  normalizeSafetyAlertSeverity,
  shouldRecoverStreamingFromCanonical,
} from './interviewStoreUtils';

export interface SafetyAlertData {
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

interface InterviewState {
  currentSession: InterviewSession | null;
  turns: InterviewTurn[];
  streamingText: string;
  isStreaming: boolean;
  streamingStatus: AIStreamDraftStatus | null;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  abortController: AbortController | null;
  shouldEnd: boolean;
  safetyAlert: SafetyAlertData | null;

  startSession: (trigger?: InterviewTrigger) => Promise<InterviewSession>;
  checkResume: () => Promise<InterviewResumeStatus>;
  respond: (sessionId: string, message: string) => Promise<void>;
  skipTurn: (sessionId: string) => Promise<void>;
  endSession: (sessionId: string) => Promise<void>;
  getSession: (sessionId: string) => Promise<void>;
  syncSessionSilently: (sessionId: string) => Promise<void>;
  retryFailed: (sessionId: string) => Promise<void>;
  cancelStream: (sessionId?: string) => Promise<void>;
  beginStreaming: () => void;
  finishStreaming: () => void;
  applyStreamFailure: (error: { code?: string; message?: string }) => void;
  applyStreamSafetyAlert: (data: { message?: string; severity?: string }) => void;
  applyShouldEnd: (shouldEnd: boolean) => void;
  dismissSafetyAlert: () => void;
  reset: () => void;
}

let _getSessionSeq = 0;

export const useInterviewStore = create<InterviewState>((set, get) => {
  async function submitTurn(
    submit: () => Promise<unknown>,
    opts: {
      buildPrevTurns: (turns: InterviewTurn[]) => InterviewTurn[];
    },
  ): Promise<void> {
    if (get().isStreaming) return;
    set(getStreamingStartState());

    try {
      await submit();
    } catch (err: unknown) {
      const { turns } = get();
      const preservedTurns = opts.buildPrevTurns(turns);
      const info = extractInterviewErrorInfo(err, 'interview.respondFail');
      set({
        turns: preservedTurns,
        error: info.message,
        errorCode: info.code,
        ...getStreamingIdleWithAbortState(),
      });
      throw err;
    }
  }

  return {
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

  startSession: async (trigger = 'organic') => {
    set({
      loading: true,
      error: null,
      errorCode: null,
      shouldEnd: false,
      ...getStreamingIdleState(),
      safetyAlert: null,
    });
    try {
      const session = (await interviewApi.startSession(trigger)) as InterviewSession | null;
      if (!session) throw new Error(t('interview.startFail'));
      set({
        currentSession: session,
        turns: session.turns || [],
        loading: false,
      });
      return session;
    } catch (err: unknown) {
      const info = extractInterviewErrorInfo(err, 'interview.startFail');
      set({ error: info.message, errorCode: info.code, loading: false });
      throw err;
    }
  },

  checkResume: async () => {
    try {
      return (await interviewApi.checkResume()) ?? { has_pending: false };
    } catch {
      return { has_pending: false };
    }
  },

  respond: async (sessionId: string, message: string) => {
    if (get().isStreaming) return;

    set((state) => {
      const { turns } = state;
      const updatedTurns = turns.length === 0
        ? [{
            id: `temp-user-${Date.now()}`,
            turn_order: 0,
            ai_message: '',
            user_response: message,
            skipped: false,
            safety_flag: false,
            created_at: new Date().toISOString(),
          } as InterviewTurn]
        : turns.map((turn, i) =>
            i === turns.length - 1 && !turn.user_response
              ? { ...turn, user_response: message }
              : turn
          );
      return { turns: updatedTurns };
    });

    await submitTurn(() => interviewApi.respond(sessionId, message), {
      buildPrevTurns: (turns) => turns,
    });
  },

  skipTurn: (sessionId: string) =>
    (() => {
      set((state) => ({
        turns:
          state.turns.length > 0 && !state.turns[state.turns.length - 1].user_response
            ? [
                ...state.turns.slice(0, -1),
                { ...state.turns[state.turns.length - 1], user_response: '', skipped: true },
              ]
            : state.turns,
      }));
      return submitTurn(() => interviewApi.skip(sessionId), {
        buildPrevTurns: (turns) =>
          turns.length > 0 && turns[turns.length - 1].skipped
            ? [
                ...turns.slice(0, -1),
                { ...turns[turns.length - 1], user_response: undefined, skipped: false },
              ]
            : turns,
      });
    })(),

  endSession: async (sessionId: string) => {
    set({ loading: true, error: null, errorCode: null });
    try {
      await interviewApi.endSession(sessionId);
      set((state) => ({
        currentSession: state.currentSession
          ? { ...state.currentSession, status: 'processing' as const }
          : null,
        loading: false,
      }));
    } catch (err: unknown) {
      const info = extractInterviewErrorInfo(err, 'interview.endFail');
      set({ error: info.message, errorCode: info.code, loading: false });
      throw err;
    }
  },

  getSession: async (sessionId: string) => {
    const seq = ++_getSessionSeq;
    set({
      loading: true,
      error: null,
      errorCode: null,
      shouldEnd: false,
      ...getStreamingIdleState(),
      safetyAlert: null,
    });
    try {
      const session = (await interviewApi.getSession(sessionId)) as InterviewSession | null;
      if (seq !== _getSessionSeq) return;
      if (!session) throw new Error(t('interview.loadFail'));
      set({
        currentSession: session,
        turns: session.turns || [],
        loading: false,
      });
    } catch (err: unknown) {
      if (seq !== _getSessionSeq) throw err;
      const info = extractInterviewErrorInfo(err, 'interview.loadFail');
      const isNotFound = info.code === 'NOT_FOUND' || info.status === 404;
      set({
        error: info.message,
        errorCode: info.code,
        loading: false,
        ...(isNotFound ? { currentSession: null } : {}),
        turns: [],
      });
      throw err;
    }
  },

  syncSessionSilently: async (sessionId: string) => {
    try {
      const session = (await interviewApi.getSession(sessionId)) as InterviewSession | null;
      if (!session) return;
      set((state) => ({
        currentSession: session,
        turns: session.turns || [],
        shouldEnd: state.shouldEnd || session.status === 'completed',
        ...(shouldRecoverStreamingFromCanonical(state.isStreaming, state.turns, session)
          ? getStreamingIdleWithAbortState()
          : {}),
      }));
    } catch {
      // Keep optimistic local state when canonical refresh fails.
    }
  },

  retryFailed: async (sessionId: string) => {
    set({ loading: true, error: null, errorCode: null });
    try {
      await interviewApi.retryFailed(sessionId);
      set({ loading: false });
    } catch (err: unknown) {
      const info = extractInterviewErrorInfo(err, 'interview.retryFail');
      set({ error: info.message, errorCode: info.code, loading: false });
      throw err;
    }
  },

  /** 取消進行中的串流（卸載頁面或使用者按「停止」）。不再寫入 cancelledDraft，避免以假對話氣泡長駐。 */
  cancelStream: async (sessionId?: string) => {
    if (sessionId) {
      try {
        await interviewApi.cancel(sessionId);
      } catch {
        /* 仍清除本地串流狀態 */
      }
    }
    set(getStreamingIdleWithAbortState());
  },

  beginStreaming: () => {
    set({
      isStreaming: true,
      streamingStatus: 'thinking',
      error: null,
      errorCode: null,
    });
  },

  finishStreaming: () => {
    set(getStreamingIdleWithAbortState());
  },

  applyStreamFailure: (error: { code?: string; message?: string }) => {
    set({
      error: getInterviewStreamFailureMessage(error),
      errorCode: error.code || null,
      ...getStreamingIdleWithAbortState(),
    });
  },

  applyStreamSafetyAlert: (data) => {
    set({
      safetyAlert: {
        message: data.message || t('interview.respondFail'),
        severity: normalizeSafetyAlertSeverity(data.severity),
      },
    });
  },

  applyShouldEnd: (shouldEnd: boolean) => {
    set((state) => ({
      shouldEnd: shouldEnd || state.shouldEnd,
    }));
  },

  dismissSafetyAlert: () => {
    set({ safetyAlert: null });
  },

  reset: () => {
    const { abortController } = get();
    abortController?.abort();
    set({
      currentSession: null,
      turns: [],
      ...getStreamingIdleWithAbortState(),
      loading: false,
      error: null,
      errorCode: null,
      shouldEnd: false,
      safetyAlert: null,
    });
  },
};
});
