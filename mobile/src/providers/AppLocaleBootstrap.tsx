import { useEffect } from 'react';

import { configureLocalePersistence, initializeLocalePreference } from '@/src/i18n';
import { localeStorage } from '@/src/platform/storage/secureStore';

function readLocaleEnv(): string | undefined {
  const maybeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  const value = maybeProcess?.env?.EXPO_PUBLIC_LOCALE;
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function AppLocaleBootstrap() {
  useEffect(() => {
    const storage = localeStorage as typeof localeStorage | undefined;
    if (!storage) {
      initializeLocalePreference(null, readLocaleEnv());
      return;
    }
    configureLocalePersistence((locale) => {
      void storage.setLocale(locale);
    });
    void Promise.resolve(storage.getLocale()).then((storedLocale: string | null) => {
      initializeLocalePreference(storedLocale, readLocaleEnv());
    });
  }, []);

  return null;
}
