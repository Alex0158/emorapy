import axios from 'axios';
import {
  createHttpClient,
  isApiResponseEnvelope,
  readApiResponseError,
  statusToRequestCode,
  toRequestError,
  wrapSuccessfulApiResponse,
} from '@cj/api-client';
import { env } from '@/config/env';
import type { ApiResponse } from '@/types/common';
import { getLocale, t } from '@/utils/i18n';

const request = createHttpClient({
  baseURL: env.apiBaseURL,
});

request.interceptors.request.use((config) => {
  config.headers.set('X-Locale', getLocale());
  return config;
});

function getLocalizedStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return t('adminApi.error.badRequest');
    case 401:
      return t('adminApi.error.unauthorized');
    case 403:
      return t('adminApi.error.forbidden');
    case 404:
      return t('adminApi.error.notFound');
    case 409:
      return t('adminApi.error.conflict');
    case 422:
      return t('adminApi.error.validation');
    case 429:
      return t('adminApi.error.rateLimit');
    case 500:
      return t('adminApi.error.server');
    case 503:
      return t('adminApi.error.unavailable');
    default:
      return t('adminApi.error.requestFailed');
  }
}

request.interceptors.response.use(
  (response) => {
    const { data } = response;
    if (isApiResponseEnvelope(data)) {
      if (data.success) return response;
      const err = readApiResponseError(data);
      return Promise.reject(
        toRequestError(
          err.code || 'API_ERROR',
          err.message || t('adminApi.error.requestFailed'),
          err.details
        )
      );
    }
    return {
      ...response,
      data: wrapSuccessfulApiResponse(data) as ApiResponse<unknown>,
    };
  },
  (error) => {
    if (
      axios.isCancel(error) ||
      error.code === 'ERR_CANCELED' ||
      error.name === 'AbortError'
    ) {
      return Promise.reject(
        toRequestError('REQUEST_CANCELED', t('adminApi.error.requestCanceled'))
      );
    }

    if (error.response) {
      const status = error.response.status;
      const apiError = readApiResponseError(error.response.data);
      return Promise.reject(
        toRequestError(
          apiError.code || statusToRequestCode(status),
          apiError.message || getLocalizedStatusMessage(status),
          apiError.details
        )
      );
    }

    if (error.request) {
      return Promise.reject(
        toRequestError('NETWORK_ERROR', t('adminApi.error.network'))
      );
    }

    return Promise.reject(
      toRequestError('UNKNOWN_ERROR', t('adminApi.error.unknown'))
    );
  }
);

export default request;
