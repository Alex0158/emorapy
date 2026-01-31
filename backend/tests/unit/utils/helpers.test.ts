/**
 * 輔助函數測試
 */

import {
  generateCaseTitle,
  isValidEmail,
  isValidUrl,
  formatDateTime,
  calculatePagination,
  extractKeywords,
  sanitizeText,
} from '../../../src/utils/helpers';

describe('Helpers Utils', () => {
  describe('generateCaseTitle', () => {
    it('應從陳述取前30字符作為標題', () => {
      const statement = '我們經常因為家務分工吵架，我認為對方做得太少';
      expect(generateCaseTitle(statement)).toBe('我們經常因為家務分工吵架，我認為對方做得太少');
    });

    it('長陳述應截斷到30字符', () => {
      const statement = '這是一個非常長的陳述內容'.repeat(5);
      expect(generateCaseTitle(statement).length).toBeLessThanOrEqual(33); // 30 + trim
    });

    it('短於5字符應使用默認標題格式', () => {
      const title = generateCaseTitle('abc');
      expect(title).toMatch(/^案件-/);
      expect(title).toContain(new Date().toLocaleDateString());
    });
  });

  describe('isValidEmail', () => {
    it('應接受有效郵箱', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('應拒絕無效郵箱', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('應接受有效 URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('應拒絕無效 URL', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('formatDateTime', () => {
    it('應返回 ISO 格式字符串', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      expect(formatDateTime(date)).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('calculatePagination', () => {
    it('應正確計算分頁信息', () => {
      const result = calculatePagination(1, 10, 25);
      expect(result).toEqual({
        page: 1,
        page_size: 10,
        total: 25,
        total_pages: 3,
        has_more: true,
      });
    });

    it('最後一頁 has_more 應為 false', () => {
      const result = calculatePagination(3, 10, 25);
      expect(result.has_more).toBe(false);
    });

    it('total 為 0 時 total_pages 應為 0', () => {
      const result = calculatePagination(1, 10, 0);
      expect(result.total_pages).toBe(0);
      expect(result.has_more).toBe(false);
    });
  });

  describe('extractKeywords', () => {
    it('應提取指定數量的關鍵詞', () => {
      const text = 'hello world test example more words';
      expect(extractKeywords(text, 3)).toHaveLength(3);
    });

    it('應過濾長度小於等於2的詞', () => {
      const text = 'abc def ghi 我 們 吵架';
      const keywords = extractKeywords(text, 10);
      expect(keywords).toContain('abc');
      expect(keywords).toContain('def');
      expect(keywords).not.toContain('我');
      expect(keywords).not.toContain('們');
    });

    it('默認提取5個關鍵詞', () => {
      const text = 'first second third fourth fifth sixth seventh';
      expect(extractKeywords(text)).toHaveLength(5);
    });
  });

  describe('sanitizeText', () => {
    it('應去除首尾空格', () => {
      expect(sanitizeText('  text  ')).toBe('text');
    });

    it('應將連續空白壓縮為單一空格', () => {
      expect(sanitizeText('a   b    c')).toBe('a b c');
    });
  });
});
