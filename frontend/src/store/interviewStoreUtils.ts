import type { AIStreamDraftStatus } from '@/utils/aiStreamState';
import type { InterviewSession, InterviewTurn } from '@/types/interview';
import { getErrorMessage as getApiErrorMessage } from '@/utils/apiError';

export interface InterviewErrorInfo {
  message: string;
  code: string | null;
  status: number | null;
}

export type SafetyAlertSeverity = 'info' | 'warning' | 'critical';

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function getNormalizedCode(err: ErrorLike): string | undefined {
  if (typeof err.code === 'string' && err.code.trim().length > 0) {
    return err.code.trim();
  }
  return typeof err.status === 'number' ? `HTTP_${err.status}` : undefined;
}

function getErrorInputForVisibleMessage(err: unknown): unknown {
  if (typeof err === 'string') {
    return { message: err };
  }
  if (err && typeof err === 'object') {
    const errorLike = err as ErrorLike;
    return {
      ...(err as Record<string, unknown>),
      code: getNormalizedCode(errorLike),
    };
  }
  return err;
}

function getInterviewErrorMessage(err: unknown, fallbackKey: string): string {
  return getApiErrorMessage(getErrorInputForVisibleMessage(err), fallbackKey);
}

export function extractInterviewErrorInfo(
  err: unknown,
  fallbackKey = 'common.unknownError'
): InterviewErrorInfo {
  if (err && typeof err === 'object') {
    const e = err as { code?: string; status?: number };
    return {
      message: getInterviewErrorMessage(err, fallbackKey),
      code: e.code || null,
      status: e.status ?? null,
    };
  }
  return { message: getInterviewErrorMessage(err, fallbackKey), code: null, status: null };
}

export function getInterviewStreamFailureMessage(
  error: { code?: string; message?: string; status?: number },
  fallbackKey = 'interview.respondFail'
): string {
  return getInterviewErrorMessage(error, fallbackKey);
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
