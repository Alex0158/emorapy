import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';
import { USER_RETRYABLE_PIPELINE_STATUSES } from '../../../src/services/async-pipeline-resume-policy';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewSession: {
      findFirst: jest.fn(),
    },
    interviewTurn: {
      count: jest.fn(),
    },
  },
}));

import prisma from '../../../src/config/database';
import { loadInterviewResumeStatus } from '../../../src/services/interview-resume-status';

describe('interview-resume-status', () => {
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loadInterviewResumeStatus 無 pending/failed session 時應返回 has_pending false 且不查 turn_count', async () => {
    mockedPrisma.interviewSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(loadInterviewResumeStatus('u1')).resolves.toEqual({
      has_pending: false,
    });

    expect(mockedPrisma.interviewSession.findFirst).toHaveBeenNthCalledWith(1, {
      where: { user_id: 'u1', status: INTERVIEW_STATUS.IN_PROGRESS },
      select: {
        id: true,
        turns: {
          select: { ai_message: true },
          orderBy: { turn_order: 'desc' },
          take: 1,
        },
      },
    });
    expect(mockedPrisma.interviewSession.findFirst).toHaveBeenNthCalledWith(2, {
      where: { user_id: 'u1', status: { in: [...USER_RETRYABLE_PIPELINE_STATUSES] } },
      select: { id: true },
      orderBy: { updated_at: 'desc' },
    });
    expect(mockedPrisma.interviewTurn.count).not.toHaveBeenCalled();
  });

  it('loadInterviewResumeStatus 有 pending session 時應返回最後 AI 訊息與 turn_count', async () => {
    mockedPrisma.interviewSession.findFirst
      .mockResolvedValueOnce({
        id: 's-pending',
        turns: [{ ai_message: '最近一次 AI 提問' }],
      })
      .mockResolvedValueOnce(null);
    mockedPrisma.interviewTurn.count.mockResolvedValue(7);

    await expect(loadInterviewResumeStatus('u1')).resolves.toEqual({
      has_pending: true,
      session_id: 's-pending',
      last_ai_message: '最近一次 AI 提問',
      turn_count: 7,
    });

    expect(mockedPrisma.interviewTurn.count).toHaveBeenCalledWith({
      where: { session_id: 's-pending' },
    });
  });

  it('loadInterviewResumeStatus pending session 沒有 turn 時 last_ai_message 應為 null', async () => {
    mockedPrisma.interviewSession.findFirst
      .mockResolvedValueOnce({
        id: 's-pending',
        turns: [],
      })
      .mockResolvedValueOnce(null);
    mockedPrisma.interviewTurn.count.mockResolvedValue(0);

    await expect(loadInterviewResumeStatus('u1')).resolves.toEqual({
      has_pending: true,
      session_id: 's-pending',
      last_ai_message: null,
      turn_count: 0,
    });
  });

  it('loadInterviewResumeStatus 有 failed session 時應返回 failed_session_id', async () => {
    mockedPrisma.interviewSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 's-failed' });

    await expect(loadInterviewResumeStatus('u1')).resolves.toEqual({
      has_pending: false,
      has_failed: true,
      failed_session_id: 's-failed',
    });
  });

  it('loadInterviewResumeStatus pending 與 failed 同時存在時應合併返回', async () => {
    mockedPrisma.interviewSession.findFirst
      .mockResolvedValueOnce({
        id: 's-pending',
        turns: [{ ai_message: '繼續聊剛才的部分嗎？' }],
      })
      .mockResolvedValueOnce({ id: 's-failed' });
    mockedPrisma.interviewTurn.count.mockResolvedValue(3);

    await expect(loadInterviewResumeStatus('u1')).resolves.toEqual({
      has_pending: true,
      session_id: 's-pending',
      last_ai_message: '繼續聊剛才的部分嗎？',
      turn_count: 3,
      has_failed: true,
      failed_session_id: 's-failed',
    });
  });
});
