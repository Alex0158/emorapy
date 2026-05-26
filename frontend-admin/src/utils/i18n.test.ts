import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocale, normalizeLocale, setLocale, t } from './i18n';

describe('admin i18n', () => {
  afterEach(() => {
    setLocale('zh-TW');
    vi.unstubAllEnvs();
  });

  it('已知 key 應返回對應翻譯', () => {
    setLocale('zh-TW');
    expect(t('admin.nav.title')).toBe('管理後台');
  });

  it('缺 key 在非 production 應直接拋錯', () => {
    expect(() => t('unknown.key')).toThrow('Missing i18n key: unknown.key');
  });

  it('production 下缺 key 應返回缺 key 標記', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('DEV', false);
    expect(t('unknown.key')).toBe('[missing-i18n:unknown.key]');
  });

  it('normalizeLocale 與 getLocale 應可用', () => {
    expect(normalizeLocale('en')).toBe('en-US');
    expect(['zh-TW', 'en-US']).toContain(getLocale());
  });
});
