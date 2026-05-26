import { describe, expect, it } from 'vitest';
import enUS from './en-US';
import zhTW from './zh-TW';

function sortedKeys(catalog: Record<string, string>): string[] {
  return Object.keys(catalog).sort();
}

function placeholderNames(value: string): string[] {
  return Array.from(value.matchAll(/\{([a-zA-Z0-9_]+)\}/g), match => match[1]).sort();
}

describe('frontend i18n catalog parity', () => {
  it('zh-TW and en-US expose the same keys', () => {
    expect(sortedKeys(enUS)).toEqual(sortedKeys(zhTW));
  });

  it('translated values are non-empty strings', () => {
    for (const [key, value] of Object.entries(zhTW)) {
      expect(value.trim(), `zh-TW ${key}`).not.toBe('');
    }
    for (const [key, value] of Object.entries(enUS)) {
      expect(value.trim(), `en-US ${key}`).not.toBe('');
    }
  });

  it('translation placeholders stay aligned across locales', () => {
    for (const key of sortedKeys(zhTW)) {
      expect(placeholderNames(enUS[key]), key).toEqual(placeholderNames(zhTW[key]));
    }
  });
});
