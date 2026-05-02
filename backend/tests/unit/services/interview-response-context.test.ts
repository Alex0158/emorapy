import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PsychDomain } from '@prisma/client';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewTurn: {
      update: jest.fn(),
    },
    interviewSession: {
      update: jest.fn(),
    },
    profileInsight: {
      findMany: jest.fn(),
    },
    profileNarrative: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../../src/config/database';
import { prepareInterviewResponseContext } from '../../../src/services/interview-response-context';

describe('interview-response-context', () => {
  const mockedPrisma = prisma as any;
  const runtimeConfig = {
    maxTurns: 30,
    softTarget: 10,
    turnIntervalMs: 0,
    startRateLimit: 3,
    dailySessionLimit: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.interviewTurn.update.mockResolvedValue({});
    mockedPrisma.interviewSession.update.mockResolvedValue({});
    mockedPrisma.profileInsight.findMany.mockResolvedValue([]);
    mockedPrisma.profileNarrative.findMany.mockResolvedValue([]);
  });

  function buildSession(overrides: Record<string, unknown> = {}) {
    return {
      id: 's1',
      user_id: 'u1',
      status: 'in_progress',
      domains_touched: [PsychDomain.personality],
      collected_facts: ['用戶來自澳門'],
      turns: [
        {
          id: 't1',
          ai_message: '第一問',
          user_response: '第一答',
          ai_intent: 'opening',
          extracted_facts: ['舊事實'],
        },
        {
          id: 't2',
          ai_message: '最近過得如何？',
          user_response: null,
          ai_intent: 'deepening',
          extracted_facts: [],
        },
      ],
      ...overrides,
    } as any;
  }

  it('prepareInterviewResponseContext 應落庫用戶回覆並建立 system/user prompt context', async () => {
    mockedPrisma.profileInsight.findMany.mockResolvedValue([
      {
        domain: PsychDomain.personality,
        key: 'MBTI',
        value: 'ENTP',
        confidence: 0.8,
      },
    ]);
    mockedPrisma.profileNarrative.findMany.mockResolvedValue([
      {
        domain: PsychDomain.personality,
        ai_summary: '用戶常透過理性分析處理壓力',
        completeness: 0.8,
      },
    ]);
    const session = buildSession();

    const result = await prepareInterviewResponseContext({
      sessionId: 's1',
      userId: 'u1',
      userResponse: '  我最近壓力很大  ',
      isSkip: false,
      runtimeConfig,
      session,
      lastTurn: session.turns[1],
    });

    expect(result).toMatchObject({
      sanitizedResponse: '我最近壓力很大',
      wordCount: 1,
      session,
      nextOrder: 3,
      currentTurn: 2,
      collectedFacts: ['用戶來自澳門'],
    });
    expect(mockedPrisma.interviewTurn.update).toHaveBeenCalledWith({
      where: { id: 't2' },
      data: {
        user_response: '我最近壓力很大',
        response_word_count: 1,
        skipped: false,
      },
    });
    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { total_user_words: { increment: 1 } },
    });
    expect(result.systemPrompt).toContain('MBTI — ENTP（80%）');
    expect(result.systemPrompt).toContain('用戶常透過理性分析處理壓力');
    expect(result.systemPrompt).toContain('- 用戶來自澳門');
    expect(result.userPrompt).toContain('第2輪');
    expect(result.userPrompt).toContain('\n  我最近壓力很大  \n</user_input>');
  });

  it('prepareInterviewResponseContext 歷史洞見讀取失敗時應回落空 context 並回報錯誤', async () => {
    const previousContextError = new Error('profile store down');
    const onPreviousContextError = jest.fn();
    mockedPrisma.profileInsight.findMany.mockRejectedValue(previousContextError);
    mockedPrisma.profileNarrative.findMany.mockResolvedValue([]);
    const session = buildSession({ collected_facts: [] });

    const result = await prepareInterviewResponseContext({
      sessionId: 's1',
      userId: 'u1',
      userResponse: '',
      isSkip: true,
      runtimeConfig,
      session,
      lastTurn: session.turns[1],
      onPreviousContextError,
    });

    expect(result.sanitizedResponse).toBe('');
    expect(result.wordCount).toBe(0);
    expect(result.systemPrompt).toContain('（首次對話，尚無已知背景）');
    expect(onPreviousContextError).toHaveBeenCalledWith(previousContextError);
    expect(mockedPrisma.interviewSession.update).not.toHaveBeenCalled();
  });
});
