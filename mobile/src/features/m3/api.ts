import {
  chatRoomPath,
  createM3ApiClient,
  type ChatStreamEvent,
} from '@emorapy/api-client';
import type { AIStreamEvent, AIStreamSnapshot } from '@emorapy/contracts/ai-stream';

import { appApiClient } from '@/src/platform/api/client';
import { connectAIStream } from '@/src/platform/sse/aiStream';
import { connectAppSSE } from '@/src/platform/sse/client';

export const m3Api = createM3ApiClient(appApiClient.instance);

export function normalizeM3Error(error: unknown): { code: string; message: string } {
  const normalized = appApiClient.normalizeError(error);
  return {
    code: normalized.code,
    message: normalized.message,
  };
}

export interface ChatRoomStreamCallbacks {
  onReady?: (event: { roomId: string }) => void;
  onEvent?: (event: ChatStreamEvent) => void;
  onError?: (error: unknown) => void;
}

export interface ChatAIStreamReadyEvent {
  scopeType: 'chat_room';
  scopeId: string;
  snapshots?: AIStreamSnapshot[];
}

export interface ChatAIStreamCallbacks {
  onReady?: (event: ChatAIStreamReadyEvent) => void;
  onEvent?: (event: AIStreamEvent) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

export async function connectChatRoomStream(
  roomId: string,
  callbacks: ChatRoomStreamCallbacks,
  options: { signal?: AbortSignal } = {}
): Promise<void> {
  await connectAppSSE({
    path: chatRoomPath(roomId, '/stream'),
    signal: options.signal,
    onMessage: (message) => {
      if (!message.data) return;
      try {
        const parsed = JSON.parse(message.data) as ChatStreamEvent | { roomId: string };
        if (message.event === 'ready') {
          callbacks.onReady?.(parsed as { roomId: string });
          return;
        }
        if (message.event === 'ping') {
          return;
        }
        callbacks.onEvent?.({
          ...(parsed as ChatStreamEvent),
          type: (message.event || (parsed as ChatStreamEvent).type) as ChatStreamEvent['type'],
        });
      } catch (error) {
        callbacks.onError?.(error);
      }
    },
    onError: callbacks.onError,
  });
}

export async function connectChatAIStream(
  roomId: string,
  callbacks: ChatAIStreamCallbacks,
  options?: { afterSeq?: number; signal?: AbortSignal }
): Promise<void> {
  await connectAIStream('chat_room', roomId, {
    onReady: (event) => callbacks.onReady?.(event as ChatAIStreamReadyEvent),
    onEvent: callbacks.onEvent,
    onError: callbacks.onError,
    onClose: callbacks.onClose,
  }, options);
}
