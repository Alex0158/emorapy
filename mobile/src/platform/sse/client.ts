import { fetchEventSource, type EventSourceMessage } from '@microsoft/fetch-event-source';
import {
  readApiResponseError,
  statusToRequestCode,
  statusToRequestMessage,
  toRequestError,
} from '@cj/api-client';

import { getRuntimeConfig } from '@/src/config/runtime';
import { getLocale } from '@/src/i18n';
import { sessionStorage, tokenStorage } from '@/src/platform/storage/secureStore';

export interface AppSSEOptions {
  path: string;
  afterSeq?: number;
  signal?: AbortSignal;
  onOpen?: () => void;
  onMessage: (message: EventSourceMessage) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

function appendAfterSeq(url: string, afterSeq?: number): string {
  if (typeof afterSeq !== 'number') return url;
  const delimiter = url.includes('?') ? '&' : '?';
  return `${url}${delimiter}after_seq=${encodeURIComponent(String(afterSeq))}`;
}

async function readStreamOpenError(response: Response): Promise<unknown> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const bodyError = readApiResponseError(body);
  return toRequestError(
    bodyError.code ?? statusToRequestCode(response.status),
    bodyError.message ?? statusToRequestMessage(response.status),
    bodyError.details
  );
}

export async function connectAppSSE(options: AppSSEOptions): Promise<void> {
  const runtime = getRuntimeConfig();
  const [token, sessionId] = await Promise.all([
    tokenStorage.getToken(),
    sessionStorage.getSessionId(),
  ]);
  const url = appendAfterSeq(`${runtime.apiBaseUrl}${options.path}`, options.afterSeq);

  await fetchEventSource(url, {
    signal: options.signal,
    headers: {
      Accept: 'text/event-stream',
      'X-Locale': getLocale(),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    onopen: async (response) => {
      if (!response.ok) {
        throw await readStreamOpenError(response);
      }
      options.onOpen?.();
    },
    onmessage: options.onMessage,
    onerror: (error) => {
      options.onError?.(error);
      throw error;
    },
    onclose: options.onClose,
  });
}
