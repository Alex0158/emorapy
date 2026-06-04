import { describe, expect, it } from 'vitest';
import { buildLocalDraft, type AIStreamDraft } from '@/utils/aiStreamState';
import {
  getVisibleInterviewDraft,
  isTerminalInterviewErrorCode,
  isTerminalInterviewStreamError,
  resolveInterviewErrorMessage,
  shouldShowFallbackReloadButton,
  shouldShowRateLimitHint,
} from './interviewChatUtils';

describe('interview chat utils', () => {
  it('將不可恢復與服務端 stream error 視為終止錯誤', () => {
    expect(isTerminalInterviewStreamError({ status: 500 })).toBe(true);
    expect(isTerminalInterviewStreamError({ status: 404 })).toBe(true);
    expect(isTerminalInterviewStreamError({ code: 'INVALID_SESSION_ID' })).toBe(true);
    expect(isTerminalInterviewStreamError({ code: 'NETWORK_RETRYABLE' })).toBe(false);
  });

  it('依錯誤碼解析對應文案 key，未知錯誤保留原訊息', () => {
    const translate = (key: string) => `t:${key}`;
    expect(resolveInterviewErrorMessage('raw', 'RATE_LIMIT_EXCEEDED', translate)).toBe('t:interview.error.rateLimit');
    expect(resolveInterviewErrorMessage('raw', 'NETWORK_ERROR', translate)).toBe('t:common.networkError');
    expect(resolveInterviewErrorMessage('raw', 'UNKNOWN', translate)).toBe('raw');
  });

  it('終止錯誤碼與 rate limit hint 規則保持明確', () => {
    expect(isTerminalInterviewErrorCode('MAX_TURNS_REACHED')).toBe(true);
    expect(isTerminalInterviewErrorCode('SESSION_COMPLETED')).toBe(true);
    expect(isTerminalInterviewErrorCode('AI_CALL_FAILED')).toBe(false);
    expect(shouldShowRateLimitHint('RATE_LIMIT_EXCEEDED')).toBe(true);
    expect(shouldShowRateLimitHint('TURN_TOO_FAST')).toBe(true);
    expect(shouldShowRateLimitHint('AI_CALL_FAILED')).toBe(false);
  });

  it('已有主要處理動作的錯誤不再額外顯示 fallback reload', () => {
    expect(shouldShowFallbackReloadButton('AI_CALL_FAILED')).toBe(false);
    expect(shouldShowFallbackReloadButton('NOT_FOUND')).toBe(false);
    expect(shouldShowFallbackReloadButton('NETWORK_ERROR')).toBe(true);
    expect(shouldShowFallbackReloadButton(null)).toBe(true);
  });

  it('鏡像 draft 優先於本地 streaming draft，但 cancelled 快照不顯示氣泡', () => {
    const streamingDraft = buildLocalDraft({ text: 'local', status: 'streaming' });
    const mirroredDraft = buildLocalDraft({ text: 'mirror', status: 'streaming' });
    expect(getVisibleInterviewDraft(mirroredDraft, streamingDraft)?.text).toBe('mirror');
    expect(getVisibleInterviewDraft(null, streamingDraft)?.text).toBe('local');
    expect(getVisibleInterviewDraft({ ...mirroredDraft, status: 'cancelled' } as AIStreamDraft, streamingDraft)).toBeNull();
  });
});
