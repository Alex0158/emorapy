/**
 * formatDate 工具單元測試
 */
import { describe, it, expect } from 'vitest';
import { formatDuration } from './formatDate';

describe('formatDate', () => {
  describe('formatDuration', () => {
    it('1 天應返回「1天」', () => {
      expect(formatDuration(1)).toBe('1天');
    });
    it('2–6 天應返回「N天」', () => {
      expect(formatDuration(2)).toBe('2天');
      expect(formatDuration(6)).toBe('6天');
    });
    it('7–29 天應返回「N週」', () => {
      expect(formatDuration(7)).toBe('1週');
      expect(formatDuration(14)).toBe('2週');
      expect(formatDuration(21)).toBe('3週');
    });
    it('30 天以上應返回「N個月」', () => {
      expect(formatDuration(30)).toBe('1個月');
      expect(formatDuration(60)).toBe('2個月');
    });
  });
});
