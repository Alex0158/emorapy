export type PricingEntry = {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  cachedInputUsdPer1M?: number;
};

export type PricingCatalog = {
  source: string;
  version: string;
  models: Record<string, PricingEntry>;
};

export type AIRequestCostResult = {
  costUsd: number;
  pricing: {
    source: string;
    version: string;
    model: string;
    inputUsdPer1M: number;
    outputUsdPer1M: number;
  };
};

export type AIRequestCostInput = {
  provider?: string | null;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
};

export type AIRequestPricingCatalogValidationReport = {
  ok: boolean;
  check: 'ai-cost-pricing-catalog';
  source: string | null;
  version: string | null;
  configuredModelCount: number;
  requiredModels: string[];
  missingModels: string[];
  invalidReason: string | null;
  generatedAt: string;
};

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizePrice(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeEntry(raw: unknown): PricingEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const inputUsdPer1M = normalizePrice(source.inputUsdPer1M ?? source.input_usd_per_1m);
  const outputUsdPer1M = normalizePrice(source.outputUsdPer1M ?? source.output_usd_per_1m);
  if (inputUsdPer1M === null || outputUsdPer1M === null) return null;
  const cachedInputUsdPer1M = normalizePrice(source.cachedInputUsdPer1M ?? source.cached_input_usd_per_1m);
  return {
    inputUsdPer1M,
    outputUsdPer1M,
    ...(cachedInputUsdPer1M !== null ? { cachedInputUsdPer1M } : {}),
  };
}

export function parseAIRequestPricingCatalog(rawJson = process.env.AI_COST_PRICING_JSON || ''): PricingCatalog | null {
  const trimmed = rawJson.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const root = parsed as Record<string, unknown>;
  const rawModels = (root.models && typeof root.models === 'object')
    ? root.models as Record<string, unknown>
    : root;
  const models: Record<string, PricingEntry> = {};

  for (const [model, rawEntry] of Object.entries(rawModels)) {
    if (['source', 'version', 'currency'].includes(model)) continue;
    const entry = normalizeEntry(rawEntry);
    if (entry) {
      models[model] = entry;
    }
  }

  if (Object.keys(models).length === 0) return null;
  return {
    source: typeof root.source === 'string' && root.source.trim() ? root.source.trim() : 'env:AI_COST_PRICING_JSON',
    version: typeof root.version === 'string' && root.version.trim() ? root.version.trim() : 'unspecified',
    models,
  };
}

function normalizeRequiredModels(requiredModels: readonly string[]): string[] {
  return [...new Set(requiredModels.map((model) => model.trim()).filter(Boolean))];
}

export function validateAIRequestPricingCatalog(input: {
  rawJson?: string | null;
  requiredModels: readonly string[];
  generatedAt?: string;
}): AIRequestPricingCatalogValidationReport {
  const requiredModels = normalizeRequiredModels(input.requiredModels);
  const rawJson = input.rawJson ?? process.env.AI_COST_PRICING_JSON ?? '';
  const trimmed = rawJson.trim();
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  if (!trimmed) {
    return {
      ok: false,
      check: 'ai-cost-pricing-catalog',
      source: null,
      version: null,
      configuredModelCount: 0,
      requiredModels,
      missingModels: requiredModels,
      invalidReason: 'AI_COST_PRICING_JSON is required',
      generatedAt,
    };
  }

  let root: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('catalog must be a JSON object');
    }
    root = parsed as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      check: 'ai-cost-pricing-catalog',
      source: null,
      version: null,
      configuredModelCount: 0,
      requiredModels,
      missingModels: requiredModels,
      invalidReason: 'AI_COST_PRICING_JSON must be valid JSON object',
      generatedAt,
    };
  }

  const source = typeof root.source === 'string' && root.source.trim() ? root.source.trim() : null;
  const version = typeof root.version === 'string' && root.version.trim() ? root.version.trim() : null;
  const catalog = parseAIRequestPricingCatalog(trimmed);
  const configuredModels = catalog ? Object.keys(catalog.models).sort((a, b) => a.localeCompare(b)) : [];
  const missingModels = requiredModels.filter((model) => !configuredModels.includes(model));
  const invalidReason =
    !catalog ? 'AI_COST_PRICING_JSON must define at least one valid model price'
      : !source ? 'AI_COST_PRICING_JSON.source is required'
        : !version ? 'AI_COST_PRICING_JSON.version is required'
          : missingModels.length > 0 ? 'AI_COST_PRICING_JSON is missing required runtime models'
            : null;

  return {
    ok: invalidReason === null,
    check: 'ai-cost-pricing-catalog',
    source,
    version,
    configuredModelCount: configuredModels.length,
    requiredModels,
    missingModels,
    invalidReason,
    generatedAt,
  };
}

export function calculateAIRequestCost(input: AIRequestCostInput): AIRequestCostResult | null {
  const provider = (input.provider || 'openai').toLowerCase();
  if (provider !== 'openai') return null;

  const model = input.model?.trim();
  if (!model) return null;

  const catalog = parseAIRequestPricingCatalog();
  const pricing = catalog?.models[model];
  if (!catalog || !pricing) return null;

  const inputTokens = Math.max(0, Math.round(Number(input.inputTokens ?? 0)));
  const outputTokens = Math.max(0, Math.round(Number(input.outputTokens ?? 0)));
  if (inputTokens === 0 && outputTokens === 0) return null;

  const costUsd = roundUsd(
    (inputTokens / 1_000_000) * pricing.inputUsdPer1M
    + (outputTokens / 1_000_000) * pricing.outputUsdPer1M
  );

  return {
    costUsd,
    pricing: {
      source: catalog.source,
      version: catalog.version,
      model,
      inputUsdPer1M: pricing.inputUsdPer1M,
      outputUsdPer1M: pricing.outputUsdPer1M,
    },
  };
}
