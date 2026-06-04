import { t } from '@/src/i18n';

export function getLocalizedStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return t('appApi.error.badRequest');
    case 401:
      return t('appApi.error.unauthorized');
    case 403:
      return t('appApi.error.forbidden');
    case 404:
      return t('appApi.error.notFound');
    case 409:
      return t('appApi.error.conflict');
    case 422:
      return t('appApi.error.validation');
    case 429:
      return t('appApi.error.rateLimit');
    case 500:
      return t('appApi.error.server');
    case 503:
      return t('appApi.error.unavailable');
    default:
      return t('appApi.error.requestFailed');
  }
}

function getStatusFromRequestCode(code: string): number | null {
  const httpStatusMatch = /^HTTP_(\d+)$/.exec(code);
  if (httpStatusMatch) return Number(httpStatusMatch[1]);

  switch (code) {
    case 'BAD_REQUEST':
    case 'INVALID_INPUT':
    case 'INVALID_CODE':
    case 'INVALID_FILE_TYPE':
    case 'INVALID_SESSION_ID':
    case 'SESSION_ID_REQUIRED':
    case 'WEAK_PASSWORD':
      return 400;
    case 'AUTH_REQUIRED':
    case 'INVALID_AUTH_TOKEN':
    case 'TOKEN_EXPIRED':
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'ALREADY_PAIRED':
    case 'CASE_NOT_EDITABLE':
    case 'CONFLICT':
      return 409;
    case 'VALIDATION_ERROR':
      return 422;
    case 'RATE_LIMIT':
    case 'RATE_LIMIT_EXCEEDED':
      return 429;
    case 'DATABASE_ERROR':
    case 'SERVER_ERROR':
      return 500;
    case 'EXTERNAL_SERVICE_ERROR':
    case 'SERVICE_UNAVAILABLE':
      return 503;
    default:
      return code.endsWith('_NOT_FOUND') ? 404 : null;
  }
}

export function getLocalizedRequestCodeMessage(code?: string | null): string | null {
  if (!code) return null;
  if (code === 'NETWORK_ERROR') return getLocalizedNetworkMessage();
  if (code === 'STREAM_DISCONNECTED') return getLocalizedStreamDisconnectedMessage();
  if (code === 'EMPTY_RESPONSE' || code === 'INVALID_RESPONSE') {
    return getLocalizedInvalidResponseMessage();
  }
  if (code.startsWith('INVALID_') && code.endsWith('_RESPONSE')) {
    return getLocalizedInvalidResponseMessage();
  }
  if (code === 'API_ERROR') return t('appApi.error.requestFailed');

  const status = getStatusFromRequestCode(code);
  return status ? getLocalizedStatusMessage(status) : null;
}

export function getLocalizedNetworkMessage(): string {
  return t('appApi.error.network');
}

export function getLocalizedUnknownMessage(): string {
  return t('appApi.error.unknown');
}

export function getLocalizedInvalidResponseMessage(): string {
  return t('appApi.error.invalidResponse');
}

export function getLocalizedStreamDisconnectedMessage(): string {
  return t('appStream.error.disconnected');
}
