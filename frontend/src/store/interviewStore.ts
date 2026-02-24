/**
 * 訪談狀態管理
 */

import { create } from 'zustand';
import { interviewApi } from '@/services/api/interview';
import { sseRequest } from '@/services/sseRequest';
import { t } from '@/utils/i18n';
import type {
  InterviewSession,
  InterviewTurn,
  PsychDomain,
  InterviewStatus,
} from '@/types/interview';

export interface SafetyAlertData {
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

interface SSEMetadata {
  turn_order?: number;
  intent?: string;
  target_domains?: string[];
  should_end?: boolean;
  domains_touched?: string[];
}

interface InterviewState {
  currentSession: InterviewSession | null;
  turns: InterviewTurn[];
  streamingText: string;
  isStreaming: boolean;
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
  retryFailed: (sessionId: string) => Promise<void>;
  cancelStream: () => void;
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

function isAbortError(err: unknown): boolean {
  return !!(err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError');
}

function buildAiTurn(fullText: string, metadata: SSEMetadata | null, lastTurn: InterviewTurn | undefined): InterviewTurn {
  const nextOrder = metadata?.turn_order ?? (lastTurn ? lastTurn.turn_order + 1 : 1);
  return {
    id: `temp-ai-${Date.now()}`,
    turn_order: nextOrder,
    ai_message: fullText,
    ai_intent: metadata?.intent,
    ai_target_domains: metadata?.target_domains as PsychDomain[] | undefined,
    user_response: undefined,
    skipped: false,
    safety_flag: false,
    created_at: new Date().toISOString(),
  };
}

function updateSessionFromComplete(
  state: InterviewState,
  completeData: { status?: string; domains_touched?: string[] } | null,
  metadata: SSEMetadata | null,
): InterviewSession | null {
  if (!state.currentSession) return state.currentSession;
  if (completeData?.status) {
    return {
      ...state.currentSession,
      status: completeData.status as InterviewStatus,
      domains_touched:
        (completeData.domains_touched as PsychDomain[]) ??
        (metadata?.domains_touched as PsychDomain[]) ??
        state.currentSession.domains_touched ??
        [],
    };
  }
  if (metadata?.domains_touched) {
    return {
      ...state.currentSession,
      domains_touched: (metadata.domains_touched as PsychDomain[]) ?? state.currentSession.domains_touched ?? [],
    };
  }
  return state.currentSession;
}

let _getSessionSeq = 0;

export const useInterviewStore = create<InterviewState>((set, get) => {

  async function runSSE(
    endpoint: string,
    body: Record<string, unknown>,
    opts: {
      buildPrevTurns: (turns: InterviewTurn[]) => InterviewTurn[];
      detectConnectionError?: boolean;
    },
  ): Promise<void> {
    if (get().isStreaming) return;
    const abortController = new AbortController();
    set({ isStreaming: true, streamingText: '', error: null, errorCode: null, safetyAlert: null, abortController });

    try {
      let fullText = '';
      let metadata: SSEMetadata | null = null;
      let completeData: { status?: string; domains_touched?: string[] } | null = null;
      let hadServerError = false;

      await sseRequest(
        endpoint,
        body,
        {
          onToken: (text) => {
            fullText += text;
            set({ streamingText: fullText });
          },
          onMetadata: (data: SSEMetadata) => {
            metadata = data;
          },
          onSafetyAlert: (data: Record<string, unknown>) => {
            const severityValue = data.severity;
            const normalizedSeverity: SafetyAlertData['severity'] =
              severityValue === 'warning' || severityValue === 'critical' ? severityValue : 'info';
            set({
              safetyAlert: {
                message: typeof data.message === 'string' ? data.message : t('interview.respondFail'),
                severity: normalizedSeverity,
              },
            });
          },
          onComplete: (data) => {
            completeData = data;
          },
          onError: (error: { code?: string; message?: string }) => {
            hadServerError = true;
            set({
              error: error?.message || t('interview.respondFail'),
              errorCode: error?.code || null,
            });
          },
        },
        abortController.signal
      );

      if (!hadServerError && (completeData || fullText)) {
        const { turns } = get();
        const aiTurn = buildAiTurn(fullText, metadata, turns[turns.length - 1]);
        const prevTurns = opts.buildPrevTurns(turns);

        set((state) => ({
          turns: [...prevTurns, aiTurn],
          streamingText: '',
          isStreaming: false,
          shouldEnd: metadata?.should_end || false,
          currentSession: updateSessionFromComplete(state, completeData, metadata),
        }));
      } else {
        const { turns } = get();
        const fallbackTurns = opts.buildPrevTurns(turns);
        set({
          turns: fallbackTurns,
          streamingText: '',
          isStreaming: false,
        });
      }
    } catch (err: unknown) {
      const { turns } = get();
      const preservedTurns = opts.buildPrevTurns(turns);

      if (isAbortError(err)) {
        set({ turns: preservedTurns, isStreaming: false, streamingText: '' });
        return;
      }
      const info = extractErrorInfo(err);
      const isConnectionError = opts.detectConnectionError &&
        (info.message?.includes('fetch') || info.message?.includes('network') || info.message?.includes('Failed to fetch') || info.code === 'CONNECTION_TIMEOUT');
      set({
        turns: preservedTurns,
        error: isConnectionError ? t('interview.error.connectionLost') : (info.message || t('interview.respondFail')),
        errorCode: isConnectionError ? 'CONNECTION_LOST' : info.code,
        isStreaming: false,
        streamingText: '',
      });
    } finally {
      set({ isStreaming: false, abortController: null });
    }
  }

  return {
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

  startSession: async (trigger = 'organic') => {
    set({ loading: true, error: null, errorCode: null, shouldEnd: false, streamingText: '', isStreaming: false, safetyAlert: null });
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

    await runSSE(`/interview/${sessionId}/respond`, { message }, {
      detectConnectionError: true,
      buildPrevTurns: (turns) => turns,
    });
  },

  skipTurn: (sessionId: string) =>
    runSSE(`/interview/${sessionId}/skip`, {}, {
      buildPrevTurns: (turns) =>
        turns.length > 0 && !turns[turns.length - 1].user_response
          ? [...turns.slice(0, -1), { ...turns[turns.length - 1], user_response: '', skipped: true }]
          : turns,
    }),

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
    set({ loading: true, error: null, errorCode: null, shouldEnd: false, streamingText: '', isStreaming: false, safetyAlert: null });
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

  cancelStream: () => {
    const { abortController } = get();
    abortController?.abort();
    set({ isStreaming: false, streamingText: '', abortController: null });
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
