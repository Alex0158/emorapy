/**
 * 訪談狀態管理
 */

import { create } from 'zustand';
import { interviewApi } from '@/services/api/interview';
import { t } from '@/utils/i18n';
import { buildLocalDraft, type AIStreamDraft, type AIStreamDraftStatus } from '@/utils/aiStreamState';
import type { InterviewSession, InterviewTurn } from '@/types/interview';

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
  cancelledDraft: AIStreamDraft | null;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  abortController: AbortController | null;
  shouldEnd: boolean;
  safetyAlert: SafetyAlertData | null;

  startSession: (trigger?: string) => Promise<InterviewSession>;
  checkResume: () => Promise<{ has_pending: boolean; session_id?: string; last_ai_message?: string | null; turn_count?: number; has_failed?: boolean; failed_session_id?: string }>;
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

function extractErrorInfo(err: unknown): { message: string; code: string | null; status: number | null } {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; status?: number };
    return {
      message: e.message || 'Unknown error',
      code: e.code || null,
      status: e.status ?? null,
    };
  }
  return { message: String(err), code: null, status: null };
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
    set({
      isStreaming: true,
      streamingText: '',
      streamingStatus: 'thinking',
      cancelledDraft: null,
      error: null,
      errorCode: null,
      safetyAlert: null,
      abortController: null,
    });

    try {
      await submit();
    } catch (err: unknown) {
      const { turns } = get();
      const preservedTurns = opts.buildPrevTurns(turns);
      const info = extractErrorInfo(err);
      set({
        turns: preservedTurns,
        error: info.message || t('interview.respondFail'),
        errorCode: info.code,
        isStreaming: false,
        streamingText: '',
        streamingStatus: null,
        cancelledDraft: null,
        abortController: null,
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
  cancelledDraft: null,
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
      streamingText: '',
      isStreaming: false,
      streamingStatus: null,
      cancelledDraft: null,
      safetyAlert: null,
    });
    try {
      const res = await interviewApi.startSession(trigger);
      const session = (res.data?.data ?? null) as InterviewSession | null;
      if (!session) throw new Error(t('interview.startFail'));
      set({
        currentSession: session,
        turns: session.turns || [],
        loading: false,
      });
      return session;
    } catch (err: unknown) {
      const info = extractErrorInfo(err);
      set({ error: info.message || t('interview.startFail'), errorCode: info.code, loading: false });
      throw err;
    }
  },

  checkResume: async () => {
    try {
      const res = await interviewApi.checkResume();
      const data = res.data?.data as { has_pending: boolean; session_id?: string; last_ai_message?: string | null; turn_count?: number; has_failed?: boolean; failed_session_id?: string } | undefined;
      return data ?? { has_pending: false };
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
      const info = extractErrorInfo(err);
      set({ error: info.message || t('interview.endFail'), errorCode: info.code, loading: false });
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
      streamingText: '',
      isStreaming: false,
      streamingStatus: null,
      cancelledDraft: null,
      safetyAlert: null,
    });
    try {
      const res = await interviewApi.getSession(sessionId);
      if (seq !== _getSessionSeq) return;
      const session = (res.data?.data ?? null) as InterviewSession | null;
      if (!session) throw new Error(t('interview.loadFail'));
      set({
        currentSession: session,
        turns: session.turns || [],
        loading: false,
      });
    } catch (err: unknown) {
      if (seq !== _getSessionSeq) throw err;
      const info = extractErrorInfo(err);
      const isNotFound = info.code === 'NOT_FOUND' || info.status === 404;
      set({
        error: info.message || t('interview.loadFail'),
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
      const res = await interviewApi.getSession(sessionId);
      const session = (res.data?.data ?? null) as InterviewSession | null;
      if (!session) return;
      set((state) => ({
        currentSession: session,
        turns: session.turns || [],
        shouldEnd: state.shouldEnd || session.status === 'completed',
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
      const info = extractErrorInfo(err);
      set({ error: info.message || t('interview.retryFail'), errorCode: info.code, loading: false });
      throw err;
    }
  },

  cancelStream: async (sessionId?: string) => {
    const { streamingText } = get();
    if (sessionId) {
      try {
        await interviewApi.cancel(sessionId);
      } catch {
        // Preserve local cancelled state even if cancel request fails.
      }
    }
    set({
      isStreaming: false,
      streamingText: '',
      streamingStatus: null,
      cancelledDraft: buildLocalDraft({
        text: streamingText,
        status: 'cancelled',
      }),
      abortController: null,
    });
  },

  beginStreaming: () => {
    set({
      isStreaming: true,
      streamingStatus: 'thinking',
      cancelledDraft: null,
      error: null,
      errorCode: null,
    });
  },

  finishStreaming: () => {
    set({
      isStreaming: false,
      streamingText: '',
      streamingStatus: null,
      abortController: null,
    });
  },

  applyStreamFailure: (error) => {
    set({
      error: error.message || t('interview.respondFail'),
      errorCode: error.code || null,
      isStreaming: false,
      streamingText: '',
      streamingStatus: null,
      abortController: null,
    });
  },

  applyStreamSafetyAlert: (data) => {
    const severityValue = data.severity;
    const normalizedSeverity: SafetyAlertData['severity'] =
      severityValue === 'warning' || severityValue === 'critical' ? severityValue : 'info';
    set({
      safetyAlert: {
        message: data.message || t('interview.respondFail'),
        severity: normalizedSeverity,
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
      streamingText: '',
      isStreaming: false,
      streamingStatus: null,
      cancelledDraft: null,
      loading: false,
      error: null,
      errorCode: null,
      abortController: null,
      shouldEnd: false,
      safetyAlert: null,
    });
  },
};
});
