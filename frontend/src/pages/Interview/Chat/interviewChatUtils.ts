import type { AIStreamDraft } from '@/utils/aiStreamState';

export const CANONICAL_SYNC_INTERVAL_MS = 2500;
export const CANONICAL_SYNC_MAX_ATTEMPTS = 24;

const INTERVIEW_ERROR_MESSAGE_KEYS: Record<string, string> = {
  CONSENT_REQUIRED: 'interview.error.consentRequired',
  MAX_TURNS_REACHED: 'interview.error.maxTurns',
  SESSION_COMPLETED: 'interview.error.sessionCompleted',
  RATE_LIMIT_EXCEEDED: 'interview.error.rateLimit',
  NOT_FOUND: 'interview.error.notFound',
  RESPONSE_TIMEOUT: 'interview.error.timeout',
  CONNECTION_TIMEOUT: 'interview.error.connectionTimeout',
  CONNECTION_LOST: 'interview.error.connectionLost',
  TURN_TOO_FAST: 'interview.error.turnTooFast',
  AI_CALL_FAILED: 'interview.error.aiCallFailed',
  CONCURRENT_REQUEST: 'interview.error.concurrentRequest',
  NETWORK_ERROR: 'common.networkError',
};

const TERMINAL_STREAM_ERROR_CODES = new Set(['INVALID_SESSION_ID', 'SESSION_EXPIRED', 'FORBIDDEN', 'NOT_FOUND']);
const TERMINAL_INTERVIEW_ERROR_CODES = new Set(['MAX_TURNS_REACHED', 'SESSION_COMPLETED']);
const RATE_LIMIT_HINT_ERROR_CODES = new Set(['RATE_LIMIT_EXCEEDED', 'TURN_TOO_FAST']);
const ERROR_CODES_WITH_PRIMARY_ACTION = new Set([
  'NOT_FOUND',
  'CONSENT_REQUIRED',
  'RATE_LIMIT_EXCEEDED',
  'TURN_TOO_FAST',
  'MAX_TURNS_REACHED',
  'SESSION_COMPLETED',
  'AI_CALL_FAILED',
  'CONCURRENT_REQUEST',
  'CONNECTION_LOST',
]);

export function isTerminalInterviewStreamError(error: { code?: string; status?: number }): boolean {
  if (error.status && (error.status >= 500 || [400, 401, 403, 404].includes(error.status))) {
    return true;
  }
  return error.code ? TERMINAL_STREAM_ERROR_CODES.has(error.code) : false;
}

export function resolveInterviewErrorMessage(
  errMsg: string,
  code: string | null,
  translate: (key: string) => string
): string {
  return code && INTERVIEW_ERROR_MESSAGE_KEYS[code] ? translate(INTERVIEW_ERROR_MESSAGE_KEYS[code]) : errMsg;
}

export function isTerminalInterviewErrorCode(code: string | null): boolean {
  return code ? TERMINAL_INTERVIEW_ERROR_CODES.has(code) : false;
}

export function shouldShowRateLimitHint(code: string | null): boolean {
  return code ? RATE_LIMIT_HINT_ERROR_CODES.has(code) : false;
}

export function shouldShowFallbackReloadButton(code: string | null): boolean {
  return !code || !ERROR_CODES_WITH_PRIMARY_ACTION.has(code);
}

export function getVisibleInterviewDraft(
  mirroredDraft: AIStreamDraft | null,
  streamingDraft: AIStreamDraft | null
): AIStreamDraft | null {
  if (mirroredDraft?.status === 'cancelled') return null;
  return mirroredDraft ?? streamingDraft;
}
