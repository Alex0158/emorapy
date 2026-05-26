import zhTW from '@/assets/i18n/zh-TW';

export type Locale = 'zh-TW' | 'en-US';

const DEFAULT_LOCALE: Locale = 'zh-TW';
const LOCALE_STORAGE_KEY = 'cj_locale';
const LEGACY_LOCALE_STORAGE_KEY = 'mbc_locale';

let current: Locale = detectInitialLocale();

const catalogs: Record<Locale, Record<string, string>> = {
  'zh-TW': zhTW,
  'en-US': {},
};

let enUSLoading: Promise<void> | null = null;
const isProduction = (): boolean => import.meta.env.PROD === true;

function ensureLocaleCatalogLoaded(locale: Locale): Promise<void> {
  if (locale !== 'en-US') return Promise.resolve();
  if (Object.keys(catalogs['en-US']).length > 0) return Promise.resolve();
  if (!enUSLoading) {
    enUSLoading = import('@/assets/i18n/en-US')
      .then((module) => {
        catalogs['en-US'] = module.default;
      })
      .finally(() => {
        enUSLoading = null;
      });
  }
  return enUSLoading;
}

function missingTranslation(key: string): string {
  if (isProduction()) return `[missing-i18n:${key}]`;
  throw new Error(`Missing i18n key: ${key}`);
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = catalogs[current];
  let result: string;
  if (dict[key]) result = dict[key];
  else if (current === 'en-US') result = catalogs[DEFAULT_LOCALE][key] ?? missingTranslation(key);
  else result = catalogs[DEFAULT_LOCALE][key] ?? missingTranslation(key);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replaceAll(`{${k}}`, String(v));
    }
  }
  return result;
}

export function normalizeLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const lower = input.toLowerCase();
  if (lower.startsWith('en')) return 'en-US';
  return 'zh-TW';
}

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
  } catch {
    /* noop */
  }
  if (stored) return normalizeLocale(stored);
  return normalizeLocale(window.navigator.language);
}

const listeners = new Set<() => void>();

function syncDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

function notifyLocaleChange(): void {
  listeners.forEach(listener => listener());
}

export function setLocale(locale: Locale | string): void {
  const normalized = normalizeLocale(locale);
  if (!catalogs[normalized]) return;
  if (current === normalized) {
    syncDocumentLocale(normalized);
    return;
  }
  current = normalized;
  syncDocumentLocale(normalized);
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized); } catch { /* noop */ }
  }
  void ensureLocaleCatalogLoaded(normalized).finally(() => {
    notifyLocaleChange();
  });
}

export function getLocale(): Locale {
  return current;
}

export function onLocaleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (current === 'en-US') {
  void ensureLocaleCatalogLoaded('en-US').finally(() => {
    notifyLocaleChange();
  });
}

syncDocumentLocale(current);
