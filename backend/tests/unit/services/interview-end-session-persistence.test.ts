import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import prisma from '../../../src/config/database';
import { persistInterviewEndSession } from '../../../src/services/interview-end-session-persistence';

describe('interview-end-session-persistence', () => {
  const mockedPrisma = prisma as any;
  const endedAt = new Date('2026-04-26T10:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persistInterviewEndSession session 不存在時應拋 NOT_FOUND 且不更新', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue(null);

    await expect(
      persistInterviewEndSession({ sessionId: 's1', userId: 'u1', endedAt })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(mockedPrisma.interviewSession.update).not.toHaveBeenCalled();
  });

  it('persistInterviewEndSession session 屬於其他用戶時應拋 NOT_FOUND 且不更新', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'other-user',
      status: INTERVIEW_STATUS.IN_PROGRESS,
      turns: [],
      _count: { turns: 0 },
    });

    await expect(
      persistInterviewEndSession({ sessionId: 's1', userId: 'u1', endedAt })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(mockedPrisma.interviewSession.update).not.toHaveBeenCalled();
  });

  it('persistInterviewEndSession session 非進行中時應拋 SESSION_COMPLETED 且不更新', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: INTERVIEW_STATUS.COMPLETED,
      turns: [],
      _count: { turns: 0 },
    });

    await expect(
      persistInterviewEndSession({ sessionId: 's1', userId: 'u1', endedAt })
    ).rejects.toMatchObject({ code: 'SESSION_COMPLETED' });

    expect(mockedPrisma.interviewSession.update).not.toHaveBeenCalled();
  });

  it('persistInterviewEndSession 內容不足時應更新為 COMPLETED 並返回不觸發 pipeline 的 disposition', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: INTERVIEW_STATUS.IN_PROGRESS,
      turns: [
        { user_response: 'a'.repeat(20) },
        { user_response: 'b'.repeat(20) },
      ],
      _count: { turns: 2 },
    });
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await expect(
      persistInterviewEndSession({ sessionId: 's1', userId: 'u1', endedAt })
    ).resolves.toEqual({
      status: INTERVIEW_STATUS.COMPLETED,
      shouldProcess: false,
      turnCount: 2,
      totalUserChars: 40,
      insufficientReason: 'turns',
    });

    expect(mockedPrisma.interviewSession.findUnique).toHaveBeenCalledWith({
      where: { id: 's1' },
      include: {
        turns: { select: { user_response: true } },
        _count: { select: { turns: true } },
      },
    });
    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: INTERVIEW_STATUS.COMPLETED, ended_at: endedAt },
    });
  });

  it('persistInterviewEndSession 內容足夠時應更新為 PROCESSING 並返回可觸發 pipeline 的 disposition', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: INTERVIEW_STATUS.IN_PROGRESS,
      turns: Array(5).fill({ user_response: 'a'.repeat(10) }),
      _count: { turns: 5 },
    });
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await expect(
      persistInterviewEndSession({ sessionId: 's1', userId: 'u1', endedAt })
    ).resolves.toEqual({
      status: INTERVIEW_STATUS.PROCESSING,
      shouldProcess: true,
      turnCount: 5,
      totalUserChars: 50,
    });

    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: INTERVIEW_STATUS.PROCESSING, ended_at: endedAt },
    });
  });
});
