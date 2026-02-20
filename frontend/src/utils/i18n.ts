import zhTW from '@/assets/i18n/zh-TW';
import enUS from '@/assets/i18n/en-US';

export type Locale = 'zh-TW' | 'en-US';

const DEFAULT_LOCALE: Locale = 'zh-TW';
const LOCALE_STORAGE_KEY = 'mbc_locale';

let current: Locale = detectInitialLocale();

const catalogs: Record<Locale, Record<string, string>> = {
  'zh-TW': zhTW,
  'en-US': enUS,
};

function humanizeKey(key: string): string {
  return key
    .split('.')
    .map(part => part.replace(/([a-z])([A-Z])/g, '$1 $2'))
    .join(' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

export function t(key: string): string {
  const dict = catalogs[current];
  if (dict[key]) return dict[key];
  if (current === 'en-US') return humanizeKey(key);
  return catalogs[DEFAULT_LOCALE][key] ?? key;
}

export function normalizeLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const lower = input.toLowerCase();
  if (lower.startsWith('en')) return 'en-US';
  return 'zh-TW';
}

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) return normalizeLocale(stored);
  return normalizeLocale(window.navigator.language);
}

const listeners = new Set<() => void>();

function notifyLocaleChange(): void {
  listeners.forEach(listener => listener());
}

export function setLocale(locale: Locale | string): void {
  const normalized = normalizeLocale(locale);
  if (!catalogs[normalized] || current === normalized) return;
  current = normalized;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
  }
  notifyLocaleChange();
}

export function getLocale(): Locale {
  return current;
}

export function onLocaleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
