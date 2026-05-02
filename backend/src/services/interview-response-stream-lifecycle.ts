import type { SSETokenEvent } from '../types/interview.types';
import type { AIStreamHandle } from './ai-stream.service';
import { aiStreamService } from './ai-stream.service';
import { settleInterviewResponseCancellation } from './interview-response-settlement';
import {
  buildInterviewStreamDeltaPayload,
  buildInterviewStreamStartPayload,
  type InterviewStreamMode,
} from './interview-stream-payload-utils';

export interface StartInterviewResponseStreamLifecycleParams {
  sessionId: string;
  streamMode: InterviewStreamMode;
  currentTurn: number;
  streamSettled: boolean;
  signal?: AbortSignal;
  onSSE?: (event: SSETokenEvent) => void;
  onLatestTextDelta?: (textDelta: string) => void;
}

export interface StartedInterviewResponseStreamLifecycle {
  streamHandle: AIStreamHandle;
  streamSettled: boolean;
  shouldReturn: boolean;
  emitTextDelta: (textDelta: string) => void;
}

export async function startInterviewResponseStreamLifecycle({
  sessionId,
  streamMode,
  currentTurn,
  streamSettled,
  signal,
  onSSE,
  onLatestTextDelta,
}: StartInterviewResponseStreamLifecycleParams): Promise<StartedInterviewResponseStreamLifecycle> {
  const streamHandle = await aiStreamService.createStream('interview_session', sessionId);
  await aiStreamService.start(
    streamHandle,
    buildInterviewStreamStartPayload({ mode: streamMode, currentTurn })
  );

  if (signal?.aborted) {
    return {
      streamHandle,
      streamSettled: await settleInterviewResponseCancellation({
        streamHandle,
        streamSettled,
        streamMode,
      }),
      shouldReturn: true,
      emitTextDelta: () => undefined,
    };
  }

  return {
    streamHandle,
    streamSettled,
    shouldReturn: false,
    emitTextDelta: createInterviewResponseTextDeltaEmitter({
      streamHandle,
      onSSE,
      onLatestTextDelta,
    }),
  };
}

export function createInterviewResponseTextDeltaEmitter({
  streamHandle,
  onSSE,
  onLatestTextDelta,
}: {
  streamHandle: AIStreamHandle;
  onSSE?: (event: SSETokenEvent) => void;
  onLatestTextDelta?: (textDelta: string) => void;
}): (textDelta: string) => void {
  return (textDelta: string) => {
    if (!textDelta) return;
    onLatestTextDelta?.(textDelta);
    onSSE?.({ text: textDelta });
    void aiStreamService.delta(streamHandle, textDelta, buildInterviewStreamDeltaPayload());
  };
}
