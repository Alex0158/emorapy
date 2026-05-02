import type { PsychDomain } from '@prisma/client';
import type { AIStreamErrorPayload, AIStreamPhase } from '../types/ai-stream';

const INTERVIEW_STREAM_ACTOR_ROLE = 'aiMediator';

export type InterviewStreamMode = 'respond' | 'skip';

export interface InterviewStreamPublishOptions {
  actorRole: string;
  phase?: AIStreamPhase;
  messageId?: string;
  fullText?: string;
  metadata?: Record<string, unknown>;
}

export interface InterviewStreamFailurePayload {
  error: AIStreamErrorPayload;
  options: InterviewStreamPublishOptions;
}

export function getInterviewStreamMode(isSkip: boolean): InterviewStreamMode {
  return isSkip ? 'skip' : 'respond';
}

export function buildInterviewStreamStartPayload(params: {
  mode: InterviewStreamMode;
  currentTurn: number;
}): InterviewStreamPublishOptions {
  return {
    actorRole: INTERVIEW_STREAM_ACTOR_ROLE,
    phase: 'thinking',
    metadata: {
      mode: params.mode,
      currentTurn: params.currentTurn,
    },
  };
}

export function buildInterviewStreamDeltaPayload(): Pick<InterviewStreamPublishOptions, 'actorRole'> {
  return { actorRole: INTERVIEW_STREAM_ACTOR_ROLE };
}

export function buildInterviewStreamCompletedPayload(params: {
  text: string;
  mode: InterviewStreamMode;
}): InterviewStreamPublishOptions {
  return {
    actorRole: INTERVIEW_STREAM_ACTOR_ROLE,
    fullText: params.text,
    phase: 'completed',
    metadata: {
      mode: params.mode,
    },
  };
}

export function buildInterviewStreamPersistedPayload(params: {
  messageId: string;
  text: string;
  mode: InterviewStreamMode;
  turnOrder: number;
  shouldEnd: boolean;
  domainsTouched: PsychDomain[];
}): InterviewStreamPublishOptions {
  return {
    actorRole: INTERVIEW_STREAM_ACTOR_ROLE,
    messageId: params.messageId,
    fullText: params.text,
    phase: 'completed',
    metadata: {
      mode: params.mode,
      turnOrder: params.turnOrder,
      shouldEnd: params.shouldEnd,
      domainsTouched: params.domainsTouched,
    },
  };
}

export function buildInterviewStreamSafetyAlertPayload(message: string): InterviewStreamPublishOptions {
  return {
    actorRole: INTERVIEW_STREAM_ACTOR_ROLE,
    metadata: {
      message,
      severity: 'warning',
    },
  };
}

export function buildInterviewStreamCancelledPayload(params: {
  mode: InterviewStreamMode;
  fullText?: string;
}): InterviewStreamPublishOptions {
  return {
    actorRole: INTERVIEW_STREAM_ACTOR_ROLE,
    fullText: params.fullText,
    metadata: {
      reason: 'client_abort',
      mode: params.mode,
    },
  };
}

export function buildInterviewStreamFailedPayload(params: {
  error: unknown;
  mode: InterviewStreamMode;
  fullText?: string;
}): InterviewStreamFailurePayload {
  return {
    error: {
      code: getInterviewStreamErrorCode(params.error),
      message: params.error instanceof Error ? params.error.message : '服務內部錯誤',
    },
    options: {
      actorRole: INTERVIEW_STREAM_ACTOR_ROLE,
      fullText: params.fullText,
      metadata: {
        mode: params.mode,
      },
    },
  };
}

function getInterviewStreamErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'INTERNAL_ERROR';
  return String((error as { code?: string }).code || 'INTERNAL_ERROR');
}
