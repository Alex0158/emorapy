const {
  enUS,
  getLocale,
  normalizeLocale,
  setLocale,
  t,
  zhTW,
} = require('./index');

function sortedKeys(catalog) {
  return Object.keys(catalog).sort();
}

function placeholderNames(value) {
  return Array.from(value.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (match) => match[1]).sort();
}

describe('App i18n runtime', () => {
  beforeEach(() => {
    setLocale('zh-TW', { persist: false });
  });

  it('keeps zh-TW and en-US catalog keys aligned', () => {
    expect(sortedKeys(enUS)).toEqual(sortedKeys(zhTW));
  });

  it('keeps translation placeholders aligned across locales', () => {
    for (const key of sortedKeys(zhTW)) {
      expect({ key, placeholders: placeholderNames(enUS[key]) }).toEqual({
        key,
        placeholders: placeholderNames(zhTW[key]),
      });
    }
  });

  it('normalizes runtime aliases to cross-platform locale ids', () => {
    expect(normalizeLocale('zh-Hant')).toBe('zh-TW');
    expect(normalizeLocale('en')).toBe('en-US');
  });

  it('translates with the selected runtime locale', () => {
    expect(getLocale()).toBe('zh-TW');
    expect(t('public.home.title')).toBe('把拉扯整理成下一步');
    expect(t('app.locale.switchToEnglish')).toBe('切換為英文');
    expect(t('app.locale.switchToZhTW')).toBe('切換為繁體中文');

    setLocale('en-US', { persist: false });

    expect(getLocale()).toBe('en-US');
    expect(t('public.home.title')).toBe('Turn conflict into the next step');
    expect(t('app.locale.switchToEnglish')).toBe('Switch to English');
    expect(t('app.locale.switchToZhTW')).toBe('Switch to Traditional Chinese');
    expect(t('ui.link.accessibilityHint', { label: 'Quick' })).toBe('Open "Quick"');
  });
});
