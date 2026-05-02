import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';

jest.mock('../../../src/config/env', () => ({
  env: {
    INTERVIEW_MAX_TURNS: 30,
    INTERVIEW_SOFT_TARGET: 10,
    INTERVIEW_TURN_INTERVAL_MS: 0,
    INTERVIEW_START_RATE_LIMIT: 3,
    INTERVIEW_DAILY_SESSION_LIMIT: 5,
  },
}));

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewSession: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../src/services/system-config.service', () => ({
  __esModule: true,
  systemConfigService: { getNumberConfig: jest.fn() },
}));

import prisma from '../../../src/config/database';
import { systemConfigService } from '../../../src/services/system-config.service';
import { loadValidatedInterviewTurnContext } from '../../../src/services/interview-turn-context';

const NOW = new Date('2026-04-26T10:00:00.000Z').getTime();

describe('interview-turn-context', () => {
  const mockedPrisma = prisma as any;
  const mockedSystemConfig = systemConfigService as any;
  let dateNowSpy: jest.SpiedFunction<typeof Date.now>;

  beforeEach(() => {
    jest.clearAllMocks();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockedSystemConfig.getNumberConfig.mockImplementation(async (_key: string, fallback: number) => fallback);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('loadValidatedInterviewTurnContext session 不存在時應拋 NOT_FOUND', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue(null);

    await expect(loadValidatedInterviewTurnContext('s1', 'u1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(mockedPrisma.interviewSession.findUnique).toHaveBeenCalledWith({
      where: { id: 's1' },
      include: { turns: { orderBy: { turn_order: 'asc' } } },
    });
  });

  it('loadValidatedInterviewTurnContext session 屬於其他用戶時應拋 NOT_FOUND', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'other-user',
      status: INTERVIEW_STATUS.IN_PROGRESS,
      turns: [{ id: 't1', created_at: new Date(NOW - 60_000) }],
    });

    await expect(loadValidatedInterviewTurnContext('s1', 'u1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('loadValidatedInterviewTurnContext session 非進行中時應拋 SESSION_COMPLETED', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: INTERVIEW_STATUS.COMPLETED,
      turns: [{ id: 't1', created_at: new Date(NOW - 60_000) }],
    });

    await expect(loadValidatedInterviewTurnContext('s1', 'u1')).rejects.toMatchObject({
      code: 'SESSION_COMPLETED',
    });
  });

  it('loadValidatedInterviewTurnContext 達最大輪數時應拋 MAX_TURNS_REACHED', async () => {
    mockedSystemConfig.getNumberConfig.mockImplementation(async (key: string, fallback: number) => {
      if (key === 'interview.maxTurns') return 2;
      return fallback;
    });
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: INTERVIEW_STATUS.IN_PROGRESS,
      turns: [
        { id: 't1', created_at: new Date(NOW - 120_000) },
        { id: 't2', created_at: new Date(NOW - 60_000) },
      ],
    });

    await expect(loadValidatedInterviewTurnContext('s1', 'u1')).rejects.toMatchObject({
      code: 'MAX_TURNS_REACHED',
    });
  });

  it('loadValidatedInterviewTurnContext 缺少可回覆 turn 時應拋受控錯誤', async () => {
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: INTERVIEW_STATUS.IN_PROGRESS,
      turns: [],
    });

    await expect(loadValidatedInterviewTurnContext('s1', 'u1')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: '訪談缺少可回覆輪次',
    });
  });

  it('loadValidatedInterviewTurnContext 回覆過快時應拋 TURN_TOO_FAST', async () => {
    mockedSystemConfig.getNumberConfig.mockImplementation(async (key: string, fallback: number) => {
      if (key === 'interview.turnIntervalMs') return 120_000;
      return fallback;
    });
    mockedPrisma.interviewSession.findUnique.mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      status: INTERVIEW_STATUS.IN_PROGRESS,
      turns: [{ id: 't1', created_at: new Date(NOW - 30_000) }],
    });

    await expect(loadValidatedInterviewTurnContext('s1', 'u1')).rejects.toMatchObject({
      code: 'TURN_TOO_FAST',
    });
  });

  it('loadValidatedInterviewTurnContext 應返回 runtimeConfig、session 與最後一輪', async () => {
    const firstTurn = { id: 't1', created_at: new Date(NOW - 120_000) };
    const lastTurn = { id: 't2', created_at: new Date(NOW - 60_000) };
    const session = {
      id: 's1',
      user_id: 'u1',
      status: INTERVIEW_STATUS.IN_PROGRESS,
      turns: [firstTurn, lastTurn],
    };
    mockedPrisma.interviewSession.findUnique.mockResolvedValue(session);

    await expect(loadValidatedInterviewTurnContext('s1', 'u1')).resolves.toEqual({
      runtimeConfig: {
        maxTurns: 30,
        softTarget: 10,
        turnIntervalMs: 0,
        startRateLimit: 3,
        dailySessionLimit: 5,
      },
      session,
      lastTurn,
    });
  });
});
