import { describe, expect, it } from '@jest/globals';
import { PsychDomain } from '@prisma/client';

import {
  buildInterviewStreamCancelledPayload,
  buildInterviewStreamCompletedPayload,
  buildInterviewStreamDeltaPayload,
  buildInterviewStreamFailedPayload,
  buildInterviewStreamPersistedPayload,
  buildInterviewStreamSafetyAlertPayload,
  buildInterviewStreamStartPayload,
  getInterviewStreamMode,
} from '../../../src/services/interview-stream-payload-utils';

describe('interview-stream-payload-utils', () => {
  it('getInterviewStreamMode 應由 skip flag 產生既有 mode', () => {
    expect(getInterviewStreamMode(false)).toBe('respond');
    expect(getInterviewStreamMode(true)).toBe('skip');
  });

  it('buildInterviewStreamStartPayload 應產生 thinking 起始 payload', () => {
    expect(buildInterviewStreamStartPayload({ mode: 'respond', currentTurn: 3 })).toEqual({
      actorRole: 'aiMediator',
      phase: 'thinking',
      metadata: {
        mode: 'respond',
        currentTurn: 3,
      },
    });
  });

  it('buildInterviewStreamDeltaPayload 應只帶 actorRole', () => {
    expect(buildInterviewStreamDeltaPayload()).toEqual({ actorRole: 'aiMediator' });
  });

  it('buildInterviewStreamCompletedPayload 應帶 fullText、completed phase 與 mode', () => {
    expect(buildInterviewStreamCompletedPayload({ text: '完成文字', mode: 'skip' })).toEqual({
      actorRole: 'aiMediator',
      fullText: '完成文字',
      phase: 'completed',
      metadata: {
        mode: 'skip',
      },
    });
  });

  it('buildInterviewStreamPersistedPayload 應保留落庫 turn metadata', () => {
    expect(
      buildInterviewStreamPersistedPayload({
        messageId: 'turn-2',
        text: '完成文字',
        mode: 'respond',
        turnOrder: 2,
        shouldEnd: false,
        domainsTouched: [PsychDomain.personality, PsychDomain.attachment],
      })
    ).toEqual({
      actorRole: 'aiMediator',
      messageId: 'turn-2',
      fullText: '完成文字',
      phase: 'completed',
      metadata: {
        mode: 'respond',
        turnOrder: 2,
        shouldEnd: false,
        domainsTouched: [PsychDomain.personality, PsychDomain.attachment],
      },
    });
  });

  it('buildInterviewStreamSafetyAlertPayload 應使用受控 safety alert message 並保留 warning severity', () => {
    expect(buildInterviewStreamSafetyAlertPayload()).toEqual({
      actorRole: 'aiMediator',
      metadata: {
        message: '系統偵測到安全風險，已先切換到安全支持回應。',
        severity: 'warning',
      },
    });

    expect(buildInterviewStreamSafetyAlertPayload({ locale: 'en-US' })).toEqual({
      actorRole: 'aiMediator',
      metadata: {
        message: 'We detected a possible safety risk and switched to a safety-first response.',
        severity: 'warning',
      },
    });
  });

  it('buildInterviewStreamCancelledPayload 應保留 client_abort reason，fullText 可選', () => {
    expect(buildInterviewStreamCancelledPayload({ mode: 'respond' })).toEqual({
      actorRole: 'aiMediator',
      fullText: undefined,
      metadata: {
        reason: 'client_abort',
        mode: 'respond',
      },
    });
    expect(buildInterviewStreamCancelledPayload({ mode: 'skip', fullText: '已輸出文字' })).toEqual({
      actorRole: 'aiMediator',
      fullText: '已輸出文字',
      metadata: {
        reason: 'client_abort',
        mode: 'skip',
      },
    });
  });

  it('buildInterviewStreamFailedPayload 應從業務錯誤讀取 code，並使用本地化訊息', () => {
    const error = Object.assign(new Error('訪談失敗'), { code: 'AI_CALL_FAILED' });

    expect(buildInterviewStreamFailedPayload({
      error,
      mode: 'respond',
      fullText: '部分文字',
    })).toEqual({
      error: {
        code: 'AI_CALL_FAILED',
        message: 'AI 調用失敗',
      },
      options: {
        actorRole: 'aiMediator',
        fullText: '部分文字',
        metadata: {
          mode: 'respond',
        },
      },
    });
  });

  it('buildInterviewStreamFailedPayload 應按 en-US locale 翻譯已知錯誤 code', () => {
    const error = Object.assign(new Error('訪談失敗'), { code: 'AI_CALL_FAILED' });

    expect(buildInterviewStreamFailedPayload({
      error,
      mode: 'respond',
      locale: 'en-US',
    }).error).toEqual({
      code: 'AI_CALL_FAILED',
      message: 'AI call failed',
    });
  });

  it('buildInterviewStreamFailedPayload 不應把未知英文 runtime 診斷直接發布給 UI', () => {
    const error = Object.assign(new Error('provider down'), { code: 'AI_PROVIDER_DOWN' });

    expect(buildInterviewStreamFailedPayload({
      error,
      mode: 'respond',
      locale: 'en-US',
    }).error).toEqual({
      code: 'AI_PROVIDER_DOWN',
      message: 'Internal service error',
    });
  });

  it('buildInterviewStreamFailedPayload 對未知錯誤保留既有 fallback', () => {
    expect(buildInterviewStreamFailedPayload({
      error: 'boom',
      mode: 'skip',
    })).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: '服務內部錯誤',
      },
      options: {
        actorRole: 'aiMediator',
        fullText: undefined,
        metadata: {
          mode: 'skip',
        },
      },
    });
  });

  it('buildInterviewStreamFailedPayload 對 en-US 未知錯誤使用英文 fallback', () => {
    expect(buildInterviewStreamFailedPayload({
      error: 'boom',
      mode: 'skip',
      locale: 'en-US',
    }).error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal service error',
    });
  });
});
