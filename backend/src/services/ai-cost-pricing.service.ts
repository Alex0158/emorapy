type PricingEntry = {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  cachedInputUsdPer1M?: number;
};

type PricingCatalog = {
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

function parsePricingCatalog(rawJson = process.env.AI_COST_PRICING_JSON || ''): PricingCatalog | null {
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

export function calculateAIRequestCost(input: AIRequestCostInput): AIRequestCostResult | null {
  const provider = (input.provider || 'openai').toLowerCase();
  if (provider !== 'openai') return null;

  const model = input.model?.trim();
  if (!model) return null;

  const catalog = parsePricingCatalog();
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
