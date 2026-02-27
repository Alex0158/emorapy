/**
 * Admin jobs/stats 壓測腳本（只讀）
 *
 * 使用方式：
 * ADMIN_TOKEN=xxx npx tsx scripts/benchmark-admin-job-stats.ts
 *
 * 可選環境變數：
 * - API_BASE_URL (default: http://localhost:3001/api/v1)
 * - RUNS (default: 20)
 * - CONCURRENCY (default: 1)
 * - DAYS (default: 30)
 * - MAX_ROWS (default: 5000)
 * - INCLUDE_RUNNING (default: true)
 */

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
const adminToken = process.env.ADMIN_TOKEN || '';
const runs = Number(process.env.RUNS || 20);
const concurrency = Math.max(1, Number(process.env.CONCURRENCY || 1));
const days = Number(process.env.DAYS || 30);
const maxRows = Number(process.env.MAX_ROWS || 5000);
const includeRunning = String(process.env.INCLUDE_RUNNING || 'true').toLowerCase() === 'true';

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function main() {
  const url = new URL(`${apiBaseUrl}/admin/jobs/stats`);
  url.searchParams.set('days', String(days));
  url.searchParams.set('maxRows', String(maxRows));
  url.searchParams.set('includeRunning', String(includeRunning));

  const headers: Record<string, string> = {};
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;

  const latencies: number[] = [];
  let ok = 0;
  let failed = 0;
  const wallStart = performance.now();

  let cursor = 0;
  async function worker(workerIdx: number) {
    while (true) {
      const runIdx = cursor;
      cursor += 1;
      if (runIdx >= runs) return;
      const start = performance.now();
      try {
        const response = await fetch(url, { method: 'GET', headers });
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
        if (response.ok) {
          ok += 1;
        } else {
          failed += 1;
          console.log(`[worker ${workerIdx}] run=${runIdx + 1} status=${response.status} latency=${elapsed.toFixed(2)}ms`);
        }
      } catch (error) {
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
        failed += 1;
        console.log(`[worker ${workerIdx}] run=${runIdx + 1} error latency=${elapsed.toFixed(2)}ms`, error);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, (_, idx) => worker(idx + 1)));
  const wallElapsedMs = performance.now() - wallStart;

  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = latencies.length > 0 ? latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length : 0;
  const successRate = runs > 0 ? (ok / runs) * 100 : 0;
  const throughputRps = wallElapsedMs > 0 ? (runs / wallElapsedMs) * 1000 : 0;

  console.log('\n=== admin/jobs/stats benchmark ===');
  console.log(`url: ${url.toString()}`);
  console.log(`runs: ${runs}, concurrency: ${concurrency}, ok: ${ok}, failed: ${failed}`);
  console.log(`successRate: ${successRate.toFixed(2)}%`);
  console.log(`throughput: ${throughputRps.toFixed(2)} req/s`);
  console.log(`wallTime: ${wallElapsedMs.toFixed(2)}ms`);
  console.log(`avg: ${avg.toFixed(2)}ms`);
  console.log(`p50: ${percentile(sorted, 50).toFixed(2)}ms`);
  console.log(`p95: ${percentile(sorted, 95).toFixed(2)}ms`);
  console.log(`p99: ${percentile(sorted, 99).toFixed(2)}ms`);
}

main().catch((error) => {
  console.error('benchmark failed', error);
  process.exit(1);
});
