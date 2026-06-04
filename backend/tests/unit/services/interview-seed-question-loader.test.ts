import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PsychDomain } from '@prisma/client';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    profileInsight: { findMany: jest.fn() },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn() },
}));

jest.mock('../../../src/types/interview.types', () => ({
  __esModule: true,
  getSeedQuestion: jest.fn(() => '基礎首題'),
}));

import prisma from '../../../src/config/database';
import logger from '../../../src/config/logger';
import { getSeedQuestion } from '../../../src/types/interview.types';
import { loadPersonalizedInterviewSeedQuestion } from '../../../src/services/interview-seed-question-loader';

describe('interview-seed-question-loader', () => {
  const mockedPrisma = prisma as any;
  const mockedLogger = logger as any;
  const mockedGetSeedQuestion = getSeedQuestion as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetSeedQuestion.mockReturnValue('基礎首題');
  });

  it('loadPersonalizedInterviewSeedQuestion 應使用既有查詢條件並返回個人化首題', async () => {
    mockedPrisma.profileInsight.findMany.mockResolvedValue([
      {
        domain: PsychDomain.personality,
        insight_type: 'preference',
        key: '性格',
        value: '喜歡探索',
        confidence: 0.91,
      },
    ]);

    await expect(loadPersonalizedInterviewSeedQuestion('u1', 'organic')).resolves.toBe(
      '嗨，歡迎回來。上次聊天裡我對你的一個印象是：性格：喜歡探索。如果你願意，想先從這件事最近在你生活裡的變化聊起嗎？'
    );

    expect(mockedGetSeedQuestion).toHaveBeenCalledWith('organic', 'zh-TW');
    expect(mockedPrisma.profileInsight.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'u1',
        is_active: true,
        confidence: { gte: 0.7 },
      },
      select: {
        domain: true,
        insight_type: true,
        key: true,
        value: true,
        confidence: true,
      },
      orderBy: { confidence: 'desc' },
      take: 12,
    });
    expect(mockedLogger.debug).not.toHaveBeenCalled();
  });

  it('loadPersonalizedInterviewSeedQuestion 沒有安全 hint 時應回基礎首題', async () => {
    mockedPrisma.profileInsight.findMany.mockResolvedValue([
      {
        domain: PsychDomain.attachment,
        insight_type: 'risk',
        key: '風險',
        value: '曾提到自傷念頭',
        confidence: 0.95,
      },
    ]);

    await expect(loadPersonalizedInterviewSeedQuestion('u1', 'pre_case')).resolves.toBe('基礎首題');

    expect(mockedGetSeedQuestion).toHaveBeenCalledWith('pre_case', 'zh-TW');
    expect(mockedLogger.debug).not.toHaveBeenCalled();
  });

  it('loadPersonalizedInterviewSeedQuestion 查詢失敗時應 debug 並回基礎首題', async () => {
    const queryError = new Error('profileInsight unavailable');
    mockedPrisma.profileInsight.findMany.mockRejectedValue(queryError);

    await expect(loadPersonalizedInterviewSeedQuestion('u1', 'onboarding')).resolves.toBe('基礎首題');

    expect(mockedGetSeedQuestion).toHaveBeenCalledWith('onboarding', 'zh-TW');
    expect(mockedLogger.debug).toHaveBeenCalledWith(
      'Non-critical: failed to build personalized seed',
      { userId: 'u1', error: queryError }
    );
  });

  it('loadPersonalizedInterviewSeedQuestion 應按 en-US 產生英文個人化首題', async () => {
    mockedGetSeedQuestion.mockReturnValue('What would you like to talk about today?');
    mockedPrisma.profileInsight.findMany.mockResolvedValue([
      {
        domain: PsychDomain.personality,
        insight_type: 'preference',
        key: 'personality',
        value: 'likes exploring',
        confidence: 0.91,
      },
    ]);

    await expect(loadPersonalizedInterviewSeedQuestion('u1', 'organic', 'en-US')).resolves.toBe(
      'Hi, welcome back. One impression I kept from our last conversation is: personality：likes exploring. If you are willing, would you like to start with how this has been showing up in your life recently?'
    );

    expect(mockedGetSeedQuestion).toHaveBeenCalledWith('organic', 'en-US');
  });
});
