import { PrismaClient } from '../src/types/prisma-client';

const DEFAULT_TIMEOUT_MS = 240_000;
const DEFAULT_INTERVAL_MS = 2_000;
const MAX_TIMEOUT_MS = 300_000;

export type AIRequestLedgerRuntimeOptions = {
  scopeType: string;
  scopeId: string;
  productFlow: string;
  requestKind: string;
  since: Date;
  timeoutMs: number;
  intervalMs: number;
};

export type AIRequestLedgerRuntimeRow = {
  status: string;
  completed_at: Date | null;
  total_tokens: number | null;
  cost_usd: { toString(): string } | number | string | null;
};

export type AIRequestLedgerRuntimeReport = {
  ok: boolean;
  check: 'ai-request-ledger-runtime';
  matched: boolean;
  status: string | null;
  completed: boolean;
  hasTokenUsage: boolean;
  hasAllocatedCost: boolean;
  reason:
    | null
    | 'no_match'
    | 'still_started'
    | 'terminal_not_succeeded'
    | 'missing_completed_at'
    | 'missing_token_usage'
    | 'missing_cost';
  generatedAt: string;
};

function readPositiveInteger(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function requireValue(name: string, value: string | undefined, maxLength: number): string {
  const normalized = value?.trim() || '';
  if (!normalized) throw new Error(`${name} is required`);
  if (normalized.length > maxLength) throw new Error(`${name} exceeds ${maxLength} characters`);
  return normalized;
}

export function parseAIRequestLedgerRuntimeArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): AIRequestLedgerRuntimeOptions {
  const values: Record<string, string | undefined> = {
    scopeType: env.AI_LEDGER_VERIFY_SCOPE_TYPE,
    scopeId: env.AI_LEDGER_VERIFY_SCOPE_ID,
    productFlow: env.AI_LEDGER_VERIFY_PRODUCT_FLOW,
    requestKind: env.AI_LEDGER_VERIFY_REQUEST_KIND,
    since: env.AI_LEDGER_VERIFY_SINCE,
    timeoutMs: env.AI_LEDGER_VERIFY_TIMEOUT_MS,
    intervalMs: env.AI_LEDGER_VERIFY_INTERVAL_MS,
  };

  for (const arg of argv) {
    if (arg.startsWith('--scope-type=')) values.scopeType = arg.slice('--scope-type='.length);
    else if (arg.startsWith('--scope-id=')) values.scopeId = arg.slice('--scope-id='.length);
    else if (arg.startsWith('--product-flow=')) values.productFlow = arg.slice('--product-flow='.length);
    else if (arg.startsWith('--request-kind=')) values.requestKind = arg.slice('--request-kind='.length);
    else if (arg.startsWith('--since=')) values.since = arg.slice('--since='.length);
    else if (arg.startsWith('--timeout-ms=')) values.timeoutMs = arg.slice('--timeout-ms='.length);
    else if (arg.startsWith('--interval-ms=')) values.intervalMs = arg.slice('--interval-ms='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  const sinceText = requireValue('since', values.since, 64);
  const since = new Date(sinceText);
  if (Number.isNaN(since.getTime())) throw new Error('since must be a valid ISO timestamp');

  return {
    scopeType: requireValue('scope-type', values.scopeType, 50),
    scopeId: requireValue('scope-id', values.scopeId, 200),
    productFlow: requireValue('product-flow', values.productFlow, 50),
    requestKind: requireValue('request-kind', values.requestKind, 50),
    since,
    timeoutMs: readPositiveInteger(values.timeoutMs, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS),
    intervalMs: readPositiveInteger(values.intervalMs, DEFAULT_INTERVAL_MS, 10_000),
  };
}

export function buildAIRequestLedgerRuntimeReport(
  row: AIRequestLedgerRuntimeRow | null,
  generatedAt = new Date().toISOString(),
): AIRequestLedgerRuntimeReport {
  const completed = Boolean(row?.completed_at);
  const hasTokenUsage = typeof row?.total_tokens === 'number' && row.total_tokens > 0;
  const parsedCost = row?.cost_usd === null || row?.cost_usd === undefined
    ? Number.NaN
    : Number(row.cost_usd.toString());
  const hasAllocatedCost = Number.isFinite(parsedCost) && parsedCost >= 0;

  let reason: AIRequestLedgerRuntimeReport['reason'] = null;
  if (!row) reason = 'no_match';
  else if (row.status === 'started') reason = 'still_started';
  else if (row.status !== 'succeeded') reason = 'terminal_not_succeeded';
  else if (!completed) reason = 'missing_completed_at';
  else if (!hasTokenUsage) reason = 'missing_token_usage';
  else if (!hasAllocatedCost) reason = 'missing_cost';

  return {
    ok: reason === null,
    check: 'ai-request-ledger-runtime',
    matched: Boolean(row),
    status: row?.status ?? null,
    completed,
    hasTokenUsage,
    hasAllocatedCost,
    reason,
    generatedAt,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  if (process.env.EMORAPY_RELEASE_GATE !== '1') {
    try {
      require('dotenv').config();
    } catch {
      // dotenv is optional when all inputs are supplied explicitly.
    }
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required');

  const options = parseAIRequestLedgerRuntimeArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const deadline = Date.now() + options.timeoutMs;
  let report = buildAIRequestLedgerRuntimeReport(null);

  try {
    do {
      const row = await prisma.aIRequestLedger.findFirst({
        where: {
          scope_type: options.scopeType,
          scope_id: options.scopeId,
          product_flow: options.productFlow,
          request_kind: options.requestKind,
          created_at: { gte: options.since },
        },
        select: {
          status: true,
          completed_at: true,
          total_tokens: true,
          cost_usd: true,
        },
        orderBy: { created_at: 'desc' },
      });
      report = buildAIRequestLedgerRuntimeReport(row);
      if (report.ok) break;
      if (report.reason === 'terminal_not_succeeded'
        || report.reason === 'missing_completed_at'
        || report.reason === 'missing_token_usage'
        || report.reason === 'missing_cost') {
        break;
      }
      if (Date.now() >= deadline) break;
      await wait(options.intervalMs);
    } while (Date.now() < deadline);
  } finally {
    await prisma.$disconnect();
  }

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 2;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      '[ai-request-ledger-runtime] failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
