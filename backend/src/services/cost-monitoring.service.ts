import Redis from 'ioredis';
import { getAIRequestLedgerProductFlow } from '../utils/ai-ledger-source';

type DataStatus = 'ok' | 'partial' | 'unavailable';
const EXTERNAL_API_TIMEOUT_MS = 8000;

type DailyPoint = {
  date: string;
  value: number;
};

type AIRequestLedgerProductFlowPoint = {
  productFlow: string;
  requestCount24h: number;
  requestCount7d: number;
  succeededRequests7d: number;
  failedRequests7d: number;
  cancelledRequests7d: number;
  inputTokens24h: number;
  outputTokens24h: number;
  totalTokens24h: number;
  inputTokens7d: number;
  outputTokens7d: number;
  totalTokens7d: number;
  costUsd24h: number | null;
  costUsd7d: number | null;
  costSource: 'ledger_cost_usd' | 'not_allocated';
};

export type AdminCostReport = {
  generatedAt: string;
  currency: 'USD';
  partial: boolean;
  reasons: string[];
  summary: {
    redisMemoryMb: number;
    redisTotalKeys: number;
    railwayEgressGb24h: number;
    railwayEgressGb7d: number;
    openaiCostUsd24h: number;
    openaiCostUsd7d: number;
    openaiInputTokens24h: number;
    openaiOutputTokens24h: number;
  };
  redis: {
    status: DataStatus;
    memoryUsedBytes: number;
    connectedClients: number;
    totalKeys: number;
  };
  railway: {
    status: DataStatus;
    egressGb24h: number;
    egressGb7d: number;
    dailyEgressGb: DailyPoint[];
    note?: string;
  };
  openai: {
    status: DataStatus;
    costUsd24h: number;
    costUsd7d: number;
    inputTokens24h: number;
    outputTokens24h: number;
    dailyCostUsd: DailyPoint[];
    note?: string;
    ledger: {
      status: DataStatus;
      source: 'ai_request_ledger';
      costSource: 'ledger_cost_usd' | 'not_allocated';
      requestCount24h: number;
      requestCount7d: number;
      inputTokens24h: number;
      outputTokens24h: number;
      totalTokens24h: number;
      inputTokens7d: number;
      outputTokens7d: number;
      totalTokens7d: number;
      productFlows: AIRequestLedgerProductFlowPoint[];
      note?: string;
    };
  };
};

type AIRequestLedgerRow = {
  product_flow: string | null;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | string | { toString(): string } | null;
  created_at: Date;
};

type CostMonitoringPrisma = {
  aiRequestLedger: {
    findMany(args: unknown): Promise<AIRequestLedgerRow[]>;
  };
};

let prismaLoader: (() => CostMonitoringPrisma) | null = null;

function loadPrisma(): CostMonitoringPrisma {
  if (!prismaLoader) {
    prismaLoader = () => require('../config/database').default as CostMonitoringPrisma;
  }
  return prismaLoader();
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, fraction = 4): number {
  const factor = 10 ** fraction;
  return Math.round(value * factor) / factor;
}

function decimalToNumber(value: AIRequestLedgerRow['cost_usd']): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(typeof value === 'object' ? value.toString() : value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = EXTERNAL_API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function collectNumericByKey(node: unknown, keyPattern: RegExp, out: Array<{ key: string; value: number }>) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectNumericByKey(item, keyPattern, out);
    }
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (keyPattern.test(key) && typeof value === 'number' && Number.isFinite(value)) {
      out.push({ key, value });
    }
    collectNumericByKey(value, keyPattern, out);
  }
}

function parseRedisInfo(info: string): Record<string, string> {
  const map: Record<string, string> = {};
  const lines = info.split('\n');
  for (const line of lines) {
    if (!line || line.startsWith('#') || !line.includes(':')) continue;
    const index = line.indexOf(':');
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    map[key] = value;
  }
  return map;
}

