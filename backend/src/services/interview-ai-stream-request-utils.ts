import type { RequestOptions } from 'openai/core';
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat/completions';
import { openai, INTERVIEW_AI_CONFIG } from '../config/openai';
import { retryWithBackoff, type RetryOptions } from '../utils/retry';
import { INTERVIEW_METADATA_DELIMITER } from './interview-response-utils';

export type InterviewAIStreamRequest = ChatCompletionCreateParamsStreaming;
export type InterviewAIStreamChunk = ChatCompletionChunk;
export type InterviewAIResponseStream = AsyncIterable<InterviewAIStreamChunk>;

const MOCK_INTERVIEW_RESPONSE_TEXT =
  '我聽到你在描述一個讓你有壓力、也想被理解的處境。可以先從一個最具體的片段開始：最近哪一刻讓你最明顯感覺到這份壓力？';

function isInterviewAIMockEnabled(): boolean {
  const apiKey = process.env.OPENAI_API_KEY || '';
  return process.env.AI_MOCK === 'true' ||
    apiKey.includes('sk-dev-') ||
    apiKey.includes('your-openai-api-key');
}

function buildMockInterviewAIResponseContent(userPrompt: string): string {
  const keyFacts = userPrompt.trim().length > 0
    ? ['用戶完成一輪訪談回覆']
    : [];
  return [
    MOCK_INTERVIEW_RESPONSE_TEXT,
    INTERVIEW_METADATA_DELIMITER,
    JSON.stringify({
      intent: 'support_and_deepen',
      target_domains: ['personality', 'relationship_history'],
      should_end: false,
      safety_flag: false,
      safety_message: '',
      key_facts: keyFacts,
    }),
  ].join('');
}

async function* createMockInterviewAIResponseStream(params: {
  userPrompt: string;
  signal?: AbortSignal;
}): InterviewAIResponseStream {
  const content = buildMockInterviewAIResponseContent(params.userPrompt);
  const chunkSize = 32;
  for (let index = 0; index < content.length; index += chunkSize) {
    if (params.signal?.aborted) {
      throw new DOMException('interview mock stream aborted', 'AbortError');
    }
    yield {
      id: 'mock-interview-ai-response',
      created: Math.floor(Date.now() / 1000),
      model: INTERVIEW_AI_CONFIG.model,
      object: 'chat.completion.chunk',
      choices: [{
        index: 0,
        delta: { content: content.slice(index, index + chunkSize) },
        finish_reason: null,
      }],
    } as InterviewAIStreamChunk;
  }
  yield {
    id: 'mock-interview-ai-response',
    created: Math.floor(Date.now() / 1000),
    model: INTERVIEW_AI_CONFIG.model,
    object: 'chat.completion.chunk',
    choices: [{
      index: 0,
      delta: {},
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: Math.ceil(params.userPrompt.length / 4),
      completion_tokens: Math.ceil(content.length / 4),
      total_tokens: Math.ceil((params.userPrompt.length + content.length) / 4),
    },
  } as InterviewAIStreamChunk;
}

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
  if (isInterviewAIMockEnabled()) {
    return createMockInterviewAIResponseStream({
      userPrompt: params.userPrompt,
      signal: params.signal,
    });
  }

  return retryWithBackoff(async () => {
    const stream = await openai.chat.completions.create(
      buildInterviewAIStreamRequest(params),
      buildInterviewAIStreamRequestOptions(params.signal)
    );
    return stream;
  }, buildInterviewAIStreamRetryOptions());
}
