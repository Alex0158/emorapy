/**
 * 判決工具測試
 */

import { normalizeJudgment } from '../../../src/utils/judgment';

describe('judgment utils', () => {
  describe('normalizeJudgment', () => {
    it('應對 null 返回 null', () => {
      expect(normalizeJudgment(null)).toBe(null);
    });

    it('應對 undefined 返回 null（邊界：防禦性）', () => {
      expect(normalizeJudgment(undefined as unknown as null)).toBe(null);
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

    it('應從 emotional_analysis 暴露非診斷性的 judgment_route 並移除原始內部欄位', () => {
      const input = {
        id: '1',
        plaintiff_ratio: 20,
        defendant_ratio: 80,
        emotional_analysis: {
          route: 'safety_support',
          severity: 'serious',
          coreIssue: 'internal clinical note',
        },
      };
      const result = normalizeJudgment(input);
      expect(result.judgment_route).toBe('safety_support');
      expect(result.responsibility_ratio_visibility).toEqual({
        can_show: false,
        reason: '安全支持路由不得展示責任比例，避免把安全風險對稱化',
      });
      expect((result as Record<string, unknown>).emotional_analysis).toBeUndefined();
    });

    it('standard route 應標記責任比例可展示', () => {
      const input = {
        id: '1',
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        emotional_analysis: {
          route: 'standard',
        },
      };
      const result = normalizeJudgment(input);
      expect(result.judgment_route).toBe('standard');
      expect(result.responsibility_ratio_visibility).toEqual({
        can_show: true,
        reason: null,
      });
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

    it('plaintiff_ratio 或 defendant_ratio 為 undefined 時不應補充 responsibility_ratio', () => {
      const input = {
        id: '1',
        plaintiff_ratio: 60,
        defendant_ratio: undefined as unknown as number,
      };
      const result = normalizeJudgment(input);
      expect(result.responsibility_ratio).toBeUndefined();
    });

    it('僅 plaintiff_ratio 存在時不應補充 responsibility_ratio', () => {
      const input = {
        id: '1',
        plaintiff_ratio: 100,
        defendant_ratio: undefined as unknown as number,
      };
      const result = normalizeJudgment(input);
      expect(result.responsibility_ratio).toBeUndefined();
    });

    it('plaintiff_ratio 與 defendant_ratio 為 0 時應正確補充 responsibility_ratio', () => {
      const input = {
        id: '1',
        plaintiff_ratio: 0,
        defendant_ratio: 0,
      };
      const result = normalizeJudgment(input);
      expect(result.responsibility_ratio).toEqual({ plaintiff: 0, defendant: 0 });
    });
  });
});
