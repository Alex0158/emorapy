/**
 * 判決工具測試
 */

import { normalizeJudgment } from '../../../src/utils/judgment';

describe('judgment utils', () => {
  describe('normalizeJudgment', () => {
    it('應對 null 返回 null', () => {
      expect(normalizeJudgment(null)).toBe(null);
    });

    it('應補充 responsibility_ratio 當僅有 plaintiff_ratio/defendant_ratio', () => {
      const input = {
        id: '1',
        plaintiff_ratio: 60,
        defendant_ratio: 40,
      };
      const result = normalizeJudgment(input);
      expect(result.responsibility_ratio).toEqual({
        plaintiff: 60,
        defendant: 40,
      });
    });

    it('應保留原有 responsibility_ratio 若已存在', () => {
      const input = {
        id: '1',
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        responsibility_ratio: { plaintiff: 50, defendant: 50 },
      };
      const result = normalizeJudgment(input);
      expect(result).toEqual({
        id: '1',
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        responsibility_ratio: { plaintiff: 50, defendant: 50 },
      });
    });

    it('應保留其他字段', () => {
      const input = {
        id: '1',
        summary: 'test',
        plaintiff_ratio: 70,
        defendant_ratio: 30,
      };
      const result = normalizeJudgment(input);
      expect(result.id).toBe('1');
      expect(result.summary).toBe('test');
    });

    it('應移除 emotional_analysis 內部欄位', () => {
      const input = {
        id: '1',
        plaintiff_ratio: 55,
        defendant_ratio: 45,
        emotional_analysis: {
          severity: 'moderate',
          interactionCycle: '追-逃循環',
          coreIssue: '核心問題',
        },
      };
      const result = normalizeJudgment(input);
      expect(result.responsibility_ratio).toEqual({ plaintiff: 55, defendant: 45 });
      expect((result as Record<string, unknown>).emotional_analysis).toBeUndefined();
    });

    it('emotional_analysis 為 null 時也應安全移除', () => {
      const input = {
        id: '1',
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        emotional_analysis: null,
      };
      const result = normalizeJudgment(input);
      expect((result as Record<string, unknown>).emotional_analysis).toBeUndefined();
    });

    it('不應修改原始物件', () => {
      const input = {
        id: '1',
        plaintiff_ratio: 60,
        defendant_ratio: 40,
        emotional_analysis: { severity: 'mild' },
      };
      normalizeJudgment(input);
      expect(input.emotional_analysis).toEqual({ severity: 'mild' });
    });
  });
});
