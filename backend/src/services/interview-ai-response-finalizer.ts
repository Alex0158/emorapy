import type { PsychDomain } from '@prisma/client';
import type { InterviewAIResponse } from '../types/interview.types';
import type { BackendLocale } from '../i18n';
import type { AIStreamHandle } from './ai-stream.service';
import { aiStreamService } from './ai-stream.service';
import {
  buildInterviewResponseArtifacts,
} from './interview-response-utils';
import { persistInterviewAIResponse } from './interview-response-persistence';
import {
  emitInterviewResponseSuccessEvents,
  type InterviewResponseSuccessSSEHandler,
} from './interview-response-success-events';
import {
  buildInterviewStreamCompletedPayload,
  type InterviewStreamMode,
} from './interview-stream-payload-utils';

export interface FinalizeInterviewAIResponseParams {
  onSSE?: InterviewResponseSuccessSSEHandler;
  streamHandle?: AIStreamHandle | null;
  sessionId: string;
  status: string;
  nextOrder: number;
  text: string;
  parsedMeta: Partial<InterviewAIResponse>;
  collectedFacts: string[];
  existingDomains: PsychDomain[];
  fallbackDomains?: PsychDomain[];
  streamMode: InterviewStreamMode;
  locale?: BackendLocale;
}

export async function finalizeInterviewAIResponse({
  onSSE,
  streamHandle,
  sessionId,
  status,
  nextOrder,
  text,
  parsedMeta,
  collectedFacts,
  existingDomains,
  fallbackDomains = existingDomains,
  streamMode,
  locale,
}: FinalizeInterviewAIResponseParams): Promise<void> {
  if (streamHandle) {
    await aiStreamService.completed(
      streamHandle,
      buildInterviewStreamCompletedPayload({ text, mode: streamMode })
    );
  }

  const {
    targetDomains,
    newFacts,
    updatedCollectedFacts,
    aiWordCount,
    newDomains,
  } = buildInterviewResponseArtifacts({
    parsedMeta,
    collectedFacts,
    existingDomains,
    text,
  });
  const { createdTurn } = await persistInterviewAIResponse({
    sessionId,
    nextOrder,
    text,
    parsedMeta,
    targetDomains,
    fallbackDomains,
    newFacts,
    newDomains,
    aiWordCount,
    updatedCollectedFacts,
  });

  await emitInterviewResponseSuccessEvents({
    onSSE,
    streamHandle,
    sessionId,
    status,
    nextOrder,
    parsedMeta,
    domainsTouched: newDomains,
    createdTurnId: createdTurn.id,
    text,
    streamMode,
    locale,
  });
}
