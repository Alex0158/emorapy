import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PsychDomain } from '@prisma/client';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewTurn: { create: jest.fn() },
    interviewSession: { update: jest.fn() },
  },
}));

import prisma from '../../../src/config/database';
import { persistInterviewAIResponse } from '../../../src/services/interview-response-persistence';

const baseParams = {
  sessionId: 's1',
  nextOrder: 2,
  text: 'AI 回覆 內容',
  parsedMeta: {
    intent: 'deepening',
    safety_flag: true,
    safety_message: '安全提醒',
  },
  targetDomains: [PsychDomain.personality],
  fallbackDomains: [PsychDomain.attachment],
  newFacts: ['新事實'],
  newDomains: [PsychDomain.attachment, PsychDomain.personality],
  aiWordCount: 3,
  updatedCollectedFacts: ['既有事實', '新事實'],
};

describe('interview-response-persistence', () => {
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persistInterviewAIResponse 應先建立 AI turn，再更新 session 派生欄位', async () => {
    mockedPrisma.interviewTurn.create.mockResolvedValue({ id: 'turn-ai-2' });
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await expect(persistInterviewAIResponse(baseParams)).resolves.toEqual({
      createdTurn: { id: 'turn-ai-2' },
    });

    expect(mockedPrisma.interviewTurn.create).toHaveBeenCalledWith({
      data: {
        session_id: 's1',
        turn_order: 2,
        ai_message: 'AI 回覆 內容',
        ai_intent: 'deepening',
        ai_target_domains: [PsychDomain.personality],
        extracted_facts: ['新事實'],
        safety_flag: true,
        safety_detail: '安全提醒',
      },
    });
    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: {
        domains_touched: [PsychDomain.attachment, PsychDomain.personality],
        total_ai_words: { increment: 3 },
        collected_facts: ['既有事實', '新事實'],
      },
    });
    expect(
      mockedPrisma.interviewTurn.create.mock.invocationCallOrder[0]
    ).toBeLessThan(mockedPrisma.interviewSession.update.mock.invocationCallOrder[0]);
  });

  it('persistInterviewAIResponse 無新事實時不應覆寫 collected_facts，並回退既有 domains', async () => {
    mockedPrisma.interviewTurn.create.mockResolvedValue({ id: 'turn-ai-2' });
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await persistInterviewAIResponse({
      ...baseParams,
      parsedMeta: {},
      targetDomains: [],
      newFacts: [],
      updatedCollectedFacts: ['既有事實'],
    });

    expect(mockedPrisma.interviewTurn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ai_intent: undefined,
        ai_target_domains: [PsychDomain.attachment],
        extracted_facts: [],
        safety_flag: false,
        safety_detail: undefined,
      }),
    });
    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: {
        domains_touched: [PsychDomain.attachment, PsychDomain.personality],
        total_ai_words: { increment: 3 },
      },
    });
  });

  it('persistInterviewAIResponse 建立 turn 失敗時應拋回原錯且不更新 session', async () => {
    const writeError = new Error('turn create failed');
    mockedPrisma.interviewTurn.create.mockRejectedValue(writeError);
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await expect(persistInterviewAIResponse(baseParams)).rejects.toBe(writeError);

    expect(mockedPrisma.interviewSession.update).not.toHaveBeenCalled();
  });

  it('persistInterviewAIResponse 更新 session 失敗時應拋回原錯', async () => {
    const writeError = new Error('session update failed');
    mockedPrisma.interviewTurn.create.mockResolvedValue({ id: 'turn-ai-2' });
    mockedPrisma.interviewSession.update.mockRejectedValue(writeError);

    await expect(persistInterviewAIResponse(baseParams)).rejects.toBe(writeError);

    expect(mockedPrisma.interviewTurn.create).toHaveBeenCalled();
    expect(mockedPrisma.interviewSession.update).toHaveBeenCalled();
  });
});