async function readRedisSignals(redisUrl: string): Promise<AdminCostReport['redis']> {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: () => null,
  });
  redis.on('error', () => {});
  await redis.connect();
  try {
    const [memoryInfo, clientsInfo, totalKeys] = await Promise.all([
      redis.info('memory'),
      redis.info('clients'),
      redis.dbsize(),
    ]);
    const memoryMap = parseRedisInfo(memoryInfo);
    const clientsMap = parseRedisInfo(clientsInfo);
    return {
      status: 'ok',
      memoryUsedBytes: toNumber(memoryMap.used_memory),
      connectedClients: toNumber(clientsMap.connected_clients),
      totalKeys: toNumber(totalKeys),
    };
  } finally {
    await redis.quit();
  }
}

async function fetchRailwayEgressFromApi(): Promise<{
  status: DataStatus;
  egressGb24h: number;
  egressGb7d: number;
  dailyEgressGb: DailyPoint[];
  note?: string;
}> {
  const token = (process.env.RAILWAY_API_TOKEN || '').trim();
  const projectId = (process.env.RAILWAY_PROJECT_ID || '').trim();
  const environmentId = (process.env.RAILWAY_ENVIRONMENT_ID || '').trim();
  if (!token || !projectId) {
    return {
      status: 'unavailable',
      egressGb24h: 0,
      egressGb7d: 0,
      dailyEgressGb: [],
      note: 'missing RAILWAY_API_TOKEN or RAILWAY_PROJECT_ID',
    };
  }

  const now = new Date();
  const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const query = `
    query UsageMetrics(
      $projectId: String!,
      $environmentId: String,
      $start7d: DateTime!,
      $start24h: DateTime!,
      $endDate: DateTime!
    ) {
      usage7d: usage(
        projectId: $projectId,
        startDate: $start7d,
        endDate: $endDate,
        measurements: [NETWORK_TX_GB],
        groupBy: [ENVIRONMENT_ID]
      ) {
        tags {
          environmentId
        }
        value
      }
      usage24h: usage(
        projectId: $projectId,
        startDate: $start24h,
        endDate: $endDate,
        measurements: [NETWORK_TX_GB],
        groupBy: [ENVIRONMENT_ID]
      ) {
        tags {
          environmentId
        }
        value
      }
      metricsDaily: metrics(
        projectId: $projectId,
        environmentId: $environmentId,
        startDate: $start7d,
        endDate: $endDate,
        measurements: [NETWORK_TX_GB],
        sampleRateSeconds: 86400
      ) {
        tags {
          environmentId
        }
        values {
          ts
          value
        }
      }
    }
  `;

  const response = await fetchWithTimeout('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables: {
        projectId,
        environmentId: environmentId || null,
        start7d,
        start24h,
        endDate: now.toISOString(),
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Railway API failed: ${response.status}`);
  }
  const json = (await response.json()) as Record<string, unknown>;
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    const first = json.errors[0] as Record<string, unknown>;
    const message = typeof first?.message === 'string' ? first.message : 'unknown graphql error';
    throw new Error(`Railway API graphql error: ${message}`);
  }
  const data = (json.data || {}) as Record<string, unknown>;
  const usage7dRows = (data.usage7d || []) as Array<Record<string, unknown>>;
  const usage24hRows = (data.usage24h || []) as Array<Record<string, unknown>>;
  const metricsDailyRows = (data.metricsDaily || []) as Array<Record<string, unknown>>;

  const shouldIncludeRow = (row: Record<string, unknown>) => {
    if (!environmentId) return true;
    const tags = (row.tags || {}) as Record<string, unknown>;
    return String(tags.environmentId || '') === environmentId;
  };

  const egressGb7d = round(
    usage7dRows
      .filter(shouldIncludeRow)
      .reduce((sum, row) => sum + toNumber(row.value), 0)
  );
  const egressGb24h = round(
    usage24hRows
      .filter(shouldIncludeRow)
      .reduce((sum, row) => sum + toNumber(row.value), 0)
  );

  const dailyMap = new Map<string, number>();
  for (const row of metricsDailyRows.filter(shouldIncludeRow)) {
    const values = (row.values || []) as Array<Record<string, unknown>>;
    for (const point of values) {
      const ts = toNumber(point.ts);
      const value = toNumber(point.value);
      const date = new Date((ts > 0 ? ts : Math.floor(Date.now() / 1000)) * 1000).toISOString().slice(0, 10);
      dailyMap.set(date, round((dailyMap.get(date) || 0) + value));
    }
  }
  const dailyEgressGb = Array.from(dailyMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([date, value]) => ({ date, value: round(value) }));

  if (usage7dRows.length === 0 && usage24hRows.length === 0 && dailyEgressGb.length === 0) {
    return {
      status: 'partial',
      egressGb24h: 0,
      egressGb7d: 0,
      dailyEgressGb: [],
      note: 'railway response has no usage rows',
    };
  }
  return {
    status: 'ok',
    egressGb24h,
    egressGb7d,
    dailyEgressGb,
  };
}

async function fetchOpenAICostsFromApi(): Promise<{
  status: DataStatus;
  costUsd24h: number;
  costUsd7d: number;
  inputTokens24h: number;
  outputTokens24h: number;
  dailyCostUsd: DailyPoint[];
  note?: string;
}> {
  const key = (process.env.OPENAI_BILLING_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  const organization = (process.env.OPENAI_ORG_ID || '').trim();
  if (!key) {
    return {
      status: 'unavailable',
      costUsd24h: 0,
      costUsd7d: 0,
      inputTokens24h: 0,
      outputTokens24h: 0,
      dailyCostUsd: [],
      note: 'missing OPENAI_BILLING_API_KEY (or OPENAI_API_KEY)',
    };
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const startUnix = nowUnix - 7 * 24 * 60 * 60;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  };
  if (organization) headers['OpenAI-Organization'] = organization;

  const [costResponse, usageResponse] = await Promise.all([
    fetchWithTimeout(`https://api.openai.com/v1/organization/costs?start_time=${startUnix}&end_time=${nowUnix}&bucket_width=1d`, {
      headers,
    }),
    fetchWithTimeout(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${startUnix}&end_time=${nowUnix}&bucket_width=1d`,
      { headers }
    ),
  ]);

  if (!costResponse.ok) {
    throw new Error(`OpenAI costs API failed: ${costResponse.status}`);
  }
  if (!usageResponse.ok) {
    throw new Error(`OpenAI usage API failed: ${usageResponse.status}`);
  }

  const costJson = (await costResponse.json()) as Record<string, unknown>;
  const usageJson = (await usageResponse.json()) as Record<string, unknown>;

  const costRows = (costJson.data || []) as Array<Record<string, unknown>>;
  const dailyCostUsd = costRows.map((row) => {
    const startTime = toNumber(row.start_time) * 1000;
    const amountObj = row.amount as Record<string, unknown> | undefined;
    const amountValue = amountObj ? toNumber(amountObj.value) : 0;
    return {
      date: new Date(startTime || Date.now()).toISOString().slice(0, 10),
      value: round(amountValue, 6),
    };
  });
  const costUsd7d = round(dailyCostUsd.reduce((sum, point) => sum + point.value, 0), 6);
  const costUsd24h = round(dailyCostUsd.slice(-1).reduce((sum, point) => sum + point.value, 0), 6);

  const tokenValues: Array<{ key: string; value: number }> = [];
  collectNumericByKey(usageJson.data || usageJson, /(input_tokens|output_tokens)/i, tokenValues);
  const inputTokens24h = tokenValues
    .filter((item) => /input_tokens/i.test(item.key))
    .reduce((sum, item) => sum + item.value, 0);
  const outputTokens24h = tokenValues
    .filter((item) => /output_tokens/i.test(item.key))
    .reduce((sum, item) => sum + item.value, 0);

  return {
    status: 'ok',
    costUsd24h: round(costUsd24h, 6),
    costUsd7d: round(costUsd7d, 6),
    inputTokens24h: Math.round(inputTokens24h),
    outputTokens24h: Math.round(outputTokens24h),
    dailyCostUsd,
  };
}

function emptyLedgerReport(note?: string): AdminCostReport['openai']['ledger'] {
  return {
    status: 'ok',
    source: 'ai_request_ledger',
    costSource: 'not_allocated',
    requestCount24h: 0,
    requestCount7d: 0,
    inputTokens24h: 0,
    outputTokens24h: 0,
    totalTokens24h: 0,
    inputTokens7d: 0,
    outputTokens7d: 0,
    totalTokens7d: 0,
    productFlows: [],
    note,
  };
}

async function readAIRequestLedgerBreakdown(): Promise<AdminCostReport['openai']['ledger']> {
  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since24hMs = now - 24 * 60 * 60 * 1000;

  const rows = await loadPrisma().aiRequestLedger.findMany({
    where: { created_at: { gte: since7d } },
    select: {
      product_flow: true,
      status: true,
      input_tokens: true,
      output_tokens: true,
      total_tokens: true,
      cost_usd: true,
      created_at: true,
    },
  });

  if (rows.length === 0) {
    return emptyLedgerReport('no ai_request_ledger rows in the last 7 days');
  }

  const byFlow = new Map<string, AIRequestLedgerProductFlowPoint>();
  const totals = emptyLedgerReport();
  let hasAllocatedCost = false;

  const getFlow = (flow: string) => {
    const existing = byFlow.get(flow);
    if (existing) return existing;
    const created: AIRequestLedgerProductFlowPoint = {
      productFlow: flow,
      requestCount24h: 0,
      requestCount7d: 0,
      succeededRequests7d: 0,
      failedRequests7d: 0,
      cancelledRequests7d: 0,
      inputTokens24h: 0,
      outputTokens24h: 0,
      totalTokens24h: 0,
      inputTokens7d: 0,
      outputTokens7d: 0,
      totalTokens7d: 0,
      costUsd24h: null,
      costUsd7d: null,
      costSource: 'not_allocated',
    };
    byFlow.set(flow, created);
    return created;
  };

  for (const row of rows) {
    const flow = getAIRequestLedgerProductFlow(row.product_flow);
    const point = getFlow(flow);
    const createdAtMs = new Date(row.created_at).getTime();
    const is24h = Number.isFinite(createdAtMs) && createdAtMs >= since24hMs;
    const inputTokens = Math.max(0, Math.round(toNumber(row.input_tokens)));
    const outputTokens = Math.max(0, Math.round(toNumber(row.output_tokens)));
    const totalTokens = Math.max(0, Math.round(toNumber(row.total_tokens)));
    const costUsd = decimalToNumber(row.cost_usd);

    point.requestCount7d += 1;
    totals.requestCount7d += 1;
    if (row.status === 'succeeded') point.succeededRequests7d += 1;
    if (row.status === 'failed') point.failedRequests7d += 1;
    if (row.status === 'cancelled') point.cancelledRequests7d += 1;

    point.inputTokens7d += inputTokens;
    point.outputTokens7d += outputTokens;
    point.totalTokens7d += totalTokens;
    totals.inputTokens7d += inputTokens;
    totals.outputTokens7d += outputTokens;
    totals.totalTokens7d += totalTokens;

    if (costUsd !== null) {
      hasAllocatedCost = true;
      point.costSource = 'ledger_cost_usd';
      point.costUsd7d = round((point.costUsd7d || 0) + costUsd, 6);
      totals.costSource = 'ledger_cost_usd';
    }

    if (is24h) {
      point.requestCount24h += 1;
      totals.requestCount24h += 1;
      point.inputTokens24h += inputTokens;
      point.outputTokens24h += outputTokens;
      point.totalTokens24h += totalTokens;
      totals.inputTokens24h += inputTokens;
      totals.outputTokens24h += outputTokens;
      totals.totalTokens24h += totalTokens;
      if (costUsd !== null) {
        point.costUsd24h = round((point.costUsd24h || 0) + costUsd, 6);
      }
    }
  }

  totals.status = 'ok';
  totals.productFlows = Array.from(byFlow.values())
    .map((point) => ({
      ...point,
      costUsd24h: point.costUsd24h === null ? null : round(point.costUsd24h, 6),
      costUsd7d: point.costUsd7d === null ? null : round(point.costUsd7d, 6),
    }))
    .sort((a, b) => b.totalTokens7d - a.totalTokens7d || a.productFlow.localeCompare(b.productFlow));
  totals.note = hasAllocatedCost
    ? 'cost_usd is sourced from ai_request_ledger only'
    : 'request and token breakdown is from ai_request_ledger; cost_usd is not allocated yet';
  return totals;
}

class CostMonitoringService {
  async getAdminCostReport(): Promise<AdminCostReport> {
    const reasons: string[] = [];

    let redis: AdminCostReport['redis'] = {
      status: 'unavailable',
      memoryUsedBytes: 0,
      connectedClients: 0,
      totalKeys: 0,
    };
    const redisUrl = (process.env.REDIS_URL || '').trim();
    if (redisUrl) {
      try {
        redis = await readRedisSignals(redisUrl);
      } catch (error) {
        redis = { ...redis, status: 'partial' };
        reasons.push(`redis: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      reasons.push('redis: missing REDIS_URL');
    }

    let railway: Awaited<ReturnType<typeof fetchRailwayEgressFromApi>> = {
      status: 'unavailable' as DataStatus,
      egressGb24h: 0,
      egressGb7d: 0,
      dailyEgressGb: [] as DailyPoint[],
      note: 'not configured',
    };
    try {
      railway = await fetchRailwayEgressFromApi();
      if (railway.status !== 'ok' && railway.note) reasons.push(`railway: ${railway.note}`);
    } catch (error) {
      railway = { ...railway, status: 'partial', note: 'request failed' };
      reasons.push(`railway: ${error instanceof Error ? error.message : String(error)}`);
    }

    let openai: Awaited<ReturnType<typeof fetchOpenAICostsFromApi>> = {
      status: 'unavailable' as DataStatus,
      costUsd24h: 0,
      costUsd7d: 0,
      inputTokens24h: 0,
      outputTokens24h: 0,
      dailyCostUsd: [] as DailyPoint[],
      note: 'not configured',
    };
    try {
      openai = await fetchOpenAICostsFromApi();
      if (openai.status !== 'ok' && openai.note) reasons.push(`openai: ${openai.note}`);
    } catch (error) {
      openai = { ...openai, status: 'partial', note: 'request failed' };
      reasons.push(`openai: ${error instanceof Error ? error.message : String(error)}`);
    }

    let ledger = emptyLedgerReport('not loaded');
    try {
      ledger = await readAIRequestLedgerBreakdown();
      if (ledger.status !== 'ok' && ledger.note) reasons.push(`openai ledger: ${ledger.note}`);
    } catch (error) {
      ledger = { ...emptyLedgerReport('request failed'), status: 'partial' };
      reasons.push(`openai ledger: ${error instanceof Error ? error.message : String(error)}`);
    }

    const partial = [redis.status, railway.status, openai.status, ledger.status].some((status) => status !== 'ok');

    return {
      generatedAt: new Date().toISOString(),
      currency: 'USD',
      partial,
      reasons,
      summary: {
        redisMemoryMb: round(redis.memoryUsedBytes / (1024 * 1024), 2),
        redisTotalKeys: redis.totalKeys,
        railwayEgressGb24h: railway.egressGb24h,
        railwayEgressGb7d: railway.egressGb7d,
        openaiCostUsd24h: openai.costUsd24h,
        openaiCostUsd7d: openai.costUsd7d,
        openaiInputTokens24h: ledger.status === 'ok' ? ledger.inputTokens24h : openai.inputTokens24h,
        openaiOutputTokens24h: ledger.status === 'ok' ? ledger.outputTokens24h : openai.outputTokens24h,
      },
      redis,
      railway,
      openai: {
        ...openai,
        ledger,
      },
    };
  }
}

export const costMonitoringService = new CostMonitoringService();
