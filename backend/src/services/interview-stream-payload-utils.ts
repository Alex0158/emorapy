import type { PsychDomain } from '@prisma/client';
import type { AIStreamErrorPayload, AIStreamPhase } from '../types/ai-stream';
import {
  translateBackendMessage,
  translateErrorByCode,
  type BackendLocale,
} from '../i18n';

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

const INTERVIEW_SAFETY_ALERT_MESSAGE = '系統偵測到安全風險，已先切換到安全支持回應。';

export function getInterviewSafetyAlertMessage(locale: BackendLocale = 'zh-TW'): string {
  return translateBackendMessage(locale, INTERVIEW_SAFETY_ALERT_MESSAGE);
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

export function buildInterviewStreamSafetyAlertPayload(params: {
  locale?: BackendLocale;
} = {}): InterviewStreamPublishOptions {
  return {
    actorRole: INTERVIEW_STREAM_ACTOR_ROLE,
    metadata: {
      message: getInterviewSafetyAlertMessage(params.locale),
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
  locale?: BackendLocale;
}): InterviewStreamFailurePayload {
  const code = getInterviewStreamErrorCode(params.error);
  const locale = params.locale ?? 'zh-TW';

  return {
    error: {
      code,
      message: getInterviewStreamErrorMessage(params.error, code, locale),
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

function getInterviewStreamErrorMessage(
  error: unknown,
  code: string,
  locale: BackendLocale
): string {
  if (code !== 'INTERNAL_ERROR') {
    const translatedByCode = translateErrorByCode(locale, code);
    if (translatedByCode !== code) return translatedByCode;
  }

  if (error instanceof Error && error.message) {
    const translatedMessage = translateBackendMessage(locale, error.message);
    if (translatedMessage !== error.message) return translatedMessage;
    if (locale === 'zh-TW' && /[\u4e00-\u9fff]/.test(error.message)) {
      return error.message;
    }
  }

  return translateBackendMessage(locale, '服務內部錯誤');
}
