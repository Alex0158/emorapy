import { t } from '@/src/i18n';
import {
  getLocalizedInvalidResponseMessage,
  getLocalizedNetworkMessage,
  getLocalizedStatusMessage,
  getLocalizedStreamDisconnectedMessage,
} from '@/src/platform/api/errorMessages';

export interface StreamErrorDisplayLike {
  code?: string | null;
  message?: string | null;
  status?: number | null;
}

function getStatusFromStreamError(error: StreamErrorDisplayLike): number | null {
  if (typeof error.status === 'number') return error.status;
  const match = typeof error.code === 'string' ? /^HTTP_(\d+)$/.exec(error.code) : null;
  return match ? Number(match[1]) : null;
}

function getStatusFromStreamErrorCode(code?: string | null): number | null {
  switch (code) {
    case 'AUTH_REQUIRED':
    case 'INVALID_AUTH_TOKEN':
    case 'TOKEN_EXPIRED':
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'CASE_NOT_FOUND':
    case 'CHAT_ROOM_NOT_FOUND':
    case 'INTERVIEW_SESSION_NOT_FOUND':
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'VALIDATION_ERROR':
      return 422;
    case 'RATE_LIMIT_EXCEEDED':
      return 429;
    case 'SERVER_ERROR':
      return 500;
    case 'SERVICE_UNAVAILABLE':
      return 503;
    default:
      return null;
  }
}

export function formatAIStreamDisplayError(
  error?: StreamErrorDisplayLike | null,
  fallbackKey = 'appStream.error.failed'
): string | null {
  if (!error) return null;
  const status = getStatusFromStreamError(error) ?? getStatusFromStreamErrorCode(error.code);
  if (status) return getLocalizedStatusMessage(status);

  if (typeof error.code === 'string') {
    if (error.code === 'NETWORK_ERROR') return getLocalizedNetworkMessage();
    if (error.code === 'STREAM_DISCONNECTED') return getLocalizedStreamDisconnectedMessage();
    if (error.code.startsWith('INVALID_')) return getLocalizedInvalidResponseMessage();
  }

  return t(fallbackKey);
}
