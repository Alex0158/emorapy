import type { RequestOptions } from 'openai/core';
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat/completions';
import { openai, INTERVIEW_AI_CONFIG } from '../config/openai';
import { retryWithBackoff, type RetryOptions } from '../utils/retry';

export type InterviewAIStreamRequest = ChatCompletionCreateParamsStreaming;
export type InterviewAIStreamChunk = ChatCompletionChunk;
export type InterviewAIResponseStream = AsyncIterable<InterviewAIStreamChunk>;

export function buildInterviewAIStreamRequest(params: {
  systemPrompt: string;
  userPrompt: string;
}): InterviewAIStreamRequest {
  return {
    model: INTERVIEW_AI_CONFIG.model,
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    max_tokens: INTERVIEW_AI_CONFIG.maxTokens,
    temperature: INTERVIEW_AI_CONFIG.temperature,
    top_p: INTERVIEW_AI_CONFIG.topP,
    frequency_penalty: INTERVIEW_AI_CONFIG.frequencyPenalty,
    presence_penalty: INTERVIEW_AI_CONFIG.presencePenalty,
    stream: true,
    stream_options: { include_usage: true },
  };
}

export function buildInterviewAIStreamRequestOptions(signal?: AbortSignal): RequestOptions | undefined {
  return signal ? { signal } : undefined;
}

export function isInterviewAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String((error as { name?: string }).name || '') : '';
  const message = 'message' in error ? String((error as { message?: string }).message || '') : '';
  return name === 'AbortError' || message.toLowerCase().includes('aborted');
}

export function shouldRetryInterviewAIStreamRequest(error: unknown): boolean {
  const err = error as { status?: number };
  if (isInterviewAbortError(error)) return false;
  return err?.status !== 429 && err?.status !== 401;
}

export function buildInterviewAIStreamRetryOptions(): RetryOptions {
  return {
    maxRetries: 3,
    shouldRetry: shouldRetryInterviewAIStreamRequest,
  };
}

export async function createInterviewAIResponseStream(params: {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
}): Promise<InterviewAIResponseStream> {
  return retryWithBackoff(async () => {
    const stream = await openai.chat.completions.create(
      buildInterviewAIStreamRequest(params),
      buildInterviewAIStreamRequestOptions(params.signal)
    );
    return stream;
  }, buildInterviewAIStreamRetryOptions());
}
