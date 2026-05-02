import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';

jest.mock('../../../src/config/env', () => ({
  env: {
    INTERVIEW_MAX_TURNS: 30,
    INTERVIEW_SOFT_TARGET: 10,
    INTERVIEW_TURN_INTERVAL_MS: 0,
    INTERVIEW_START_RATE_LIMIT: 2,
    INTERVIEW_DAILY_SESSION_LIMIT: 2,
  },
}));

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    interviewSession: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../../src/services/system-config.service', () => ({
  __esModule: true,
  systemConfigService: { getNumberConfig: jest.fn() },
}));

import prisma from '../../../src/config/database';
import { systemConfigService } from '../../../src/services/system-config.service';
import { loadValidatedInterviewStartContext } from '../../../src/services/interview-start-session-context';

describe('interview-start-session-context', () => {
  const mockedPrisma = prisma as any;
  const mockedSystemConfig = systemConfigService as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedSystemConfig.getNumberConfig.mockImplementation(async (_key: string, fallback: number) => fallback);
  });

  it('loadValidatedInterviewStartContext 未同意心理畫像時應拋 CONSENT_REQUIRED 並不查 session', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ psych_consent_given: false });

    await expect(loadValidatedInterviewStartContext('u1')).rejects.toMatchObject({
      code: 'CONSENT_REQUIRED',
    });

    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { psych_consent_given: true },
    });
    expect(mockedPrisma.interviewSession.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.interviewSession.findFirst).not.toHaveBeenCalled();
  });

  it('loadValidatedInterviewStartContext 達每日限額時應拋 RATE_LIMIT_EXCEEDED 並不查 in-progress', async () => {
    mockedSystemConfig.getNumberConfig.mockImplementation(async (key: string, fallback: number) => {
      if (key === 'interview.dailySessionLimit') return 1;
      return fallback;
    });
    mockedPrisma.user.findUnique.mockResolvedValue({ psych_consent_given: true });
    mockedPrisma.interviewSession.findMany.mockResolvedValue([
      { created_at: new Date().toISOString(), _count: { turns: 3 } },
    ]);

    await expect(loadValidatedInterviewStartContext('u1')).rejects.toThrow('今日開始訪談次數已達上限');

    expect(mockedPrisma.interviewSession.findFirst).not.toHaveBeenCalled();
  });

  it('loadValidatedInterviewStartContext 應返回 runtimeConfig 與既有 in-progress session', async () => {
    const inProgress = {
      id: 's1',
      turns: [{ id: 't1' }],
    };
    mockedPrisma.user.findUnique.mockResolvedValue({ psych_consent_given: true });
    mockedPrisma.interviewSession.findMany.mockResolvedValue([
      { created_at: new Date().toISOString(), _count: { turns: 2 } },
    ]);
    mockedPrisma.interviewSession.findFirst.mockResolvedValue(inProgress);

    await expect(loadValidatedInterviewStartContext('u1')).resolves.toEqual({
      runtimeConfig: {
        maxTurns: 30,
        softTarget: 10,
        turnIntervalMs: 0,
        startRateLimit: 2,
        dailySessionLimit: 2,
      },
      inProgress,
    });

    expect(mockedPrisma.interviewSession.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'u1',
        created_at: { gte: expect.any(String) },
        status: { notIn: [INTERVIEW_STATUS.ABANDONED] },
      },
      include: { _count: { select: { turns: true } } },
    });
    expect(mockedPrisma.interviewSession.findFirst).toHaveBeenCalledWith({
      where: { user_id: 'u1', status: INTERVIEW_STATUS.IN_PROGRESS },
      include: { turns: true },
    });
  });
});
