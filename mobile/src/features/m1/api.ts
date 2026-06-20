import type { AIStreamEvent, AIStreamSnapshot } from '@emorapy/contracts/ai-stream';
import { createM1ApiClient, type RequestErrorLike } from '@emorapy/api-client';

import { appApiClient } from '@/src/platform/api/client';
import { connectAppSSE } from '@/src/platform/sse/client';

export const m1Api = createM1ApiClient(appApiClient.instance);

export function normalizeM1Error(error: unknown): RequestErrorLike {
  return appApiClient.normalizeError(error);
}

export interface QuickJudgmentStreamReadyEvent {
  scopeType: 'case_judgment';
  scopeId: string;
  snapshots?: AIStreamSnapshot[];
}

export interface QuickJudgmentStreamCallbacks {
  onReady?: (event: QuickJudgmentStreamReadyEvent) => void;
  onEvent?: (event: AIStreamEvent) => void;
  onError?: (error: unknown) => void;
}

export async function connectQuickJudgmentStream(
  caseId: string,
  callbacks: QuickJudgmentStreamCallbacks,
  options?: { afterSeq?: number; signal?: AbortSignal }
): Promise<void> {
  await connectAppSSE({
    path: `/streams/case_judgment/${encodeURIComponent(caseId)}`,
    afterSeq: options?.afterSeq,
    signal: options?.signal,
    onMessage: (message) => {
      if (!message.data) return;
      try {
        const parsed = JSON.parse(message.data) as AIStreamEvent | QuickJudgmentStreamReadyEvent;
        if (message.event === 'ready') {
          callbacks.onReady?.(parsed as QuickJudgmentStreamReadyEvent);
          return;
        }
        callbacks.onEvent?.(parsed as AIStreamEvent);
      } catch (error) {
        callbacks.onError?.(error);
      }
    },
    onError: callbacks.onError,
  });
}
