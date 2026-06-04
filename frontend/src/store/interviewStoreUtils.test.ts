import { beforeEach, describe, expect, it } from 'vitest';
import type { InterviewSession, InterviewTurn } from '@/types/interview';
import { setLocale } from '@/utils/i18n';
import {
  extractInterviewErrorInfo,
  getInterviewStreamFailureMessage,
  getStreamingIdleState,
  getStreamingIdleWithAbortState,
  getStreamingStartState,
  normalizeSafetyAlertSeverity,
  shouldRecoverStreamingFromCanonical,
} from './interviewStoreUtils';

async function setLocaleReady(locale: 'zh-TW' | 'en-US'): Promise<void> {
  setLocale(locale);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createSession(overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: 'session-1',
    status: 'in_progress',
    turns: [],
    ...overrides,
  } as InterviewSession;
}

function createTurn(id: string): InterviewTurn {
  return {
    id,
    turn_order: 1,
    ai_message: 'Question',
    user_response: 'Answer',
    skipped: false,
    safety_flag: false,
    created_at: '2026-01-01T00:00:00.000Z',
  } as InterviewTurn;
}

describe('interview store utils', () => {
  beforeEach(() => {
    setLocale('zh-TW');
  });

  it('解析標準 API error，使用 code mapping 並保留 code/status', () => {
    expect(extractInterviewErrorInfo({
      message: 'too fast',
      code: 'TURN_TOO_FAST',
      status: 429,
    })).toEqual({
      message: '請求過於頻繁，請稍後再試',
      code: 'TURN_TOO_FAST',
      status: 429,
    });
  });

  it('非物件 error 不外露 raw message，缺失欄位使用目前語言的安全預設值', async () => {
    expect(extractInterviewErrorInfo('plain error')).toEqual({
      message: '發生未知錯誤，請稍後再試',
      code: null,
      status: null,
    });
    expect(extractInterviewErrorInfo({})).toEqual({
      message: '發生未知錯誤，請稍後再試',
      code: null,
      status: null,
    });

    await setLocaleReady('en-US');

    expect(extractInterviewErrorInfo({ message: '   ' })).toEqual({
      message: 'Unknown error',
      code: null,
      status: null,
    });
  });

  it('stream failure invalid-response fallback 應使用目前語言', async () => {
    expect(getInterviewStreamFailureMessage({
      message: 'Invalid interview stream response from server',
    })).toBe('服務回應格式異常，請稍後再試');

    await setLocaleReady('en-US');

    expect(getInterviewStreamFailureMessage({
      message: 'Invalid interview stream response from server',
    })).toBe('The service response could not be read. Please try again later.');
  });

  it('API error extraction invalid-response fallback 應使用目前語言', async () => {
    expect(extractInterviewErrorInfo({
      message: 'Invalid interview session response from server',
      code: 'INVALID_INTERVIEW_RESPONSE',
      status: 500,
    })).toEqual({
      message: '服務回應格式異常，請稍後再試',
      code: 'INVALID_INTERVIEW_RESPONSE',
      status: 500,
    });

    await setLocaleReady('en-US');

    expect(extractInterviewErrorInfo('Invalid interview response acknowledgement from server')).toEqual({
      message: 'The service response could not be read. Please try again later.',
      code: null,
      status: null,
    });
  });

  it('stream failure 不外露普通 raw message，缺失時使用訪談 fallback', () => {
    expect(getInterviewStreamFailureMessage({ code: 'TURN_TOO_FAST', message: 'too fast' }))
      .toBe('請求過於頻繁，請稍後再試');
    expect(getInterviewStreamFailureMessage({ message: 'too fast' })).toBe('回覆失敗');
    expect(getInterviewStreamFailureMessage({ message: '   ' })).toBe('回覆失敗');
    expect(getInterviewStreamFailureMessage({})).toBe('回覆失敗');
  });

  it('streaming 狀態片段分清是否清理 abortController', () => {
    expect(getStreamingStartState()).toEqual({
      isStreaming: true,
      streamingText: '',
      streamingStatus: 'thinking',
      error: null,
      errorCode: null,
      safetyAlert: null,
      abortController: null,
    });
    expect(getStreamingIdleState()).toEqual({
      isStreaming: false,
      streamingText: '',
      streamingStatus: null,
    });
    expect(getStreamingIdleWithAbortState()).toEqual({
      isStreaming: false,
      streamingText: '',
      streamingStatus: null,
      abortController: null,
    });
  });

  it('canonical session 已完成或已前進到下一輪時才結束 optimistic streaming', () => {
    const localTurns = [createTurn('local-1')];
    expect(shouldRecoverStreamingFromCanonical(false, localTurns, createSession())).toBe(false);
    expect(shouldRecoverStreamingFromCanonical(true, localTurns, createSession({ status: 'completed' }))).toBe(true);
    expect(shouldRecoverStreamingFromCanonical(true, localTurns, createSession({ turns: localTurns }))).toBe(false);
    expect(shouldRecoverStreamingFromCanonical(true, localTurns, createSession({
      turns: [...localTurns, createTurn('canonical-2')],
    }))).toBe(true);
  });

  it('safety alert severity 只接受 warning/critical，其他值回到 info', () => {
    expect(normalizeSafetyAlertSeverity('warning')).toBe('warning');
    expect(normalizeSafetyAlertSeverity('critical')).toBe('critical');
    expect(normalizeSafetyAlertSeverity('unknown')).toBe('info');
    expect(normalizeSafetyAlertSeverity(undefined)).toBe('info');
  });
});
