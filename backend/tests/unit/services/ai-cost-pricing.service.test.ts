import {
  calculateAIRequestCost,
  parseAIRequestPricingCatalog,
  validateAIRequestPricingCatalog,
} from '../../../src/services/ai-cost-pricing.service';

describe('ai-cost-pricing.service', () => {
  const originalPricing = process.env.AI_COST_PRICING_JSON;

  afterEach(() => {
    if (originalPricing === undefined) {
      delete process.env.AI_COST_PRICING_JSON;
    } else {
      process.env.AI_COST_PRICING_JSON = originalPricing;
    }
  });

  it('parses camelCase and snake_case pricing entries', () => {
    const catalog = parseAIRequestPricingCatalog(JSON.stringify({
      source: 'manual-openai-pricing',
      version: '2026-05-04',
      models: {
        'gpt-4o-mini': {
          inputUsdPer1M: 0.15,
          output_usd_per_1m: 0.6,
        },
      },
    }));

    expect(catalog).toEqual({
      source: 'manual-openai-pricing',
      version: '2026-05-04',
      models: {
        'gpt-4o-mini': {
          inputUsdPer1M: 0.15,
          outputUsdPer1M: 0.6,
        },
      },
    });
  });

  it('validates required runtime model coverage', () => {
    const report = validateAIRequestPricingCatalog({
      rawJson: JSON.stringify({
        source: 'manual-openai-pricing',
        version: '2026-05-04',
        models: {
          'gpt-4o-mini': {
            inputUsdPer1M: 0.15,
            outputUsdPer1M: 0.6,
          },
        },
      }),
      requiredModels: ['gpt-4o-mini', 'gpt-4o'],
      generatedAt: '2026-05-04T00:00:00.000Z',
    });

    expect(report).toEqual({
      ok: false,
      check: 'ai-cost-pricing-catalog',
      source: 'manual-openai-pricing',
      version: '2026-05-04',
      versionDate: '2026-05-04',
      versionAgeDays: 0,
      maxAgeDays: 30,
      configuredModelCount: 1,
      requiredModels: ['gpt-4o-mini', 'gpt-4o'],
      missingModels: ['gpt-4o'],
      invalidReason: 'AI_COST_PRICING_JSON is missing required runtime models',
      generatedAt: '2026-05-04T00:00:00.000Z',
    });
  });

  it('requires explicit source and version for release catalog validation', () => {
    const report = validateAIRequestPricingCatalog({
      rawJson: JSON.stringify({
        models: {
          'gpt-4o-mini': {
            inputUsdPer1M: 0.15,
            outputUsdPer1M: 0.6,
          },
        },
      }),
      requiredModels: ['gpt-4o-mini'],
      generatedAt: '2026-05-04T00:00:00.000Z',
    });

    expect(report.ok).toBe(false);
    expect(report.invalidReason).toBe('AI_COST_PRICING_JSON.source is required');
  });

  it('requires pricing version to start with a valid date', () => {
    const report = validateAIRequestPricingCatalog({
      rawJson: JSON.stringify({
        source: 'manual-openai-pricing',
        version: 'pricing-v1',
        models: {
          'gpt-4o-mini': {
            inputUsdPer1M: 0.15,
            outputUsdPer1M: 0.6,
          },
        },
      }),
      requiredModels: ['gpt-4o-mini'],
      generatedAt: '2026-05-04T00:00:00.000Z',
    });

    expect(report.ok).toBe(false);
    expect(report.versionDate).toBeNull();
    expect(report.invalidReason).toBe('AI_COST_PRICING_JSON.version must start with YYYY-MM-DD');
  });

  it('rejects stale pricing version by max age', () => {
    const report = validateAIRequestPricingCatalog({
      rawJson: JSON.stringify({
        source: 'manual-openai-pricing',
        version: '2026-04-01-openai',
        models: {
          'gpt-4o-mini': {
            inputUsdPer1M: 0.15,
            outputUsdPer1M: 0.6,
          },
        },
      }),
      requiredModels: ['gpt-4o-mini'],
      generatedAt: '2026-05-04T12:00:00.000Z',
      maxAgeDays: 30,
    });

    expect(report).toEqual(expect.objectContaining({
      ok: false,
      versionDate: '2026-04-01',
      versionAgeDays: 33,
      maxAgeDays: 30,
      invalidReason: 'AI_COST_PRICING_JSON.version is stale',
    }));
  });

  it('rejects future pricing version dates', () => {
    const report = validateAIRequestPricingCatalog({
      rawJson: JSON.stringify({
        source: 'manual-openai-pricing',
        version: '2026-05-05',
        models: {
          'gpt-4o-mini': {
            inputUsdPer1M: 0.15,
            outputUsdPer1M: 0.6,
          },
        },
      }),
      requiredModels: ['gpt-4o-mini'],
      generatedAt: '2026-05-04T12:00:00.000Z',
    });

    expect(report.ok).toBe(false);
    expect(report.versionAgeDays).toBe(-1);
    expect(report.invalidReason).toBe('AI_COST_PRICING_JSON.version date cannot be in the future');
  });

  it('calculates request cost only for matching openai models with token usage', () => {
    process.env.AI_COST_PRICING_JSON = JSON.stringify({
      source: 'manual-openai-pricing',
      version: '2026-05-04',
      models: {
        'gpt-4o-mini': {
          inputUsdPer1M: 0.15,
          outputUsdPer1M: 0.6,
        },
      },
    });

    expect(calculateAIRequestCost({
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    })).toEqual({
      costUsd: 0.45,
      pricing: {
        source: 'manual-openai-pricing',
        version: '2026-05-04',
        model: 'gpt-4o-mini',
        inputUsdPer1M: 0.15,
        outputUsdPer1M: 0.6,
      },
    });

    expect(calculateAIRequestCost({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    })).toBeNull();
  });
});
