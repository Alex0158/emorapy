/**
 * PsychProfileService 單元測試 — consent、getProfile、getFeedbackHistory、deleteAllData
 */
// @ts-nocheck
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockUserFindUnique = jest.fn();
const mockProfileNarrativeFindMany = jest.fn();
const mockProfileInsightFindMany = jest.fn();
const mockInterviewSessionFindMany = jest.fn();
const mockUserUpdate = jest.fn();
const mockProfileInsightDeleteMany = jest.fn();
const mockProfileNarrativeDeleteMany = jest.fn();
const mockInterviewTurnDeleteMany = jest.fn();
const mockInterviewSessionDeleteMany = jest.fn();
const mockTransaction = jest.fn();

const prismaMock = {
  user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
  profileNarrative: { findMany: mockProfileNarrativeFindMany, deleteMany: mockProfileNarrativeDeleteMany },
  profileInsight: { findMany: mockProfileInsightFindMany, deleteMany: mockProfileInsightDeleteMany },
  interviewSession: { findMany: mockInterviewSessionFindMany, deleteMany: mockInterviewSessionDeleteMany },
  interviewTurn: { deleteMany: mockInterviewTurnDeleteMany },
  $transaction: mockTransaction,
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

const mockCalculateRichness = jest.fn();
jest.mock('../../../src/services/profile-richness.service', () => ({
  __esModule: true,
  profileRichnessService: { calculateRichness: (userId: string) => mockCalculateRichness(userId) },
}));

import { psychProfileService } from '../../../src/services/psych-profile.service';

beforeEach(() => {
  jest.clearAllMocks();
  mockCalculateRichness.mockResolvedValue(0.5);
});

describe('PsychProfileService — giveConsent', () => {
  it('應成功更新 user.psych_consent_given 與 psych_consent_at', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u1' });
    mockUserUpdate.mockResolvedValue({ id: 'u1', psych_consent_given: true });
    await psychProfileService.giveConsent('u1');
    expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { id: 'u1' }, select: { id: true } });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({
        psych_consent_given: true,
        psych_consent_at: expect.any(Date),
      }),
    });
  });

  it('userId 不存在時應拋出 NOT_FOUND', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await expect(psychProfileService.giveConsent('nonexistent')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: expect.stringContaining('用戶不存在'),
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

describe('PsychProfileService — getProfile', () => {
  it('應返回 consent、narratives、insights、richness_score', async () => {
    mockUserFindUnique.mockResolvedValue({
      psych_consent_given: true,
      psych_consent_at: new Date('2026-01-01'),
    });
    mockProfileNarrativeFindMany.mockResolvedValue([
      { id: 'n1', domain: 'personality', ai_summary: 'test', completeness: 0.8, is_latest: true },
    ]);
    mockProfileInsightFindMany.mockResolvedValue([
      { id: 'i1', domain: 'personality', insight_type: 'trait', key: 'key', value: 'val', confidence: 0.9, is_active: true },
    ]);
    mockCalculateRichness.mockResolvedValue(0.65);

    const result = await psychProfileService.getProfile('u1');

    expect(result).toMatchObject({
      consent_given: true,
      consent_at: '2026-01-01T00:00:00.000Z',
      narratives: expect.any(Array),
      insights: expect.any(Array),
      richness_score: 0.65,
    });
    expect(result.narratives).toHaveLength(1);
    expect(result.insights).toHaveLength(1);
  });

  it('無敘事與洞見時應返回 narratives、insights 空陣列（F06 邊界）', async () => {
    mockUserFindUnique.mockResolvedValue({
      psych_consent_given: false,
      psych_consent_at: null,
    });
    mockProfileNarrativeFindMany.mockResolvedValue([]);
    mockProfileInsightFindMany.mockResolvedValue([]);
    mockCalculateRichness.mockResolvedValue(0);

    const result = await psychProfileService.getProfile('u1');

    expect(result.narratives).toEqual([]);
    expect(result.insights).toEqual([]);
    expect(result.richness_score).toBe(0);
  });

  it('userId 不存在時應拋出 NOT_FOUND', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await expect(psychProfileService.getProfile('nonexistent')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: expect.stringContaining('用戶不存在'),
    });
  });

  it('consent_at 為 null 時應返回 null', async () => {
    mockUserFindUnique.mockResolvedValue({ psych_consent_given: false, psych_consent_at: null });
    mockProfileNarrativeFindMany.mockResolvedValue([]);
    mockProfileInsightFindMany.mockResolvedValue([]);
    const result = await psychProfileService.getProfile('u1');
    expect(result.consent_at).toBeNull();
    expect(result.consent_given).toBe(false);
  });
});

describe('PsychProfileService — getFeedbackHistory', () => {
  it('應返回 history 陣列', async () => {
    mockInterviewSessionFindMany.mockResolvedValue([
      {
        id: 's1',
        feedback_card: { summary: 'ok' },
        domains_touched: ['personality'],
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const result = await psychProfileService.getFeedbackHistory('u1');

    expect(result).toMatchObject({ history: expect.any(Array) });
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({
      session_id: 's1',
      feedback_card: { summary: 'ok' },
      domains_touched: ['personality'],
    });
  });

  it('無 COMPLETED 且 feedback_card 非空 session 時應返回空陣列', async () => {
    mockInterviewSessionFindMany.mockResolvedValue([]);
    const result = await psychProfileService.getFeedbackHistory('u1');
    expect(result.history).toEqual([]);
  });
});

describe('PsychProfileService — deleteAllData', () => {
  it('應清除 narratives、insights、turns、sessions 並重置 consent', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u1' });
    mockTransaction.mockResolvedValue(undefined);

    await psychProfileService.deleteAllData('u1');

    expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { id: 'u1' }, select: { id: true } });
    expect(mockTransaction).toHaveBeenCalled();
    const txArg = mockTransaction.mock.calls[0][0] as unknown[];
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg.length).toBeGreaterThanOrEqual(5);
  });

  it('userId 不存在時應拋出 NOT_FOUND', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await expect(psychProfileService.deleteAllData('nonexistent')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: expect.stringContaining('用戶不存在'),
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
