/**
 * 判決工具測試
 */

import { normalizeJudgment } from '../../../src/utils/judgment';

describe('judgment utils', () => {
  describe('normalizeJudgment', () => {
    it('應對 null/undefined 返回原值', () => {
      expect(normalizeJudgment(null)).toBe(null);
      expect(normalizeJudgment(undefined)).toBe(undefined);
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
      expect(result).toBe(input);
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
  });
});
