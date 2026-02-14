/**
 * i18n 單元測試
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { t, setLocale, getLocale } from './i18n';

vi.mock('@/assets/i18n/zh-TW', () => ({
  default: {
    'result.title': '判決結果',
    'key.one': '值一',
  },
}));

describe('i18n', () => {
  afterEach(() => {
    setLocale('zh-TW');
  });

  describe('t', () => {
    it('已知 key 應返回對應翻譯', () => {
      expect(t('result.title')).toBe('判決結果');
      expect(t('key.one')).toBe('值一');
    });

    it('未知 key 應返回 key 本身', () => {
      expect(t('unknown.key')).toBe('unknown.key');
    });
  });

  describe('setLocale / getLocale', () => {
    it('預設應為 zh-TW', () => {
      expect(getLocale()).toBe('zh-TW');
    });

    it('setLocale 有效 locale 應更新 current', () => {
      setLocale('zh-TW');
      expect(getLocale()).toBe('zh-TW');
    });

    it('setLocale 無效 locale 不應改變 current', () => {
      setLocale('zh-TW');
      setLocale('en' as unknown as Parameters<typeof setLocale>[0]);
      expect(getLocale()).toBe('zh-TW');
    });
  });
});
