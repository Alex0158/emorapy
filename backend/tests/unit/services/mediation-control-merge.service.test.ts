import { mergeMediationControls } from '../../../src/services/mediation-control-merge.service';

describe('mergeMediationControls', () => {
  it('merges owner controls into the most cautious bounded values without attribution', () => {
    const result = mergeMediationControls([
      {
        pace: 'normal',
        ask_permission_before_depth: false,
        offer_pause: true,
        question_style: 'concrete',
        max_questions: 2,
      },
      {
        pace: 'slower',
        ask_permission_before_depth: true,
        offer_pause: false,
        question_style: 'gentle',
        max_questions: 1,
      },
    ]);

    expect(result).toEqual({
      pace: 'slower',
      ask_permission_before_depth: true,
      offer_pause: true,
      question_style: 'gentle',
      max_questions: 1,
    });
    expect(JSON.stringify(result)).not.toMatch(/owner|participant|reason|source/);
  });

  it('returns null when no owner compiler emitted valid controls', () => {
    expect(mergeMediationControls([])).toBeNull();
  });
});
