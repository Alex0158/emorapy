/**
 * format 工具單元測試
 */
import { describe, it, expect } from 'vitest';
import { formatFileSize, formatWordCount, truncateText, formatPercent } from './format';

describe('format', () => {
  describe('formatFileSize', () => {
    it('0 應返回「0 B」', () => expect(formatFileSize(0)).toBe('0 B'));
    it('應正確換算 B/KB/MB/GB', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('formatWordCount', () => {
    it('應返回「已輸入 N / M 字」', () => {
      expect(formatWordCount(10, 100)).toBe('已輸入 10 / 100 字');
    });
  });

  describe('truncateText', () => {
    it('短於等於 maxLength 應原樣返回', () => {
      expect(truncateText('hi', 5)).toBe('hi');
      expect(truncateText('hello', 5)).toBe('hello');
    });
    it('超過 maxLength 應截斷並加「...」', () => {
      expect(truncateText('hello world', 5)).toBe('hello...');
    });
  });

  describe('formatPercent', () => {
    it('應返回「N%」', () => {
      expect(formatPercent(50)).toBe('50%');
      expect(formatPercent(33.33, 2)).toBe('33.33%');
    });
  });
});
