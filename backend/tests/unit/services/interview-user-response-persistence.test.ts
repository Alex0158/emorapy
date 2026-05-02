import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewTurn: {
      update: jest.fn(),
    },
    interviewSession: {
      update: jest.fn(),
    },
  },
}));

import prisma from '../../../src/config/database';
import { persistInterviewUserResponse } from '../../../src/services/interview-user-response-persistence';

describe('interview-user-response-persistence', () => {
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persistInterviewUserResponse 應清洗 metadata delimiter、更新最後一輪並累加用戶字數', async () => {
    mockedPrisma.interviewTurn.update.mockResolvedValue({});
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await expect(
      persistInterviewUserResponse({
        sessionId: 's1',
        lastTurnId: 't1',
        userResponse: ' hello ---METADATA--- world ',
        isSkip: false,
      })
    ).resolves.toEqual({
      sanitizedResponse: 'hello  world',
      wordCount: 2,
    });

    expect(mockedPrisma.interviewTurn.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: {
        user_response: 'hello  world',
        response_word_count: 2,
        skipped: false,
      },
    });
    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: {
        total_user_words: { increment: 2 },
      },
    });
  });

  it('persistInterviewUserResponse skip 時應寫空回覆且不累加 session 字數', async () => {
    mockedPrisma.interviewTurn.update.mockResolvedValue({});

    await expect(
      persistInterviewUserResponse({
        sessionId: 's1',
        lastTurnId: 't1',
        userResponse: '不應保存',
        isSkip: true,
      })
    ).resolves.toEqual({
      sanitizedResponse: '',
      wordCount: 0,
    });

    expect(mockedPrisma.interviewTurn.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: {
        user_response: '',
        response_word_count: 0,
        skipped: true,
      },
    });
    expect(mockedPrisma.interviewSession.update).not.toHaveBeenCalled();
  });
});
