/**
 * formatDate 工具單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { formatDateTime, formatDate, formatTime, formatRelativeTime, formatDuration } from './formatDate';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => ({ 'common.unknown': '未知', 'duration.days': '{n}天', 'duration.weeks': '{n}週', 'duration.months': '{n}個月' }[key] ?? key),
  getLocale: () => 'zh-TW',
}));

describe('formatDate', () => {
  describe('formatDateTime', () => {
    it('應依格式輸出日期時間', () => {
      expect(formatDateTime('2025-06-01T12:00:00Z')).toMatch(/2025-06-01/);
      expect(formatDateTime('2025-06-01T12:00:00Z', 'YYYY-MM-DD HH:mm')).toMatch(/2025-06-01/);
    });
  });

  describe('formatDate', () => {
    it('應依格式輸出日期', () => {
      expect(formatDate('2025-06-01T12:00:00Z')).toBe('2025-06-01');
      expect(formatDate('2025-06-01', 'YYYY/MM/DD')).toBe('2025/06/01');
    });
  });

  describe('formatTime', () => {
    it('應依格式輸出時間', () => {
      expect(formatTime('2025-06-01T14:30:00Z')).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('formatRelativeTime', () => {
    it('應返回相對時間字串', () => {
      const past = new Date(Date.now() - 120000);
      expect(formatRelativeTime(past)).toBeDefined();
      expect(typeof formatRelativeTime(past)).toBe('string');
    });
  });

  describe('formatDuration', () => {
    it('非有限或負數應返回 common.unknown 文案', () => {
      expect(formatDuration(Number.NaN)).toBe('未知');
      expect(formatDuration(-1)).toBe('未知');
      expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('未知');
    });
    it('0 天應走 days 分支', () => {
      expect(formatDuration(0)).toBe('1天');
    });
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
