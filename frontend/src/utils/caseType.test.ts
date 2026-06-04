/**
 * 案件類型工具單元測試
 */
import { describe, it, expect } from 'vitest';
import type { CaseType } from './caseType';
import { CASE_TYPES, getCaseTypeColor, getCaseTypeI18nKey, getCaseTypeIcon } from './caseType';

describe('caseType', () => {
  describe('CASE_TYPES', () => {
    it('應包含 6 種類型', () => {
      expect(CASE_TYPES).toHaveLength(6);
      expect(CASE_TYPES).toContain('生活習慣衝突');
      expect(CASE_TYPES).toContain('消費決策衝突');
      expect(CASE_TYPES).toContain('社交關係衝突');
      expect(CASE_TYPES).toContain('價值觀衝突');
      expect(CASE_TYPES).toContain('情感需求衝突');
      expect(CASE_TYPES).toContain('其他衝突');
    });
  });

  describe('getCaseTypeColor', () => {
    it('各類型應返回對應顏色', () => {
      expect(getCaseTypeColor('生活習慣衝突')).toBe('#52C41A');
      expect(getCaseTypeColor('消費決策衝突')).toBe('#1890FF');
      expect(getCaseTypeColor('社交關係衝突')).toBe('#722ED1');
      expect(getCaseTypeColor('價值觀衝突')).toBe('#FA8C16');
      expect(getCaseTypeColor('情感需求衝突')).toBe('#EB2F96');
      expect(getCaseTypeColor('其他衝突')).toBe('#8C8C8C');
    });

    it('未知類型應返回預設灰色', () => {
      expect(getCaseTypeColor('未知' as unknown as CaseType)).toBe('#8C8C8C');
    });
  });

  describe('getCaseTypeI18nKey', () => {
    it('已知類型應返回對應 i18n key', () => {
      expect(getCaseTypeI18nKey('生活習慣衝突')).toBe('caseList.typeLife');
    });

    it('未知類型應返回 undefined 以保留呼叫端 fallback', () => {
      expect(getCaseTypeI18nKey('未知')).toBeUndefined();
    });
  });

  describe('getCaseTypeIcon', () => {
    it('各類型應返回對應圖標', () => {
      expect(getCaseTypeIcon('生活習慣衝突')).toBe('🏠');
      expect(getCaseTypeIcon('消費決策衝突')).toBe('💰');
      expect(getCaseTypeIcon('社交關係衝突')).toBe('👥');
      expect(getCaseTypeIcon('價值觀衝突')).toBe('💭');
      expect(getCaseTypeIcon('情感需求衝突')).toBe('💕');
      expect(getCaseTypeIcon('其他衝突')).toBe('❓');
    });

    it('未知類型應返回預設問號', () => {
      expect(getCaseTypeIcon('未知' as string)).toBe('❓');
    });
  });
});
