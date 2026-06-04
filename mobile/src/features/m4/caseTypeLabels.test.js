const { setLocale } = require('@/src/i18n');
const { getCaseTypeLabel } = require('@/src/features/m4/caseTypeLabels');

describe('caseTypeLabels', () => {
  beforeEach(() => {
    setLocale('zh-TW', { persist: false });
  });

  it('maps backend case type values to zh-TW labels', () => {
    expect(getCaseTypeLabel('生活習慣衝突')).toBe('生活習慣');
    expect(getCaseTypeLabel('其他衝突')).toBe('其他');
  });

  it('maps backend case type values to en-US labels', () => {
    setLocale('en-US', { persist: false });

    expect(getCaseTypeLabel('生活習慣衝突')).toBe('Lifestyle');
    expect(getCaseTypeLabel('情感需求衝突')).toBe('Emotional needs');
  });

  it('returns null for empty or unknown case type values', () => {
    setLocale('en-US', { persist: false });

    expect(getCaseTypeLabel(null)).toBeNull();
    expect(getCaseTypeLabel(undefined)).toBeNull();
    expect(getCaseTypeLabel('unexpected')).toBeNull();
  });
});
