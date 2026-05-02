import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PsychDomain } from '@prisma/client';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../src/config/openai', () => ({
  __esModule: true,
  INTERVIEW_AI_CONFIG: { model: 'gpt-test-interview' },
}));

import prisma from '../../../src/config/database';
import { persistInterviewStartSession } from '../../../src/services/interview-start-session-persistence';

describe('interview-start-session-persistence', () => {
  const mockedPrisma = prisma as any;
  const startedAt = new Date('2026-04-26T10:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockTransaction() {
    const newSession = { id: 's-new', user_id: 'u1', status: INTERVIEW_STATUS.IN_PROGRESS };
    const withTurns = {
      ...newSession,
      turns: [{ id: 'turn-1', turn_order: 1, ai_message: '首題' }],
    };
    const tx = {
      interviewSession: {
        update: jest.fn<(...args: any[]) => Promise<unknown>>().mockResolvedValue({}),
        create: jest.fn<(...args: any[]) => Promise<unknown>>().mockResolvedValue(newSession),
        findUnique: jest.fn<(...args: any[]) => Promise<unknown>>().mockResolvedValue(withTurns),
      },
      interviewTurn: {
        create: jest.fn<(...args: any[]) => Promise<unknown>>().mockResolvedValue({ id: 'turn-1' }),
      },
    };
    mockedPrisma.$transaction.mockImplementation(async (fn: (transaction: unknown) => Promise<unknown>) => fn(tx));
    return { tx, withTurns };
  }

  it('persistInterviewStartSession 無舊 session 時應建立新 session、第一輪 turn 並讀回 turns', async () => {
    const { tx, withTurns } = mockTransaction();

    await expect(persistInterviewStartSession({
      userId: 'u1',
      trigger: 'organic',
      firstQuestion: '首題',
      previousSessionDisposition: null,
      startedAt,
    })).resolves.toBe(withTurns);

    expect(tx.interviewSession.update).not.toHaveBeenCalled();
    expect(tx.interviewSession.create).toHaveBeenCalledWith({
      data: {
        user_id: 'u1',
        trigger: 'organic',
        status: INTERVIEW_STATUS.IN_PROGRESS,
        ai_model_used: 'gpt-test-interview',
        total_user_words: 0,
        total_ai_words: 0,
        started_at: startedAt,
      },
    });
    expect(tx.interviewTurn.create).toHaveBeenCalledWith({
      data: {
        session_id: 's-new',
        turn_order: 1,
        ai_message: '首題',
        ai_intent: 'opening',
        ai_target_domains: [PsychDomain.personality],
      },
    });
    expect(tx.interviewSession.findUnique).toHaveBeenCalledWith({
      where: { id: 's-new' },
      include: { turns: { orderBy: { turn_order: 'asc' } } },
    });
  });

  it('persistInterviewStartSession 舊 session 達門檻時應先標記 processing，再建立新 session', async () => {
    const { tx } = mockTransaction();

    await persistInterviewStartSession({
      userId: 'u1',
      trigger: 'pre_case',
      firstQuestion: '首題',
      previousSessionDisposition: {
        sessionId: 's-old',
        status: INTERVIEW_STATUS.PROCESSING,
        shouldProcess: true,
      },
      startedAt,
    });

    expect(tx.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's-old' },
      data: { status: INTERVIEW_STATUS.PROCESSING },
    });
    expect(tx.interviewSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ trigger: 'pre_case' }),
    }));
    expect(
      tx.interviewSession.update.mock.invocationCallOrder[0]
    ).toBeLessThan(tx.interviewSession.create.mock.invocationCallOrder[0]);
  });

  it('persistInterviewStartSession 舊 session 未達門檻時應標記 abandoned 且仍建立新 session', async () => {
    const { tx } = mockTransaction();

    await persistInterviewStartSession({
      userId: 'u1',
      trigger: 'onboarding',
      firstQuestion: '首題',
      previousSessionDisposition: {
        sessionId: 's-old',
        status: INTERVIEW_STATUS.ABANDONED,
        shouldProcess: false,
      },
      startedAt,
    });

    expect(tx.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's-old' },
      data: { status: INTERVIEW_STATUS.ABANDONED },
    });
    expect(tx.interviewSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ trigger: 'onboarding' }),
    }));
    expect(tx.interviewTurn.create).toHaveBeenCalled();
  });

  it('persistInterviewStartSession transaction 失敗時應拋回原錯', async () => {
    const transactionError = new Error('transaction failed');
    mockedPrisma.$transaction.mockRejectedValue(transactionError);

    await expect(persistInterviewStartSession({
      userId: 'u1',
      trigger: 'organic',
      firstQuestion: '首題',
      previousSessionDisposition: null,
      startedAt,
    })).rejects.toBe(transactionError);
  });
});
