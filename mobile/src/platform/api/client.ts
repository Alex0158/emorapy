import axios, { AxiosHeaders, type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import {
  readApiResponseError,
  statusToRequestCode,
  toRequestError,
  type RequestContext,
  type RequestErrorLike,
} from '@cj/api-client';

import { getRuntimeConfig } from '@/src/config/runtime';
import { getLocale } from '@/src/i18n';
import {
  getLocalizedInvalidResponseMessage,
  getLocalizedNetworkMessage,
  getLocalizedStatusMessage,
  getLocalizedStreamDisconnectedMessage,
  getLocalizedUnknownMessage,
} from '@/src/platform/api/errorMessages';
import { sessionStorage, tokenStorage } from '@/src/platform/storage/secureStore';

export interface AppApiClient {
  instance: AxiosInstance;
  getContext(): Promise<RequestContext>;
  normalizeError(error: unknown): RequestErrorLike;
}

function createRequestId(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureHeaders(config: InternalAxiosRequestConfig): AxiosHeaders {
  if (config.headers instanceof AxiosHeaders) {
    return config.headers;
  }
  config.headers = new AxiosHeaders(config.headers);
  return config.headers;
}

function isFormDataPayload(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function isRequestErrorLike(error: unknown): error is RequestErrorLike {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      typeof (error as { message?: unknown }).message === 'string'
  );
}

function isSharedClientInvalidResponseError(error: RequestErrorLike): boolean {
  return error.code.startsWith('INVALID_') && isSharedClientInvalidResponseMessage(error.message);
}

function isSharedClientInvalidResponseMessage(message: string): boolean {
  return /^Invalid .+ from server$/.test(message);
}

export function createAppApiClient(): AppApiClient {
  const runtime = getRuntimeConfig();
  const instance = axios.create({
    baseURL: runtime.apiBaseUrl,
    timeout: runtime.requestTimeoutMs,
  });

  async function getContext(): Promise<RequestContext> {
    const [token, sessionId] = await Promise.all([
      tokenStorage.getToken(),
      sessionStorage.getSessionId(),
    ]);
    return {
      requestId: createRequestId(),
      locale: getLocale(),
      sessionId,
      token,
    };
  }

  instance.interceptors.request.use(async (config) => {
    const context = await getContext();
    const headers = ensureHeaders(config);
    headers.set('X-Request-Id', context.requestId);
    headers.set('X-Locale', context.locale ?? getLocale());
    if (context.sessionId) headers.set('X-Session-Id', context.sessionId);
    if (context.token) headers.set('Authorization', `Bearer ${context.token}`);
    if (isFormDataPayload(config.data)) {
      headers.set('Content-Type', 'multipart/form-data');
    } else if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return config;
  });

  function normalizeError(error: unknown): RequestErrorLike {
    if (isRequestErrorLike(error)) {
      if (isSharedClientInvalidResponseError(error)) {
        return toRequestError(error.code, getLocalizedInvalidResponseMessage(), error.details);
      }
      return error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const bodyError = readApiResponseError(axiosError.response?.data);
      return toRequestError(
        bodyError.code ?? (status ? statusToRequestCode(status) : 'NETWORK_ERROR'),
        bodyError.message ?? (status ? getLocalizedStatusMessage(status) : getLocalizedNetworkMessage()),
        bodyError.details
      );
    }

    if (error instanceof Error) {
      if (isSharedClientInvalidResponseMessage(error.message) || error instanceof SyntaxError) {
        return toRequestError('INVALID_RESPONSE', getLocalizedInvalidResponseMessage());
      }
      if (error.message === 'SSE stream disconnected') {
        return toRequestError('STREAM_DISCONNECTED', getLocalizedStreamDisconnectedMessage());
      }
      return toRequestError('APP_ERROR', error.message);
    }

    return toRequestError('UNKNOWN_ERROR', getLocalizedUnknownMessage(), error);
  }

  return { instance, getContext, normalizeError };
}

export const appApiClient = createAppApiClient();
