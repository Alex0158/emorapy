import type { AIStreamDraftStatus } from '@/utils/aiStreamState';
import type { InterviewSession, InterviewTurn } from '@/types/interview';
import { t } from '@/utils/i18n';

export interface InterviewErrorInfo {
  message: string;
  code: string | null;
  status: number | null;
}

export type SafetyAlertSeverity = 'info' | 'warning' | 'critical';

function getInterviewErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) return message;
  }
  return t('common.unknownError');
}

function getLocalizedMessageFallback(message: string, fallbackKey: string): string {
  const trimmed = message.trim();
  if (!trimmed) return t(fallbackKey);
  if (/^Invalid .+ response from server$/.test(trimmed)) {
    return t('apiError.invalidResponse');
  }
  return message;
}

export function extractInterviewErrorInfo(err: unknown): InterviewErrorInfo {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; status?: number };
    return {
      message: getInterviewErrorMessage(err),
      code: e.code || null,
      status: e.status ?? null,
    };
  }
  return { message: String(err), code: null, status: null };
}

export function getInterviewStreamFailureMessage(
  error: { message?: string },
  fallbackKey = 'interview.respondFail'
): string {
  return getLocalizedMessageFallback(error.message ?? '', fallbackKey);
}

export function getStreamingStartState() {
  return {
    isStreaming: true,
    streamingText: '',
    streamingStatus: 'thinking' as AIStreamDraftStatus,
    error: null,
    errorCode: null,
    safetyAlert: null,
    abortController: null,
  };
}

export function getStreamingIdleState() {
  return {
    isStreaming: false,
    streamingText: '',
    streamingStatus: null,
  };
}

export function getStreamingIdleWithAbortState() {
  return {
    ...getStreamingIdleState(),
    abortController: null,
  };
}

export function shouldRecoverStreamingFromCanonical(
  isStreaming: boolean,
  localTurns: InterviewTurn[],
  canonicalSession: InterviewSession,
): boolean {
  if (!isStreaming) return false;
  if (canonicalSession.status !== 'in_progress') return true;

  const canonicalTurns = canonicalSession.turns || [];
  return canonicalTurns.length > localTurns.length;
}

export function normalizeSafetyAlertSeverity(severity?: string): SafetyAlertSeverity {
  return severity === 'warning' || severity === 'critical' ? severity : 'info';
}
