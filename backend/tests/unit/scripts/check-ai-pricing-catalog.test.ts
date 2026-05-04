import { getRequiredAIPricingModelsFromEnv } from '../../../scripts/check-ai-pricing-catalog';

describe('check-ai-pricing-catalog', () => {
  it('builds required model list from runtime env defaults and explicit extras', () => {
    expect(getRequiredAIPricingModelsFromEnv({
      OPENAI_MODEL: 'gpt-4o-mini',
      OPENAI_INTERVIEW_MODEL: 'gpt-4o-mini',
      OPENAI_ANALYSIS_MODEL: 'gpt-4o',
      AI_COST_REQUIRED_MODELS: 'gpt-4.1, gpt-4o-mini, ',
    } as NodeJS.ProcessEnv)).toEqual(['gpt-4o-mini', 'gpt-4o', 'gpt-4.1']);
  });

  it('uses backend runtime defaults when model env is absent', () => {
    expect(getRequiredAIPricingModelsFromEnv({} as NodeJS.ProcessEnv)).toEqual([
      'gpt-3.5-turbo',
      'gpt-4o-mini',
      'gpt-4o',
    ]);
  });
});
