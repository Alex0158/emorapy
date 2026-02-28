import Redis from 'ioredis';
import fs from 'node:fs';
import path from 'node:path';

function parseRedisInfoBlock(raw: string): Record<string, string> {
  const lines = raw.split('\n');
  const output: Record<string, string> = {};
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1).trim();
    output[key] = value;
  }
  return output;
}

async function readRedisCostSignals(redisUrl: string) {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: () => null,
  });
  redis.on('error', () => {});
  await redis.connect();
  try {
    const [memoryRaw, clientsRaw, keyCount] = await Promise.all([
      redis.info('memory'),
      redis.info('clients'),
      redis.dbsize(),
    ]);
    const memory = parseRedisInfoBlock(memoryRaw);
    const clients = parseRedisInfoBlock(clientsRaw);
    return {
      used_memory_human: memory.used_memory_human || null,
      used_memory_peak_human: memory.used_memory_peak_human || null,
      mem_fragmentation_ratio: memory.mem_fragmentation_ratio || null,
      connected_clients: clients.connected_clients || null,
      blocked_clients: clients.blocked_clients || null,
      dbsize: keyCount,
    };
  } finally {
    await redis.quit();
  }
}

async function main() {
  const reportPath = process.env.COST_REPORT_PATH || './tmp/bench-reports/cost-snapshot.json';
  const redisUrl = process.env.REDIS_URL || '';

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    redis: { status: 'skipped', reason: 'REDIS_URL not provided' },
    railway: {
      status: 'manual',
      message: 'Use Railway billing/dashboard (egress, RAM, CPU). Automating needs account/API token.',
    },
    openai: {
      status: 'manual',
      message: 'Use OpenAI usage/cost dashboard or API key with org usage permissions.',
    },
  };

  if (redisUrl) {
    try {
      report.redis = {
        status: 'ok',
        ...(await readRedisCostSignals(redisUrl)),
      };
    } catch (error) {
      report.redis = {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const absoluteReportPath = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(absoluteReportPath), { recursive: true });
  fs.writeFileSync(absoluteReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('[cost-snapshot] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
