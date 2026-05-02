import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../src/config/env', () => ({
  env: {
    INTERVIEW_MAX_TURNS: 30,
    INTERVIEW_SOFT_TARGET: 10,
    INTERVIEW_TURN_INTERVAL_MS: 0,
    INTERVIEW_START_RATE_LIMIT: 3,
    INTERVIEW_DAILY_SESSION_LIMIT: 5,
  },
}));

jest.mock('../../../src/services/system-config.service', () => ({
  __esModule: true,
  systemConfigService: { getNumberConfig: jest.fn() },
}));

import { systemConfigService } from '../../../src/services/system-config.service';
import { loadRuntimeInterviewConfig } from '../../../src/services/interview-runtime-config';

describe('interview-runtime-config', () => {
  const mockedSystemConfig = systemConfigService as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedSystemConfig.getNumberConfig.mockImplementation(async (_key: string, fallback: number) => fallback);
  });

  it('loadRuntimeInterviewConfig 應讀取所有 runtime config 並套用 env fallback', async () => {
    await expect(loadRuntimeInterviewConfig()).resolves.toEqual({
      maxTurns: 30,
      softTarget: 10,
      turnIntervalMs: 0,
      startRateLimit: 3,
      dailySessionLimit: 5,
    });

    expect(mockedSystemConfig.getNumberConfig).toHaveBeenCalledWith('interview.maxTurns', 30);
    expect(mockedSystemConfig.getNumberConfig).toHaveBeenCalledWith('interview.softTarget', 10);
    expect(mockedSystemConfig.getNumberConfig).toHaveBeenCalledWith('interview.turnIntervalMs', 0);
    expect(mockedSystemConfig.getNumberConfig).toHaveBeenCalledWith('interview.startRateLimit', 3);
    expect(mockedSystemConfig.getNumberConfig).toHaveBeenCalledWith('interview.dailySessionLimit', 5);
  });

  it('loadRuntimeInterviewConfig 應對非法小值做既有 floor/clamp', async () => {
    mockedSystemConfig.getNumberConfig.mockImplementation(async (key: string, fallback: number) => {
      const values: Record<string, number> = {
        'interview.maxTurns': 0.8,
        'interview.softTarget': -2,
        'interview.turnIntervalMs': -100,
        'interview.startRateLimit': 0,
        'interview.dailySessionLimit': 0.1,
      };
      return values[key] ?? fallback;
    });

    await expect(loadRuntimeInterviewConfig()).resolves.toEqual({
      maxTurns: 1,
      softTarget: 1,
      turnIntervalMs: 0,
      startRateLimit: 1,
      dailySessionLimit: 1,
    });
  });
});
