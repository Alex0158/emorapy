const { labelPsychDomain, labelPsychDomains } = require('./labels');
const { setLocale } = require('@/src/i18n');

describe('M2 user-facing labels', () => {
  beforeEach(() => {
    setLocale('zh-TW', { persist: false });
  });

  it('maps psych profile domains to user-facing Chinese labels', () => {
    expect(labelPsychDomain('personality')).toBe('個性特質');
    expect(labelPsychDomain('relationship_history')).toBe('感情經歷');
    expect(labelPsychDomain('unknown_domain')).toBe('其他關係脈絡');
  });

  it('formats psych domains without exposing backend enum values', () => {
    const allRawDomains = [
      'attachment',
      'family_origin',
      'life_events',
      'belief_values',
      'cultural_background',
      'education_cognition',
      'personality',
      'relationship_history',
    ];

    expect(labelPsychDomains(['personality', 'relationship_history', 'personality'])).toBe('個性特質、感情經歷');
    expect(labelPsychDomains(allRawDomains)).not.toMatch(/attachment|family_origin|life_events|belief_values|cultural_background|education_cognition|personality|relationship_history/);
    expect(labelPsychDomains([])).toBe('尚未形成');
    expect(labelPsychDomains(null)).toBe('尚未形成');
  });

  it('maps psych profile domains to the selected locale', () => {
    setLocale('en-US', { persist: false });

    expect(labelPsychDomain('personality')).toBe('Personality traits');
    expect(labelPsychDomain('relationship_history')).toBe('Relationship history');
    expect(labelPsychDomain('unknown_domain')).toBe('Other relationship context');
    expect(labelPsychDomains(['personality', 'relationship_history', 'personality'])).toBe(
      'Personality traits, Relationship history'
    );
    expect(labelPsychDomains([])).toBe('Not formed yet');
  });
});
