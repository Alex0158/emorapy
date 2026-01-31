import zhTW from '@/assets/i18n/zh-TW';

type Locale = 'zh-TW';

let current: Locale = 'zh-TW';

const catalogs: Record<Locale, Record<string, string>> = {
  'zh-TW': zhTW,
};

export function t(key: string): string {
  const dict = catalogs[current];
  return dict[key] ?? key;
}

export function setLocale(locale: Locale): void {
  if (catalogs[locale]) current = locale;
}

export function getLocale(): Locale {
  return current;
}
