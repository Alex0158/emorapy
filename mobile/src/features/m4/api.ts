import type { AIStreamEvent, AIStreamSnapshot } from '@emorapy/contracts/ai-stream';
import { createM4ApiClient } from '@emorapy/api-client';

import { appApiClient } from '@/src/platform/api/client';
import { connectAIStream } from '@/src/platform/sse/aiStream';

export const m4Api = createM4ApiClient(appApiClient.instance);

export function normalizeM4Error(error: unknown): { code: string; message: string } {
  const normalized = appApiClient.normalizeError(error);
  return {
    code: normalized.code,
    message: normalized.message,
  };
}

export interface RepairTrackStreamReadyEvent {
  scopeType: 'repair_track';
  scopeId: string;
  snapshots?: AIStreamSnapshot[];
}

export interface RepairTrackStreamCallbacks {
  onReady?: (event: RepairTrackStreamReadyEvent) => void;
  onEvent?: (event: AIStreamEvent) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

export async function connectRepairTrackStream(
  trackId: string,
  callbacks: RepairTrackStreamCallbacks,
  options?: { afterSeq?: number; signal?: AbortSignal }
): Promise<void> {
  await connectAIStream('repair_track', trackId, {
    onReady: (event) => callbacks.onReady?.(event as RepairTrackStreamReadyEvent),
    onEvent: callbacks.onEvent,
    onError: callbacks.onError,
    onClose: callbacks.onClose,
  }, options);
}
