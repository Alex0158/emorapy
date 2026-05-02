import enUS from '@/assets/i18n/en-US';
import zhTW from '@/assets/i18n/zh-TW';

export type Locale = 'zh-TW' | 'en-US';

const DEFAULT_LOCALE: Locale = 'zh-TW';
const STORAGE_KEY = 'cj_locale';

const catalogs: Record<Locale, Record<string, string>> = {
  'zh-TW': zhTW,
  'en-US': enUS,
};

let currentLocale: Locale = detectInitialLocale();
const listeners = new Set<() => void>();

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en-US' || stored === 'zh-TW') {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  const language = window.navigator.language.toLowerCase();
  return language.startsWith('en') ? 'en-US' : 'zh-TW';
}

export function normalizeLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  return input.toLowerCase().startsWith('en') ? 'en-US' : 'zh-TW';
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale | string): void {
  const normalized = normalizeLocale(locale);
  if (normalized === currentLocale) return;
  currentLocale = normalized;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // ignore storage errors
    }
  }
  listeners.forEach((listener) => {
    listener();
  });
}

export function onLocaleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = catalogs[currentLocale];
  const fallback = catalogs[DEFAULT_LOCALE];
  let result = dict[key] ?? fallback[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      result = result.replaceAll(`{${name}}`, String(value));
    }
  }
  return result;
}
