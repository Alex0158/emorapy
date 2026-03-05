import axios, { type AxiosError, type AxiosInstance, type AxiosResponse } from 'axios';
import { env } from '@/config/env';
import type { ApiResponse, RequestError } from '@/types/common';

function toRequestError(
  code: string,
  message: string,
  details?: unknown
): RequestError {
  return { code, message, details };
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMIT';
    case 500:
      return 'SERVER_ERROR';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return `HTTP_${status}`;
  }
}

function statusToMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not found';
    case 409:
      return 'Conflict';
    case 422:
      return 'Validation failed';
    case 429:
      return 'Too many requests';
    case 500:
      return 'Internal server error';
    case 503:
      return 'Service unavailable';
    default:
      return 'Request failed';
  }
}

function readApiError(data: unknown): {
  code?: string;
  message?: string;
  details?: unknown;
} {
  if (!data || typeof data !== 'object') return {};
  const body = data as ApiResponse<unknown>;
  if (body.error && typeof body.error === 'object') {
    return {
      code: body.error.code,
      message: body.error.message || body.message,
      details: body.error.details,
    };
  }
  return {
    code: undefined,
    message: body.message,
    details: undefined,
  };
}

const request: AxiosInstance = axios.create({
  baseURL: env.apiBaseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    const { data } = response;
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success) return response;
      const err = readApiError(data);
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
      data: {
        success: true,
        data,
      },
    };
  },
  (error: AxiosError) => {
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
      const apiError = readApiError(error.response.data);
      return Promise.reject(
        toRequestError(
          apiError.code || statusToCode(status),
          apiError.message || statusToMessage(status),
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
