import { env } from '@/config/env';
import { getLocale } from '@/utils/i18n';
import { sessionStorage } from '@/utils/storage';
import {
  getStreamBodyMissingMessage,
  getStreamDisconnectedMessage,
  getStreamHttpFallbackMessage,
} from './streamErrorMessages';
import type { AIStreamEvent, AIStreamScopeType, AIStreamSnapshot } from '@/types/aiStream';

export interface AIStreamReadyEvent {
  scopeType: AIStreamScopeType;
  scopeId: string;
  snapshots?: AIStreamSnapshot[];
}

export interface AIStreamCallbacks {
  onEvent?: (event: AIStreamEvent) => void;
  onReady?: (event: AIStreamReadyEvent) => void;
  onError?: (error: { code: string; message: string; status?: number }) => void;
  onClose?: () => void;
}

export const connectAIStream = async (
  scopeType: AIStreamScopeType,
  scopeId: string,
  callbacks: AIStreamCallbacks,
  options?: { afterSeq?: number }
): Promise<() => void> => {
  const controller = new AbortController();
  let token: string | null = null;
  try {
    token = localStorage.getItem('token') || globalThis.sessionStorage?.getItem('token') || null;
  } catch {
    token = null;
  }

  const sessionId = sessionStorage.get();
  const url = new URL(`${env.apiBaseURL}/streams/${encodeURIComponent(scopeType)}/${encodeURIComponent(scopeId)}`);
  if (options?.afterSeq && options.afterSeq > 0) {
    url.searchParams.set('after_seq', String(options.afterSeq));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      'X-Locale': getLocale(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
    },
    signal: controller.signal,
  });

  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    let message = getStreamHttpFallbackMessage(response.status);
    try {
      const body = await response.json() as { error?: { code?: string; message?: string } };
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.message) message = body.error.message;
    } catch {
      // ignore body parsing
    }
    callbacks.onError?.({ code, message, status: response.status });
    return () => controller.abort();
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.({ code: 'STREAM_BODY_MISSING', message: getStreamBodyMissingMessage() });
    return () => controller.abort();
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const run = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (!controller.signal.aborted) {
            callbacks.onClose?.();
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        chunks.forEach((chunk) => {
          const lines = chunk.split('\n');
          const eventLine = lines.find((line) => line.startsWith('event:'));
          const dataLine = lines.find((line) => line.startsWith('data:'));
          if (!eventLine || !dataLine) return;
          const eventName = eventLine.replace(/^event:\s*/, '').trim();
          const raw = dataLine.replace(/^data:\s*/, '');
          if (eventName === 'ping') return;
          try {
            const parsed = JSON.parse(raw) as AIStreamEvent | AIStreamReadyEvent;
            if (eventName === 'ready') {
              callbacks.onReady?.(parsed as AIStreamReadyEvent);
              return;
            }
            callbacks.onEvent?.(parsed as AIStreamEvent);
          } catch {
            // ignore malformed event payload
          }
        });
      }
    } catch {
      if (!controller.signal.aborted) {
        callbacks.onError?.({ code: 'STREAM_DISCONNECTED', message: getStreamDisconnectedMessage() });
      }
    }
  };

  void run();
  return () => controller.abort();
};
