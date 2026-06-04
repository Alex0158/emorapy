import axios from 'axios';
import {
  createHttpClient,
  isApiResponseEnvelope,
  readApiResponseError,
  statusToRequestCode,
  statusToRequestMessage,
  toRequestError,
  wrapSuccessfulApiResponse,
} from '@cj/api-client';
import { env } from '@/config/env';
import type { ApiResponse } from '@/types/common';
import { getLocale } from '@/utils/i18n';

const request = createHttpClient({
  baseURL: env.apiBaseURL,
});

request.interceptors.request.use((config) => {
  config.headers.set('X-Locale', getLocale());
  return config;
});

request.interceptors.response.use(
  (response) => {
    const { data } = response;
    if (isApiResponseEnvelope(data)) {
      if (data.success) return response;
      const err = readApiResponseError(data);
      return Promise.reject(
        toRequestError(
          err.code || 'API_ERROR',
          err.message || 'Request failed',
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
        toRequestError('REQUEST_CANCELED', 'Request canceled')
      );
    }

    if (error.response) {
      const status = error.response.status;
      const apiError = readApiResponseError(error.response.data);
      return Promise.reject(
        toRequestError(
          apiError.code || statusToRequestCode(status),
          apiError.message || statusToRequestMessage(status),
          apiError.details
        )
      );
    }

    if (error.request) {
      return Promise.reject(
        toRequestError('NETWORK_ERROR', 'Network error')
      );
    }

    return Promise.reject(
      toRequestError('UNKNOWN_ERROR', error.message || 'Unknown error')
    );
  }
);

export default request;
