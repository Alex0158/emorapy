import { validateAIRequestPricingCatalog } from '../src/services/ai-cost-pricing.service';

export function shouldLoadLocalDotenvForAIPricingCheck(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.EMORAPY_RELEASE_GATE !== '1' &&
    env.AI_PRICING_SKIP_DOTENV !== 'true'
  );
}

if (shouldLoadLocalDotenvForAIPricingCheck()) {
  try {
    // Load local env for direct script usage. Release gate must use only explicit env.
    require('dotenv').config();
  } catch {
    // dotenv is optional in some runtime environments.
  }
}

export function getRequiredAIPricingModelsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const configuredModels = [
    env.OPENAI_MODEL || 'gpt-3.5-turbo',
    env.OPENAI_INTERVIEW_MODEL || 'gpt-4o-mini',
    env.OPENAI_ANALYSIS_MODEL || 'gpt-4o',
    ...(env.AI_COST_REQUIRED_MODELS || '').split(','),
  ];

  return [...new Set(configuredModels.map((model) => model.trim()).filter(Boolean))];
}

export function getAIPricingMaxAgeDaysFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.AI_COST_PRICING_MAX_AGE_DAYS ?? 30);
  if (!Number.isFinite(parsed) || parsed < 0) return 30;
  return Math.floor(parsed);
}

async function main() {
  const requiredModels = getRequiredAIPricingModelsFromEnv();
  const maxAgeDays = getAIPricingMaxAgeDaysFromEnv();
  const report = validateAIRequestPricingCatalog({
    rawJson: process.env.AI_COST_PRICING_JSON,
    requiredModels,
    maxAgeDays,
  });

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[ai-pricing-catalog] failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
