import type { PsychDomain } from '@prisma/client';
import type { AIStreamHandle } from './ai-stream.service';
import { aiStreamService } from './ai-stream.service';
import type {
  InterviewAIResponse,
  SSECompleteEvent,
  SSEMetadataEvent,
  SSESafetyAlertEvent,
} from '../types/interview.types';
import {
  buildInterviewCompleteEvent,
  buildInterviewMetadataEvent,
} from './interview-response-utils';
import {
  buildInterviewStreamPersistedPayload,
  buildInterviewStreamSafetyAlertPayload,
  type InterviewStreamMode,
} from './interview-stream-payload-utils';

export type InterviewResponseSuccessSSEHandler = (
  event: SSEMetadataEvent | SSESafetyAlertEvent | SSECompleteEvent
) => void;

export interface EmitInterviewResponseSuccessEventsParams {
  onSSE?: InterviewResponseSuccessSSEHandler;
  streamHandle?: AIStreamHandle | null;
  sessionId: string;
  status: string;
  nextOrder: number;
  parsedMeta: Partial<InterviewAIResponse>;
  domainsTouched: PsychDomain[];
  createdTurnId: string;
  text: string;
  streamMode: InterviewStreamMode;
}

export async function emitInterviewResponseSuccessEvents({
  onSSE,
  streamHandle,
  sessionId,
  status,
  nextOrder,
  parsedMeta,
  domainsTouched,
  createdTurnId,
  text,
  streamMode,
}: EmitInterviewResponseSuccessEventsParams): Promise<void> {
  onSSE?.(buildInterviewMetadataEvent({
    nextOrder,
    parsedMeta,
    domainsTouched,
  }));

  if (parsedMeta.safety_flag && parsedMeta.safety_message) {
    onSSE?.({
      message: parsedMeta.safety_message,
      severity: 'warning',
    });
    if (streamHandle) {
      await aiStreamService.phase(
        streamHandle,
        'safety_alert',
        buildInterviewStreamSafetyAlertPayload(parsedMeta.safety_message)
      );
    }
  }

  onSSE?.(buildInterviewCompleteEvent({
    sessionId,
    status,
    nextOrder,
    domainsTouched,
  }));

  if (streamHandle) {
    await aiStreamService.persisted(
      streamHandle,
      buildInterviewStreamPersistedPayload({
        messageId: createdTurnId,
        text,
        mode: streamMode,
        turnOrder: nextOrder,
        shouldEnd: parsedMeta.should_end || false,
        domainsTouched,
      })
    );
  }
}
