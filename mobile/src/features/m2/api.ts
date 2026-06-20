import type { AIStreamEvent, AIStreamSnapshot } from '@emorapy/contracts/ai-stream';
import { createM2ApiClient } from '@emorapy/api-client';

import { appApiClient } from '@/src/platform/api/client';
import { connectAIStream } from '@/src/platform/sse/aiStream';

export const m2Api = createM2ApiClient(appApiClient.instance);

export function normalizeM2Error(error: unknown): { code: string; message: string } {
  const normalized = appApiClient.normalizeError(error);
  return {
    code: normalized.code,
    message: normalized.message,
  };
}

export interface AIStreamReadyEvent {
  scopeType: 'interview_session';
  scopeId: string;
  snapshots?: AIStreamSnapshot[];
}

export interface InterviewStreamCallbacks {
  onReady?: (event: AIStreamReadyEvent) => void;
  onEvent?: (event: AIStreamEvent) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

export async function connectInterviewStream(
  sessionId: string,
  callbacks: InterviewStreamCallbacks,
  options?: { afterSeq?: number; signal?: AbortSignal }
): Promise<void> {
  await connectAIStream('interview_session', sessionId, {
    onReady: (event) => callbacks.onReady?.(event as AIStreamReadyEvent),
    onEvent: callbacks.onEvent,
    onError: callbacks.onError,
    onClose: callbacks.onClose,
  }, options);
}
