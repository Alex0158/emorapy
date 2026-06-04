import { describe, expect, it } from '@jest/globals';
import { PsychDomain } from '@prisma/client';
import {
  buildPersonalizedSeedQuestion,
  buildSeedInsightHints,
  isSafeSeedInsight,
  sanitizeSeedInsightValue,
  type InterviewSeedInsight,
} from '../../../src/services/interview-seed-question-utils';

function seedInsight(overrides: Partial<InterviewSeedInsight> = {}): InterviewSeedInsight {
  return {
    domain: PsychDomain.personality,
    insight_type: 'preference',
    key: '性格',
    value: '喜歡探索',
    ...overrides,
  };
}

describe('interview-seed-question-utils', () => {
  it('sanitizeSeedInsightValue 應壓縮空白、移除引號並限制長度', () => {
    const result = sanitizeSeedInsightValue('  「喜歡   探索」 `新的可能` "也重視自由"  '.repeat(3));
    expect(result).not.toContain('「');
    expect(result).not.toContain('」');
    expect(result).not.toContain('"');
    expect(result).not.toContain('`');
    expect(result).toHaveLength(48);
    expect(result.startsWith('喜歡 探索 新的可能 也重視自由')).toBe(true);
  });

  it('isSafeSeedInsight 應排除 risk/trigger 與危險訊號', () => {
    expect(isSafeSeedInsight(seedInsight())).toBe(true);
    expect(isSafeSeedInsight(seedInsight({ insight_type: 'risk' }))).toBe(false);
    expect(isSafeSeedInsight(seedInsight({ insight_type: 'trigger' }))).toBe(false);
    expect(isSafeSeedInsight(seedInsight({ value: '曾經提到自傷念頭' }))).toBe(false);
    expect(isSafeSeedInsight(seedInsight({ key: '創傷經歷' }))).toBe(false);
  });

  it('isSafeSeedInsight 只允許既有低風險 seed domains', () => {
    expect(isSafeSeedInsight(seedInsight({ domain: PsychDomain.personality }))).toBe(true);
    expect(isSafeSeedInsight(seedInsight({ domain: PsychDomain.belief_values }))).toBe(true);
    expect(isSafeSeedInsight(seedInsight({ domain: PsychDomain.education_cognition }))).toBe(true);
    expect(isSafeSeedInsight(seedInsight({ domain: PsychDomain.cultural_background }))).toBe(true);
    expect(isSafeSeedInsight(seedInsight({ domain: PsychDomain.relationship_history }))).toBe(true);
    expect(isSafeSeedInsight(seedInsight({ domain: PsychDomain.life_events }))).toBe(true);
    expect(isSafeSeedInsight(seedInsight({ domain: PsychDomain.attachment }))).toBe(false);
    expect(isSafeSeedInsight(seedInsight({ domain: PsychDomain.family_origin }))).toBe(false);
  });

  it('buildSeedInsightHints 應保留排序、最多三個，並套用 value 清洗', () => {
    const hints = buildSeedInsightHints([
      seedInsight({ key: 'A', value: '「一」' }),
      seedInsight({ key: 'B', value: '二' }),
      seedInsight({ key: 'C', value: '三' }),
      seedInsight({ key: 'D', value: '四' }),
      seedInsight({ key: 'risk', insight_type: 'risk', value: '不應出現' }),
    ]);

    expect(hints).toEqual(['A：一', 'B：二', 'C：三']);
  });

  it('buildPersonalizedSeedQuestion 無 hints 時保留原首題，有 hints 時使用第一個 hint', () => {
    const base = '今天想從哪裡開始聊？';
    expect(buildPersonalizedSeedQuestion(base, [])).toBe(base);
    expect(buildPersonalizedSeedQuestion(base, ['A：一', 'B：二'])).toBe(
      '嗨，歡迎回來。上次聊天裡我對你的一個印象是：A：一。如果你願意，想先從這件事最近在你生活裡的變化聊起嗎？'
    );
    expect(buildPersonalizedSeedQuestion('Where would you like to begin?', ['personality：curious'], 'en-US')).toBe(
      'Hi, welcome back. One impression I kept from our last conversation is: personality：curious. If you are willing, would you like to start with how this has been showing up in your life recently?'
    );
  });
});
