import type { AIStreamEvent, AIStreamScopeType } from '@cj/contracts/ai-stream';

import { connectAppSSE } from '@/src/platform/sse/client';
import type { AIStreamCallbacks, AIStreamReadyEvent } from '@/src/platform/sse/aiStreamState';

export * from '@/src/platform/sse/aiStreamState';

export async function connectAIStream(
  scopeType: AIStreamScopeType,
  scopeId: string,
  callbacks: AIStreamCallbacks,
  options?: { afterSeq?: number; signal?: AbortSignal }
): Promise<void> {
  await connectAppSSE({
    path: `/streams/${encodeURIComponent(scopeType)}/${encodeURIComponent(scopeId)}`,
    afterSeq: options?.afterSeq,
    signal: options?.signal,
    onMessage: (message) => {
      if (!message.data || message.event === 'ping') return;
      try {
        const parsed = JSON.parse(message.data) as AIStreamEvent | AIStreamReadyEvent;
        if (message.event === 'ready') {
          callbacks.onReady?.(parsed as AIStreamReadyEvent);
          return;
        }
        callbacks.onEvent?.(parsed as AIStreamEvent);
      } catch (error) {
        callbacks.onError?.(error);
      }
    },
    onError: callbacks.onError,
    onClose: callbacks.onClose,
  });
}
