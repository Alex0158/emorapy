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

export function getLocalizedNetworkMessage(): string {
  return t('appApi.error.network');
}

export function getLocalizedUnknownMessage(): string {
  return t('appApi.error.unknown');
}
