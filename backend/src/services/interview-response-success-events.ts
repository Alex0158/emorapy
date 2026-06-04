import type { PsychDomain } from '@prisma/client';
import type { AIStreamHandle } from './ai-stream.service';
import { aiStreamService } from './ai-stream.service';
import type { BackendLocale } from '../i18n';
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
  getInterviewSafetyAlertMessage,
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
  locale?: BackendLocale;
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
  locale,
}: EmitInterviewResponseSuccessEventsParams): Promise<void> {
  onSSE?.(buildInterviewMetadataEvent({
    nextOrder,
    parsedMeta,
    domainsTouched,
  }));

  if (parsedMeta.safety_flag && parsedMeta.safety_message) {
    const safetyAlertMessage = getInterviewSafetyAlertMessage(locale);
    onSSE?.({
      message: safetyAlertMessage,
      severity: 'warning',
    });
    if (streamHandle) {
      await aiStreamService.phase(
        streamHandle,
        'safety_alert',
        buildInterviewStreamSafetyAlertPayload({ locale })
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
