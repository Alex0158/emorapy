import { describe, expect, it } from '@jest/globals';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';
import {
  buildInterviewEndSessionDisposition,
  countInterviewEndSessionUserChars,
} from '../../../src/services/interview-end-session-utils';

describe('interview-end-session-utils', () => {
  it('countInterviewEndSessionUserChars 應累計用戶回覆字符並忽略空值', () => {
    expect(
      countInterviewEndSessionUserChars([
        { user_response: 'hello' },
        { user_response: null },
        {},
        { user_response: '世界' },
      ])
    ).toBe(7);
  });

  it('buildInterviewEndSessionDisposition 輪數不足時應 completed 且 reason 優先為 turns', () => {
    expect(
      buildInterviewEndSessionDisposition({
        turns: [{ user_response: 'a'.repeat(100) }],
        turnCount: 1,
        minTurnsForPipeline: 5,
        minUserContentChars: 50,
      })
    ).toEqual({
      status: INTERVIEW_STATUS.COMPLETED,
      shouldProcess: false,
      turnCount: 1,
      totalUserChars: 100,
      insufficientReason: 'turns',
    });
  });

  it('buildInterviewEndSessionDisposition 內容不足時應 completed 且 reason 為 chars', () => {
    expect(
      buildInterviewEndSessionDisposition({
        turns: Array(5).fill({ user_response: 'a' }),
        turnCount: 5,
        minTurnsForPipeline: 5,
        minUserContentChars: 50,
      })
    ).toEqual({
      status: INTERVIEW_STATUS.COMPLETED,
      shouldProcess: false,
      turnCount: 5,
      totalUserChars: 5,
      insufficientReason: 'chars',
    });
  });

  it('buildInterviewEndSessionDisposition 輪數與內容足夠時應 processing', () => {
    expect(
      buildInterviewEndSessionDisposition({
        turns: Array(5).fill({ user_response: 'a'.repeat(10) }),
        turnCount: 5,
        minTurnsForPipeline: 5,
        minUserContentChars: 50,
      })
    ).toEqual({
      status: INTERVIEW_STATUS.PROCESSING,
      shouldProcess: true,
      turnCount: 5,
      totalUserChars: 50,
    });
  });
});
