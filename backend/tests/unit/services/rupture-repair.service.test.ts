/**
 * RuptureRepairService 單元測試（mock aiService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGenerateText = jest.fn();

jest.mock('../../../src/services/ai.service', () => ({
  aiService: { generateText: (...args: unknown[]) => mockGenerateText(...args) },
}));

import { ruptureRepairService } from '../../../src/services/rupture-repair.service';

describe('RuptureRepairService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockGenerateText as any).mockResolvedValue('修復後的溫暖回應');
  });

  describe('repair', () => {
    it('userFeedback 為空時 repairType 應為 validation（F04 邊界：空反饋防禦）', async () => {
      const result = await ruptureRepairService.repair({
        judgmentContent: '原始判決',
        userFeedback: '',
      });

      expect(result.repairType).toBe('validation');
      expect(result.repairedContent).toBe('修復後的溫暖回應');
    });

    it('userFeedback 含責備關鍵字時 repairType 應為 apology_tone_fix（F04 邊界：責備偵測）', async () => {
      const result = await ruptureRepairService.repair({
        judgmentContent: '原始判決',
        userFeedback: '感覺被責備了',
      });

      expect(result.repairType).toBe('apology_tone_fix');
    });

    it('userFeedback 含沒懂關鍵字時 repairType 應為 strategy_reset（F04 邊界：理解偵測）', async () => {
      const result = await ruptureRepairService.repair({
        judgmentContent: '原始判決',
        userFeedback: '聽不懂你在說什麼',
      });

      expect(result.repairType).toBe('strategy_reset');
    });

    it('judgmentContent 超過 4000 字時應截斷至 4000 字傳給 AI（F04 邊界：prompt 長度防禦）', async () => {
      const longContent = 'x'.repeat(5000);
      await ruptureRepairService.repair({
        judgmentContent: longContent,
        userFeedback: 'test',
      });

      const prompt = mockGenerateText.mock.calls[0][0] as string;
      const match = prompt.match(/原始回應（節錄）：\n([\s\S]*?)\n\n用戶最新反饋/);
      expect(match).not.toBeNull();
      expect(match![1].length).toBe(4000);
    });
  });
});
