import { validateAIRequestPricingCatalog } from '../src/services/ai-cost-pricing.service';

try {
  // Load local env for direct script usage; release gate should pass ENV_FILE or explicit env.
  require('dotenv').config();
} catch {
  // dotenv is optional in some runtime environments.
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

async function main() {
  const requiredModels = getRequiredAIPricingModelsFromEnv();
  const report = validateAIRequestPricingCatalog({
    rawJson: process.env.AI_COST_PRICING_JSON,
    requiredModels,
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
