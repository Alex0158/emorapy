import Redis from 'ioredis';
import { postSlackMessage } from './slack.service';

export type OpsCheckResult = {
  name: string;
  status: 'ok' | 'alert' | 'warn';
  message: string;
  data?: Record<string, unknown>;
};

export type OpsAlertResult = {
  generatedAt: string;
  apiBaseUrl: string;
  checks: OpsCheckResult[];
  status: 'ok' | 'alert';
  slack?: {
    attempted: boolean;
    sent: boolean;
    reason?: string;
  };
};

type HealthResponse = {
  checks?: Record<string, { status?: string; message?: string }>;
};

type OpsAlertCheckOptions = {
  apiBaseUrl: string;
  redisUrl?: string;
  healthTimeoutMs: number;
  lookbackMinutes: number;
  minSamples: number;
  max5xxRatio: number;
  maxConflictRatio: number;
  healthOrigin?: string;
  slackWebhookUrl?: string;
  slackDedupWindowSeconds?: number;
};

function toPercent(value: number): number {
  return Number((value * 100).toFixed(2));
}

function minuteBucket(date: Date): string {
  const yyyy = date.getUTCFullYear().toString().padStart(4, '0');
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = date.getUTCDate().toString().padStart(2, '0');
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mi = date.getUTCMinutes().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${mi}`;
}

async function fetchHealth(baseUrl: string, timeoutMs: number, origin?: string): Promise<HealthResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {};
    if (origin) headers.Origin = origin;
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) {
      throw new Error(`Health request failed: ${response.status}`);
    }
    return (await response.json()) as HealthResponse;
  } finally {
    clearTimeout(timer);
  }
}

async function getHttpSnapshot(redisUrl: string, lookbackMinutes: number) {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: () => null,
  });
  redis.on('error', () => {});
  await redis.connect();
  try {
    const now = new Date();
    const pipeline = redis.pipeline();
    for (let i = 0; i < lookbackMinutes; i++) {
      const bucket = new Date(now.getTime() - i * 60_000);
      const key = `ops:metrics:http:minute:${minuteBucket(bucket)}`;
      pipeline.hmget(key, 'total', 'status5xx', 'status409');
    }
    const rows = await pipeline.exec();
    let total = 0;
    let status5xx = 0;
    let status409 = 0;
    for (const [, payload] of rows || []) {
      const [rawTotal, raw5xx, raw409] = (payload as string[]) || [];
      total += Number(rawTotal || '0');
      status5xx += Number(raw5xx || '0');
      status409 += Number(raw409 || '0');
    }
    return { total, status5xx, status409 };
  } finally {
    await redis.quit();
  }
}

async function shouldSendSlackAlert(
  redisUrl: string | undefined,
  dedupeKey: string,
  windowSeconds: number
): Promise<boolean> {
  if (!redisUrl) return true;
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: () => null,
  });
  redis.on('error', () => {});
  await redis.connect();
  try {
    const result = await redis.set(dedupeKey, '1', 'EX', windowSeconds, 'NX');
    return result === 'OK';
  } finally {
    await redis.quit();
  }
}

async function trySendSlackNotification(
  checks: OpsCheckResult[],
  options: OpsAlertCheckOptions
): Promise<OpsAlertResult['slack']> {
  if (!options.slackWebhookUrl) {
    return { attempted: false, sent: false, reason: 'missing webhook' };
  }
  const alertChecks = checks.filter((item) => item.status === 'alert');
  if (alertChecks.length === 0) {
    return { attempted: false, sent: false, reason: 'no alert' };
  }

  const dedupeWindow = Math.max(options.slackDedupWindowSeconds || 600, 60);
  const dedupeKey = `ops:alerts:slack:${alertChecks.map((c) => c.name).sort().join(',')}`;
  const canSend = await shouldSendSlackAlert(options.redisUrl, dedupeKey, dedupeWindow);
  if (!canSend) {
    return { attempted: true, sent: false, reason: 'deduped' };
  }

  const text = alertChecks.map((item) => `• ${item.name}: ${item.message}`).join('\n');
  await postSlackMessage({
    webhookUrl: options.slackWebhookUrl,
    title: 'CJ Platform Ops Alert',
    text,
    color: 'danger',
    fields: [
      { title: 'API Base URL', value: options.apiBaseUrl, short: false },
      { title: 'Lookback (min)', value: String(options.lookbackMinutes), short: true },
      { title: 'Generated At', value: new Date().toISOString(), short: true },
    ],
  });

  return { attempted: true, sent: true };
}

export async function runOpsAlertChecks(options: OpsAlertCheckOptions): Promise<OpsAlertResult> {
  const checks: OpsCheckResult[] = [];
  const health = await fetchHealth(options.apiBaseUrl, options.healthTimeoutMs, options.healthOrigin);
  const lockStatus = health.checks?.lock?.status;
  if (lockStatus === 'degraded' || lockStatus === 'unhealthy') {
    checks.push({
      name: 'health.lock',
      status: 'alert',
      message: 'Lock backend is degraded/unhealthy',
      data: { lockStatus, lockMessage: health.checks?.lock?.message || null },
    });
  } else {
    checks.push({
      name: 'health.lock',
      status: 'ok',
      message: 'Lock backend is healthy',
      data: { lockStatus: lockStatus || 'unknown' },
    });
  }

  if (!options.redisUrl) {
    checks.push({
      name: 'http.ratio',
      status: 'warn',
      message: 'REDIS_URL not provided, skip 5xx/conflict ratio checks',
    });
  } else {
    const snapshot = await getHttpSnapshot(options.redisUrl, options.lookbackMinutes);
    const total = snapshot.total;
    const ratio5xx = total > 0 ? snapshot.status5xx / total : 0;
    const ratioConflict = total > 0 ? snapshot.status409 / total : 0;

    if (total < options.minSamples) {
      checks.push({
        name: 'http.sample-size',
        status: 'warn',
        message: 'Not enough samples for ratio alert decision',
        data: { total, minSamples: options.minSamples, lookbackMinutes: options.lookbackMinutes },
      });
    }

    checks.push({
      name: 'http.5xx.ratio',
      status: total >= options.minSamples && ratio5xx > options.max5xxRatio ? 'alert' : 'ok',
      message: `5xx ratio ${toPercent(ratio5xx)}% (threshold ${toPercent(options.max5xxRatio)}%)`,
      data: { total, status5xx: snapshot.status5xx, lookbackMinutes: options.lookbackMinutes },
    });
    checks.push({
      name: 'http.conflict.ratio',
      status: total >= options.minSamples && ratioConflict > options.maxConflictRatio ? 'alert' : 'ok',
      message: `409 ratio ${toPercent(ratioConflict)}% (threshold ${toPercent(options.maxConflictRatio)}%)`,
      data: { total, status409: snapshot.status409, lookbackMinutes: options.lookbackMinutes },
    });
  }

  const hasAlert = checks.some((check) => check.status === 'alert');
  const slack = await trySendSlackNotification(checks, options).catch((error) => {
    return {
      attempted: true,
      sent: false,
      reason: `failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    apiBaseUrl: options.apiBaseUrl,
    checks,
    status: hasAlert ? 'alert' : 'ok',
    slack,
  };
}

