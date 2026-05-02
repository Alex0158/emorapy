import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    profileInsight: { findMany: jest.fn() },
    profileNarrative: { findMany: jest.fn() },
  },
}));

import prisma from '../../../src/config/database';
import {
  buildInterviewPreviousContext,
  EMPTY_INTERVIEW_PREVIOUS_CONTEXT,
  formatInterviewPreviousInsights,
  formatInterviewPreviousNarrativeHints,
  loadInterviewPreviousContext,
} from '../../../src/services/interview-previous-context-utils';

describe('interview-previous-context-utils', () => {
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('EMPTY_INTERVIEW_PREVIOUS_CONTEXT 應維持空 prompt context', () => {
    expect(EMPTY_INTERVIEW_PREVIOUS_CONTEXT).toEqual({
      previousInsights: '',
      previousNarrativeHints: '',
    });
  });

  it('formatInterviewPreviousInsights 應保留排序並格式化信心分數', () => {
    expect(formatInterviewPreviousInsights([])).toBe('');
    expect(
      formatInterviewPreviousInsights([
        { domain: 'attachment', key: '依附', value: '傾向安全型', confidence: 0.856 },
        { domain: 'personality', key: '表達', value: '偏理性分析', confidence: 0.5 },
      ])
    ).toBe('- attachment：依附 — 傾向安全型（86%）\n- personality：表達 — 偏理性分析（50%）');
  });

  it('formatInterviewPreviousNarrativeHints 應過濾低完整度/空摘要，最多輸出三條並截斷摘要', () => {
    const longSummary = 'a'.repeat(130);

    expect(
      formatInterviewPreviousNarrativeHints([
        { domain: 'attachment', ai_summary: '  安全依附脈絡  ', completeness: 0.8 },
        { domain: 'family_origin', ai_summary: '', completeness: 0.9 },
        { domain: 'life_events', ai_summary: '完整度太低', completeness: 0.24 },
        { domain: 'personality', ai_summary: longSummary, completeness: 0.25 },
        { domain: 'belief_values', ai_summary: '價值觀摘要', completeness: 0.6 },
        { domain: 'relationship_history', ai_summary: '第四條不應出現', completeness: 0.7 },
      ])
    ).toBe(
      `- attachment：安全依附脈絡\n- personality：${'a'.repeat(120)}\n- belief_values：價值觀摘要`
    );
  });

  it('buildInterviewPreviousContext 應組合 insights 與 narrative hints', () => {
    expect(
      buildInterviewPreviousContext({
        insights: [{ domain: 'attachment', key: '依附', value: '穩定', confidence: 0.9 }],
        narratives: [{ domain: 'personality', ai_summary: '偏向理性分析', completeness: 0.5 }],
      })
    ).toEqual({
      previousInsights: '- attachment：依附 — 穩定（90%）',
      previousNarrativeHints: '- personality：偏向理性分析',
    });
  });

  it('loadInterviewPreviousContext 應使用既有查詢條件並回傳格式化 context', async () => {
    mockedPrisma.profileInsight.findMany.mockResolvedValue([
      { domain: 'attachment', key: '依附', value: '穩定', confidence: 0.9 },
    ]);
    mockedPrisma.profileNarrative.findMany.mockResolvedValue([
      { domain: 'personality', ai_summary: '偏向理性分析', completeness: 0.5 },
    ]);

    await expect(loadInterviewPreviousContext('u1')).resolves.toEqual({
      previousInsights: '- attachment：依附 — 穩定（90%）',
      previousNarrativeHints: '- personality：偏向理性分析',
    });
    expect(mockedPrisma.profileInsight.findMany).toHaveBeenCalledWith({
      where: { user_id: 'u1', is_active: true, confidence: { gte: 0.5 } },
      select: { domain: true, key: true, value: true, confidence: true },
      orderBy: { confidence: 'desc' },
      take: 15,
    });
    expect(mockedPrisma.profileNarrative.findMany).toHaveBeenCalledWith({
      where: { user_id: 'u1', is_latest: true },
      select: { domain: true, ai_summary: true, completeness: true },
      orderBy: { completeness: 'desc' },
      take: 4,
    });
  });
});
