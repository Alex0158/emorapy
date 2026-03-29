/**
 * i18n 單元測試
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { t, setLocale, getLocale, onLocaleChange, normalizeLocale } from './i18n';

vi.mock('@/assets/i18n/zh-TW', () => ({
  default: {
    'result.title': '關係分析結果',
    'key.one': '值一',
    'greeting.hello': '你好 {name}，計數: {count}',
  },
}));

vi.mock('@/assets/i18n/en-US', () => ({
  default: {
    'result.title': 'Relationship Analysis Result',
    'key.one': 'Value One',
  },
}));

describe('i18n', () => {
  afterEach(() => {
    setLocale('zh-TW');
  });

  describe('t', () => {
    it('已知 key 應返回對應翻譯', () => {
      setLocale('zh-TW');
      expect(t('result.title')).toBe('關係分析結果');
      expect(t('key.one')).toBe('值一');
    });

    it('未知 key 應返回 key 本身', () => {
      setLocale('zh-TW');
      expect(t('unknown.key')).toBe('unknown.key');
    });

    it('en-US 未命中翻譯時應返回可讀英文 fallback', () => {
      setLocale('en-US');
      expect(t('message.caseIdMissing')).toBe('Message Case Id Missing');
    });

    it('應支援插值：params 中的 key 會替換字串中的 {key}', () => {
      setLocale('zh-TW');
      expect(t('greeting.hello', { name: 'Alice', count: 3 })).toBe('你好 Alice，計數: 3');
    });

    it('無 params 時含 {placeholder} 的字串應原樣返回', () => {
      setLocale('zh-TW');
      expect(t('greeting.hello')).toBe('你好 {name}，計數: {count}');
    });
  });

  describe('normalizeLocale', () => {
    it('空值或 null/undefined 應返回 zh-TW', () => {
      expect(normalizeLocale('')).toBe('zh-TW');
      expect(normalizeLocale(null as unknown as string)).toBe('zh-TW');
      expect(normalizeLocale(undefined as unknown as string)).toBe('zh-TW');
    });
    it('en 開頭應返回 en-US', () => {
      expect(normalizeLocale('en')).toBe('en-US');
      expect(normalizeLocale('en-US')).toBe('en-US');
      expect(normalizeLocale('EN')).toBe('en-US');
    });
    it('其他應返回 zh-TW', () => {
      expect(normalizeLocale('zh-TW')).toBe('zh-TW');
      expect(normalizeLocale('ja')).toBe('zh-TW');
    });
  });

  describe('setLocale / getLocale', () => {
    it('預設應為受支援的 locale', () => {
      expect(['zh-TW', 'en-US']).toContain(getLocale());
    });

    it('setLocale 有效 locale 應更新 current', () => {
      setLocale('en-US');
      expect(getLocale()).toBe('en-US');
    });

    it('setLocale 無效 locale 不應改變 current', () => {
      setLocale('zh-TW');
      setLocale('ja-JP' as unknown as Parameters<typeof setLocale>[0]);
      expect(getLocale()).toBe('zh-TW');
    });

    it('setLocale 時 localStorage.setItem 拋錯不應拋出', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('quota exceeded');
      });
      setLocale('en-US');
      expect(getLocale()).toBe('en-US');
      setItem.mockRestore();
    });

    it('切到 en-US 後，字典載入完成應觸發 locale listener', async () => {
      const listener = vi.fn();
      const unsubscribe = onLocaleChange(listener);
      setLocale('en-US');
      await Promise.resolve();
      await Promise.resolve();
      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });

    it('en-US 字典載入前後都不應回退為 key 原文', async () => {
      setLocale('en-US');
      const immediate = t('result.title');
      await Promise.resolve();
      await Promise.resolve();
      const loaded = t('result.title');
      expect(
        immediate === '關係分析結果' || immediate === 'Relationship Analysis Result'
      ).toBe(true);
      expect(loaded).toBe('Relationship Analysis Result');
    });
  });
});
