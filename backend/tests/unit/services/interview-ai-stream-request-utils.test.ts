import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../../../src/config/openai', () => ({
  __esModule: true,
  openai: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
  INTERVIEW_AI_CONFIG: {
    model: 'gpt-interview-test',
    maxTokens: 800,
    temperature: 0.8,
    topP: 0.95,
    frequencyPenalty: 0.1,
    presencePenalty: 0.2,
  },
}));

jest.mock('../../../src/utils/retry', () => ({
  __esModule: true,
  retryWithBackoff: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}));

import { openai } from '../../../src/config/openai';
import { retryWithBackoff } from '../../../src/utils/retry';
import {
  buildInterviewAIStreamRequest,
  buildInterviewAIStreamRequestOptions,
  buildInterviewAIStreamRetryOptions,
  createInterviewAIResponseStream,
  isInterviewAbortError,
  shouldRetryInterviewAIStreamRequest,
} from '../../../src/services/interview-ai-stream-request-utils';

describe('interview-ai-stream-request-utils', () => {
  const mockedOpenAI = openai as any;
  const mockedRetryWithBackoff = retryWithBackoff as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRetryWithBackoff.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  it('buildInterviewAIStreamRequest 應使用訪談模型設定與 system/user prompt', () => {
    expect(buildInterviewAIStreamRequest({
      systemPrompt: 'system prompt',
      userPrompt: 'user prompt',
    })).toEqual({
      model: 'gpt-interview-test',
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'user prompt' },
      ],
      max_tokens: 800,
      temperature: 0.8,
      top_p: 0.95,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      stream: true,
    });
  });

  it('buildInterviewAIStreamRequestOptions 只有 signal 存在時才返回 request options', () => {
    expect(buildInterviewAIStreamRequestOptions()).toBeUndefined();

    const controller = new AbortController();
    expect(buildInterviewAIStreamRequestOptions(controller.signal)).toEqual({
      signal: controller.signal,
    });
  });

  it('isInterviewAbortError 應辨識 AbortError 名稱與 aborted 訊息', () => {
    expect(isInterviewAbortError(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isInterviewAbortError(new Error('request aborted by client'))).toBe(true);
    expect(isInterviewAbortError(new Error('provider down'))).toBe(false);
    expect(isInterviewAbortError(null)).toBe(false);
  });

  it('shouldRetryInterviewAIStreamRequest 應保留既有 401/429/abort 不重試語義', () => {
    expect(shouldRetryInterviewAIStreamRequest({ status: 401 })).toBe(false);
    expect(shouldRetryInterviewAIStreamRequest({ status: 429 })).toBe(false);
    expect(shouldRetryInterviewAIStreamRequest(new DOMException('aborted', 'AbortError'))).toBe(false);
    expect(shouldRetryInterviewAIStreamRequest({ status: 400 })).toBe(true);
    expect(shouldRetryInterviewAIStreamRequest({ status: 500 })).toBe(true);
    expect(shouldRetryInterviewAIStreamRequest(new Error('network failed'))).toBe(true);
  });

  it('buildInterviewAIStreamRetryOptions 應使用 maxRetries=3 與訪談 retry policy', () => {
    const options = buildInterviewAIStreamRetryOptions();

    expect(options.maxRetries).toBe(3);
    expect(options.shouldRetry?.({ status: 500 })).toBe(true);
    expect(options.shouldRetry?.({ status: 429 })).toBe(false);
  });

  it('createInterviewAIResponseStream 應透過 retryWithBackoff 建立 OpenAI stream', async () => {
    const fakeStream = (async function* () {
      yield { choices: [{ delta: { content: 'hi' } }] };
    })();
    mockedOpenAI.chat.completions.create.mockResolvedValue(fakeStream);
    const controller = new AbortController();

    await expect(createInterviewAIResponseStream({
      systemPrompt: 'system prompt',
      userPrompt: 'user prompt',
      signal: controller.signal,
    })).resolves.toBe(fakeStream);

    expect(mockedRetryWithBackoff).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxRetries: 3,
        shouldRetry: expect.any(Function),
      })
    );
    expect(mockedOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-interview-test',
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user prompt' },
        ],
        stream: true,
      }),
      { signal: controller.signal }
    );
  });
});
