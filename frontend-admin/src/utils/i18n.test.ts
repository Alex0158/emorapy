import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocale, normalizeLocale, setLocale, t } from './i18n';

function installStorageWindow() {
  const values = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => {
      values.clear();
    }),
  };
  vi.stubGlobal('window', {
    localStorage: storage,
    navigator: { language: 'zh-TW' },
  });
  return storage;
}

describe('admin i18n', () => {
  afterEach(() => {
    setLocale('zh-TW');
    vi.unstubAllGlobals();
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

  it('setLocale 應寫入 Admin current key 並清理 legacy locale key', () => {
    const storage = installStorageWindow();
    storage.setItem('cj_locale', 'en-US');
    storage.setItem('mbc_locale', 'zh-TW');

    setLocale('en-US');

    expect(storage.getItem('emorapy_admin_locale')).toBe('en-US');
    expect(storage.getItem('cj_locale')).toBeNull();
    expect(storage.getItem('mbc_locale')).toBeNull();
  });

  it('初始化時應把 legacy cj_locale 遷移到 Admin current key', async () => {
    vi.resetModules();
    const storage = installStorageWindow();
    storage.setItem('cj_locale', 'en-US');

    const module = await import('./i18n');

    expect(module.getLocale()).toBe('en-US');
    expect(storage.getItem('emorapy_admin_locale')).toBe('en-US');
    expect(storage.getItem('cj_locale')).toBeNull();
  });
});
