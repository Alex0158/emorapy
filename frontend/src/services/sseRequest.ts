import { env } from '@/config/env';
import { t, getLocale } from '@/utils/i18n';
import {
  getSseResponseBodyMissingMessage,
  getStreamHttpFallbackMessage,
} from './streamErrorMessages';

export class SSEError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'SSEError';
    this.status = status;
    this.code = code;
  }
}

export interface SSECallbacks {
  onToken?: (text: string) => void;
  onMetadata?: (data: Record<string, unknown>) => void;
  onSafetyAlert?: (data: Record<string, unknown>) => void;
  onComplete?: (data: Record<string, unknown>) => void;
  onError?: (data: { code?: string; message?: string }) => void;
}

const TOKEN_TIMEOUT_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 60_000;

export async function sseRequest(
  url: string,
  body: Record<string, unknown>,
  callbacks: SSECallbacks,
  signal?: AbortSignal
): Promise<void> {
  let token: string | null = null;
  try { token = localStorage.getItem('token') || sessionStorage.getItem('token'); } catch { /* noop */ }
  const locale = getLocale();

  const response = await fetch(`${env.apiBaseURL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Locale': locale,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const err = errorBody as { error?: { code?: string; message?: string } };
    throw new SSEError(
      err?.error?.message || getStreamHttpFallbackMessage(response.status),
      response.status,
      err?.error?.code,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error(getSseResponseBodyMissingMessage());

  if (signal) {
    signal.addEventListener('abort', () => reader.cancel(), { once: true });
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let lastEventTime = Date.now();
  let tokenReceived = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearTimeouts = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  const checkTimeout = () => {
    if (signal?.aborted) return;
    const now = Date.now();
    const elapsed = now - lastEventTime;

    if (!tokenReceived && elapsed >= TOKEN_TIMEOUT_MS) {
      clearTimeouts();
      callbacks.onError?.({ code: 'RESPONSE_TIMEOUT', message: t('interview.error.responseTimeout') });
      reader.cancel();
      return;
    }

    if (elapsed >= CONNECTION_TIMEOUT_MS) {
      clearTimeouts();
      callbacks.onError?.({ code: 'CONNECTION_TIMEOUT', message: t('interview.error.connectionTimeout') });
      reader.cancel();
      return;
    }

    timeoutId = setTimeout(checkTimeout, 5000);
  };

  timeoutId = setTimeout(checkTimeout, 5000);

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      lastEventTime = Date.now();
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);
          if (currentEvent && currentData) {
            try {
              const parsed = JSON.parse(currentData);
              switch (currentEvent) {
                case 'token':
                  tokenReceived = true;
                  callbacks.onToken?.(parsed.text);
                  break;
                case 'metadata':
                  callbacks.onMetadata?.(parsed);
                  break;
                case 'safety_alert':
                  callbacks.onSafetyAlert?.(parsed);
                  break;
                case 'complete':
                  callbacks.onComplete?.(parsed);
                  break;
                case 'error':
                  callbacks.onError?.(parsed);
                  break;
              }
            } catch {
              // ignore parse errors
            }
            currentEvent = '';
            currentData = '';
          }
        } else if (line === '') {
          currentEvent = '';
          currentData = '';
        }
      }
    }
  } finally {
    clearTimeouts();
  }
}
