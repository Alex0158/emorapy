import { PsychDomain } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  interviewSession: { findUnique: jest.fn() },
  profileInsight: { findMany: jest.fn() },
};
const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockCalculateRichness = jest.fn<(userId: string) => Promise<number>>();
const mockGenerateText = jest.fn<(prompt: string, options: unknown) => Promise<string>>();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: loggerMock,
}));
jest.mock('../../../src/services/profile-richness.service', () => ({
  profileRichnessService: {
    calculateRichness: (userId: string) => mockCalculateRichness(userId),
  },
}));
jest.mock('../../../src/services/ai.service', () => ({
  aiService: {
    generateText: (prompt: string, options: unknown) => mockGenerateText(prompt, options),
  },
}));

import { generatePipelineFeedbackCard } from '../../../src/services/async-pipeline-feedback-card';

describe('generatePipelineFeedbackCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.interviewSession.findUnique.mockResolvedValue({
      id: 'session-1',
      domains_touched: [PsychDomain.attachment, PsychDomain.life_events],
      turns: [{ id: 'turn-1' }, { id: 'turn-2' }, { id: 'turn-3' }],
    });
    prismaMock.profileInsight.findMany.mockResolvedValue([
      { value: '看重穩定連結' },
      { value: '會主動修復關係' },
      { value: '對界線很敏感' },
      { value: '第四筆不應進入卡片' },
    ]);
    mockCalculateRichness.mockResolvedValue(0.72);
    mockGenerateText.mockResolvedValue('  你願意談起親密關係與重要經歷，這些分享很有重量。謝謝你信任這個過程。  ');
  });

  it('AI 成功時應產生完整 feedback card 並保留核心欄位', async () => {
    const result = await generatePipelineFeedbackCard({
      userId: 'user-1',
      sessionId: 'session-1',
    });

    const card = JSON.parse(result);
    expect(card).toEqual({
      summary: '你願意談起親密關係與重要經歷，這些分享很有重量。謝謝你信任這個過程。',
      domains_explored: [PsychDomain.attachment, PsychDomain.life_events],
      domains_unexplored: [
        PsychDomain.family_origin,
        PsychDomain.relationship_history,
        PsychDomain.belief_values,
        PsychDomain.cultural_background,
        PsychDomain.personality,
        PsychDomain.education_cognition,
      ],
      key_insights: ['看重穩定連結', '會主動修復關係', '對界線很敏感'],
      richness_score: 0.72,
      encouragement: '你今天分享的每一段故事，都讓我們更懂得如何陪伴你。謝謝你的信任。',
      continuation_hint: '下次我們可以聊聊原生家庭、感情經歷、價值觀與信念的部分，讓我更完整地認識你。',
    });
    expect(prismaMock.interviewSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      include: { turns: true },
    });
    expect(prismaMock.profileInsight.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1', is_active: true },
      orderBy: { confidence: 'desc' },
      take: 5,
    });
    expect(mockCalculateRichness).toHaveBeenCalledWith('user-1');
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.stringContaining('共進行了 3 輪對話'),
      expect.objectContaining({
        maxTokens: 300,
        temperature: 0.7,
        systemPrompt: '你是一位溫暖的關係諮詢師，善於給予簡潔而有力的鼓勵回饋。',
      })
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.stringContaining('整體情況：用戶分享了很多面向，資料相當豐富'),
      expect.any(Object)
    );
  });

  it('AI 摘要失敗時應返回 fallback card 並保留已探索與未探索面向', async () => {
    prismaMock.interviewSession.findUnique.mockResolvedValue({
      id: 'session-1',
      domains_touched: [
        PsychDomain.attachment,
        PsychDomain.family_origin,
        PsychDomain.life_events,
        PsychDomain.relationship_history,
        PsychDomain.belief_values,
        PsychDomain.cultural_background,
        PsychDomain.personality,
        PsychDomain.education_cognition,
      ],
      turns: [{ id: 'turn-1' }],
    });
    mockCalculateRichness.mockResolvedValue(0.35);
    mockGenerateText.mockRejectedValue(new Error('AI unavailable'));

    const result = await generatePipelineFeedbackCard({
      userId: 'user-1',
      sessionId: 'session-1',
    });

    const card = JSON.parse(result);
    expect(card).toEqual({
      summary: '感謝你今天花時間和我們聊天，你分享的每一句話都是有意義的。',
      domains_explored: [
        PsychDomain.attachment,
        PsychDomain.family_origin,
        PsychDomain.life_events,
        PsychDomain.relationship_history,
        PsychDomain.belief_values,
        PsychDomain.cultural_background,
        PsychDomain.personality,
        PsychDomain.education_cognition,
      ],
      domains_unexplored: [],
      key_insights: [],
      richness_score: 0.35,
      encouragement: '每一次願意打開自己的對話，都是認識自己的好開始。我們下次再聊。',
      continuation_hint: '你已經分享了所有面向的故事，這真的很了不起。下次可以更深入聊聊你特別在意的部分。',
    });
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.stringContaining('整體情況：這是一個初步的開始，用戶還在慢慢打開自己'),
      expect.any(Object)
    );
    expect(loggerMock.warn).toHaveBeenCalledWith('Feedback card AI failed, using fallback', {
      sessionId: 'session-1',
      userId: 'user-1',
      error: expect.any(Error),
    });
  });
});
