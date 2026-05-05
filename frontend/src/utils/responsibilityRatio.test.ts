/**
 * 責任分比例工具單元測試
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatResponsibilityRatio,
  getResponsibilityColor,
  getResponsibilityLevel,
} from './responsibilityRatio';
import { setLocale } from './i18n';

describe('responsibilityRatio', () => {
  describe('formatResponsibilityRatio', () => {
    beforeEach(() => {
      setLocale('zh-TW');
    });

    it('應格式化為 "你 X% : 對方 Y%"', () => {
      expect(formatResponsibilityRatio({ plaintiff: 60, defendant: 40 })).toBe(
        '你 60% : 對方 40%'
      );
    });

    it('支援 0:100 與 100:0', () => {
      expect(formatResponsibilityRatio({ plaintiff: 0, defendant: 100 })).toBe(
        '你 0% : 對方 100%'
      );
      expect(formatResponsibilityRatio({ plaintiff: 100, defendant: 0 })).toBe(
        '你 100% : 對方 0%'
      );
    });
  });

  describe('getResponsibilityColor', () => {
    it('>=70 應返回紅色', () => {
      expect(getResponsibilityColor(70)).toBe('#FF4D4F');
      expect(getResponsibilityColor(100)).toBe('#FF4D4F');
    });

    it('>=50 且 <70 應返回橙色', () => {
      expect(getResponsibilityColor(50)).toBe('#FA8C16');
      expect(getResponsibilityColor(69)).toBe('#FA8C16');
    });

    it('>=30 且 <50 應返回黃色', () => {
      expect(getResponsibilityColor(30)).toBe('#FAAD14');
      expect(getResponsibilityColor(49)).toBe('#FAAD14');
    });

    it('<30 應返回綠色', () => {
      expect(getResponsibilityColor(0)).toBe('#52C41A');
      expect(getResponsibilityColor(29)).toBe('#52C41A');
    });
  });

  describe('getResponsibilityLevel', () => {
    it('>=70 應返回 major', () => {
      expect(getResponsibilityLevel(70)).toBe('major');
      expect(getResponsibilityLevel(100)).toBe('major');
    });

    it('>=50 且 <70 應返回 moderate', () => {
      expect(getResponsibilityLevel(50)).toBe('moderate');
      expect(getResponsibilityLevel(69)).toBe('moderate');
    });

    it('>=30 且 <50 應返回 minor', () => {
      expect(getResponsibilityLevel(30)).toBe('minor');
      expect(getResponsibilityLevel(49)).toBe('minor');
    });

    it('<30 應返回 minimal', () => {
      expect(getResponsibilityLevel(0)).toBe('minimal');
      expect(getResponsibilityLevel(29)).toBe('minimal');
    });
  });
});
