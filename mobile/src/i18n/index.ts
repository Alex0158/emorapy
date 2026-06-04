import { useSyncExternalStore } from 'react';

import enUS from './catalogs/en-US';
import zhTW from './catalogs/zh-TW';

export type Locale = 'zh-TW' | 'en-US';

const DEFAULT_LOCALE: Locale = 'zh-TW';
const catalogs: Record<Locale, Record<string, string>> = {
  'zh-TW': zhTW,
  'en-US': enUS,
};

let currentLocale: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();
let initialized = false;
let persistLocale: ((locale: Locale) => void) | null = null;

export function normalizeLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  return input.toLowerCase().startsWith('en') ? 'en-US' : 'zh-TW';
}

function notifyLocaleChange(): void {
  listeners.forEach((listener) => listener());
}

function syncDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale | string, options: { persist?: boolean } = {}): void {
  const normalized = normalizeLocale(locale);
  const shouldPersist = options.persist !== false;
  const changed = normalized !== currentLocale;
  currentLocale = normalized;
  syncDocumentLocale(normalized);
  if (shouldPersist) persistLocale?.(normalized);
  if (changed) notifyLocaleChange();
}

export function configureLocalePersistence(handler: ((locale: Locale) => void) | null): void {
  persistLocale = handler;
}

export function initializeLocalePreference(
  storedLocale?: string | null,
  fallbackLocale?: string | null
): Locale {
  if (initialized) return currentLocale;
  initialized = true;
  if (storedLocale) {
    setLocale(storedLocale, { persist: false });
  } else if (fallbackLocale) {
    setLocale(fallbackLocale, { persist: false });
  }
  return currentLocale;
}

export function onLocaleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocale(): Locale {
  return useSyncExternalStore(onLocaleChange, getLocale, getLocale);
}

function missingTranslation(key: string): string {
  throw new Error(`Missing App i18n key: ${key}`);
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = catalogs[currentLocale];
  const fallback = catalogs[DEFAULT_LOCALE];
  let result = dict[key] ?? fallback[key] ?? missingTranslation(key);
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      result = result.replaceAll(`{${name}}`, String(value));
    }
  }
  return result;
}

syncDocumentLocale(currentLocale);

export { enUS, zhTW };
