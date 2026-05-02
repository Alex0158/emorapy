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

  it('buildInterviewStreamSafetyAlertPayload 應保留 warning severity', () => {
    expect(buildInterviewStreamSafetyAlertPayload('安全提示')).toEqual({
      actorRole: 'aiMediator',
      metadata: {
        message: '安全提示',
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

  it('buildInterviewStreamFailedPayload 應從業務錯誤讀取 code，並保留 latest text', () => {
    const error = Object.assign(new Error('訪談失敗'), { code: 'AI_CALL_FAILED' });

    expect(buildInterviewStreamFailedPayload({
      error,
      mode: 'respond',
      fullText: '部分文字',
    })).toEqual({
      error: {
        code: 'AI_CALL_FAILED',
        message: '訪談失敗',
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
});
