import { describe, expect, it } from '@jest/globals';
import {
  buildInterviewStartRateLimitWindow,
  getInterviewStartRateLimitViolation,
  getPreviousInterviewSessionDisposition,
} from '../../../src/services/interview-start-session-utils';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';

describe('interview-start-session-utils', () => {
  it('buildInterviewStartRateLimitWindow 應使用較早的 oneHourAgo/todayStart 作為查詢起點', () => {
    const morningNow = new Date(2026, 3, 26, 0, 30, 0, 0);
    const expectedMorningTodayStart = new Date(morningNow);
    expectedMorningTodayStart.setHours(0, 0, 0, 0);
    const expectedMorningOneHourAgo = new Date(morningNow.getTime() - 60 * 60 * 1000);
    const morning = buildInterviewStartRateLimitWindow(morningNow);
    expect(morning.todayStart.toISOString()).toBe(expectedMorningTodayStart.toISOString());
    expect(morning.oneHourAgo.toISOString()).toBe(expectedMorningOneHourAgo.toISOString());
    expect(morning.queryStart).toBe(expectedMorningOneHourAgo.toISOString());

    const afternoonNow = new Date(2026, 3, 26, 15, 0, 0, 0);
    const expectedAfternoonTodayStart = new Date(afternoonNow);
    expectedAfternoonTodayStart.setHours(0, 0, 0, 0);
    const afternoon = buildInterviewStartRateLimitWindow(afternoonNow);
    expect(afternoon.queryStart).toBe(expectedAfternoonTodayStart.toISOString());
  });

  it('getInterviewStartRateLimitViolation 應只計算 turns >= 3 的 substantive sessions', () => {
    const window = buildInterviewStartRateLimitWindow(new Date('2026-04-26T15:00:00.000Z'));
    const result = getInterviewStartRateLimitViolation(
      [
        { created_at: '2026-04-26T14:30:00.000Z', _count: { turns: 2 } },
        { created_at: '2026-04-26T14:20:00.000Z', _count: { turns: 1 } },
      ],
      { dailySessionLimit: 1, startRateLimit: 1 },
      window
    );
    expect(result).toBeNull();
  });

  it('每日 substantive sessions 達限時回傳每日限額訊息，且每日優先於每小時', () => {
    const window = buildInterviewStartRateLimitWindow(new Date('2026-04-26T15:00:00.000Z'));
    const result = getInterviewStartRateLimitViolation(
      [{ created_at: '2026-04-26T14:30:00.000Z', _count: { turns: 3 } }],
      { dailySessionLimit: 1, startRateLimit: 1 },
      window
    );
    expect(result).toBe('今日開始訪談次數已達上限');
  });

  it('每小時 substantive sessions 達限時回傳每小時限額訊息', () => {
    const window = buildInterviewStartRateLimitWindow(new Date('2026-04-26T15:00:00.000Z'));
    const result = getInterviewStartRateLimitViolation(
      [{ created_at: '2026-04-26T14:30:00.000Z', _count: { turns: 3 } }],
      { dailySessionLimit: 2, startRateLimit: 1 },
      window
    );
    expect(result).toBe('每小時開始訪談次數已達上限，請稍後再試');
  });

  it('舊進行中 session 達 pipeline 門檻時應標記 processing 並觸發後續處理', () => {
    expect(getPreviousInterviewSessionDisposition({
      id: 's1',
      turns: Array(5).fill({}),
    }, 5)).toEqual({
      sessionId: 's1',
      status: INTERVIEW_STATUS.PROCESSING,
      shouldProcess: true,
    });
  });

  it('舊進行中 session 未達 pipeline 門檻時應標記 abandoned 且不觸發後續處理', () => {
    expect(getPreviousInterviewSessionDisposition({
      id: 's1',
      turns: Array(4).fill({}),
    }, 5)).toEqual({
      sessionId: 's1',
      status: INTERVIEW_STATUS.ABANDONED,
      shouldProcess: false,
    });
  });

  it('沒有舊 session 時不需要處理 disposition', () => {
    expect(getPreviousInterviewSessionDisposition(null, 5)).toBeNull();
  });
});
