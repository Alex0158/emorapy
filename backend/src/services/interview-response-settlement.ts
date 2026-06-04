import { Errors } from '../utils/errors';
import type { BackendLocale } from '../i18n';
import type { AIStreamHandle } from './ai-stream.service';
import { aiStreamService } from './ai-stream.service';
import { isInterviewAbortError } from './interview-ai-stream-request-utils';
import {
  buildInterviewStreamCancelledPayload,
  buildInterviewStreamFailedPayload,
  type InterviewStreamMode,
} from './interview-stream-payload-utils';

export interface SettleInterviewResponseStreamParams {
  streamHandle?: AIStreamHandle | null;
  streamSettled: boolean;
  streamMode: InterviewStreamMode;
  latestText?: string;
  locale?: BackendLocale;
}

export interface SettleInterviewResponseErrorParams extends SettleInterviewResponseStreamParams {
  error: unknown;
}

export interface InterviewResponseErrorSettlement {
  streamSettled: boolean;
  shouldReturn: boolean;
  errorToThrow?: unknown;
}

export async function settleInterviewResponseCancellation({
  streamHandle,
  streamSettled,
  streamMode,
  latestText,
}: SettleInterviewResponseStreamParams): Promise<boolean> {
  if (!streamHandle || streamSettled) return streamSettled;

  await aiStreamService.cancelled(
    streamHandle,
    buildInterviewStreamCancelledPayload({
      mode: streamMode,
      fullText: latestText || undefined,
    })
  );
  return true;
}

export async function settleInterviewResponseFailure({
  streamHandle,
  streamSettled,
  streamMode,
  latestText,
  error,
  locale,
}: SettleInterviewResponseErrorParams): Promise<boolean> {
  if (!streamHandle || streamSettled) return streamSettled;

  const failurePayload = buildInterviewStreamFailedPayload({
    error,
    mode: streamMode,
    fullText: latestText || undefined,
    locale,
  });
  await aiStreamService.failed(streamHandle, failurePayload.error, failurePayload.options);
  return true;
}

export async function settleInterviewResponseError(
  params: SettleInterviewResponseErrorParams
): Promise<InterviewResponseErrorSettlement> {
  if (isInterviewAbortError(params.error)) {
    return {
      streamSettled: await settleInterviewResponseCancellation(params),
      shouldReturn: true,
    };
  }

  return {
    streamSettled: await settleInterviewResponseFailure(params),
    shouldReturn: false,
    errorToThrow: normalizeInterviewResponseError(params.error),
  };
}

function normalizeInterviewResponseError(error: unknown): unknown {
  const err = error as { code?: string; message?: string };
  if (err?.code === 'CONFLICT' || err?.message?.includes('正在進行中')) {
    return Errors.CONCURRENT_REQUEST();
  }
  return error;
}
