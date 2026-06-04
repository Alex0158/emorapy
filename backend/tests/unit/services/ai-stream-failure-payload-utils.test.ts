import { describe, expect, it } from '@jest/globals';
import { buildAIStreamFailurePayload } from '../../../src/services/ai-stream-failure-payload-utils';

describe('buildAIStreamFailurePayload', () => {
  it('localizes known stream error codes', () => {
    expect(buildAIStreamFailurePayload({
      code: 'CHAT_AI_STREAM_FAILED',
      locale: 'en-US',
      retryable: true,
    })).toEqual({
      code: 'CHAT_AI_STREAM_FAILED',
      message: 'AI reply failed. Please try again later.',
      retryable: true,
    });

    expect(buildAIStreamFailurePayload({
      code: 'REPLAN_FAILED',
      locale: 'zh-TW',
    }).message).toBe('AI 重調失敗');
  });

  it('translates controlled backend messages for English stream payloads', () => {
    expect(buildAIStreamFailurePayload({
      code: 'JUDGMENT_STREAM_FAILED',
      locale: 'en-US',
      message: 'AI 請求過於頻繁，請稍後再試',
      retryable: true,
    })).toEqual({
      code: 'JUDGMENT_STREAM_FAILED',
      message: 'AI requests are too frequent. Please try again later.',
      retryable: true,
    });
  });

  it('does not expose unknown raw provider errors in English stream payloads', () => {
    expect(buildAIStreamFailurePayload({
      code: 'UNKNOWN_PROVIDER_ERROR',
      locale: 'en-US',
      message: 'provider down',
    }).message).toBe('Internal service error');
  });

  it('does not expose unknown raw provider errors in Traditional Chinese stream payloads', () => {
    expect(buildAIStreamFailurePayload({
      code: 'UNKNOWN_PROVIDER_ERROR',
      locale: 'zh-TW',
      message: 'provider down',
    }).message).toBe('服務內部錯誤');
  });
});
