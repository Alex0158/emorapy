import fs from 'node:fs';
import path from 'node:path';
import { runOpsAlertChecks } from '../src/services/ops-alerts.service';

function asNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  return fallback;
}

async function main() {
  const apiBaseUrl = process.env.API_BASE_URL || '';
  const redisUrl = process.env.METRICS_REDIS_URL || process.env.REDIS_URL || '';
  const healthTimeoutMs = asNumber(process.env.HEALTH_TIMEOUT_MS, 5000);
  const lookbackMinutes = asNumber(process.env.ALERT_LOOKBACK_MINUTES, 15);
  const minSamples = asNumber(process.env.ALERT_MIN_SAMPLES, 30);
  const max5xxRatio = asNumber(process.env.ALERT_MAX_5XX_RATIO, 0.05);
  const maxConflictRatio = asNumber(process.env.ALERT_MAX_CONFLICT_RATIO, 0.2);
  const slackDedupWindowSeconds = asNumber(process.env.ALERT_SLACK_DEDUP_WINDOW_SECONDS, 600);
  const outputPath = process.env.ALERT_REPORT_PATH || './tmp/bench-reports/ops-alert-check.json';
  const healthOrigin = process.env.ALERT_HEALTH_ORIGIN || '';
  const slackWebhookUrl = process.env.ALERT_SLACK_WEBHOOK_URL || '';

  if (!apiBaseUrl) {
    throw new Error('Missing API_BASE_URL');
  }
  const result = await runOpsAlertChecks({
    apiBaseUrl,
    redisUrl,
    healthTimeoutMs,
    lookbackMinutes,
    minSamples,
    max5xxRatio,
    maxConflictRatio,
    healthOrigin: healthOrigin || undefined,
    slackWebhookUrl: slackWebhookUrl || undefined,
    slackDedupWindowSeconds,
  });

  const absoluteOutputPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'alert' ? 2 : 0);
}

main().catch((error) => {
  console.error('[check-alerts] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
