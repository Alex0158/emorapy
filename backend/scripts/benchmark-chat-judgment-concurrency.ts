/**
 * Chat request-judgment 並發驗證腳本
 *
 * 目的：
 * - 驗證同聊天室高併發觸發判決時，是否出現重複建案/重複 link。
 * - 可對單機或負載均衡入口執行，用於跨進程一致性驗證。
 *
 * 使用方式：
 * AUTH_TOKEN=xxx npx tsx scripts/benchmark-chat-judgment-concurrency.ts
 * 或
 * SESSION_ID=guest_xxx npx tsx scripts/benchmark-chat-judgment-concurrency.ts
 *
 * 可選環境變數：
 * - API_BASE_URL (default: http://localhost:3001/api/v1)
 * - BURST_SIZE (default: 20)
 * - HISTORY_VISIBILITY_MODE (default: share_summary_only)
 * - MESSAGE_CONTENT (default: 昨天又發生爭執，我希望得到具體判決建議。)
 * - STATUS_POLL_TIMES (default: 15)
 * - STATUS_POLL_INTERVAL_MS (default: 1000)
 * - REQUEST_TIMEOUT_MS (default: 15000)
 * - DRY_RUN (default: false) 僅檢查參數，不發送請求
 */

type JsonObject = Record<string, unknown>;
import { writeFile } from 'node:fs/promises';

type RequestResult = {
  idx: number;
  httpStatus: number;
  ok: boolean;
  code?: string;
  caseId?: string;
  judgmentId?: string;
  linkId?: string;
  raw?: unknown;
};

function parsePositiveIntEnv(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max?: number
): number {
  const clamp = (value: number): number => {
    const minBounded = value < min ? min : value;
    if (typeof max === 'number' && minBounded > max) return max;
    return minBounded;
  };

  if (raw === undefined || raw.trim() === '') {
    const clampedFallback = clamp(fallback);
    if (clampedFallback !== fallback) {
      console.warn(`⚠️ ${name} 未提供，預設值 ${fallback} 超出邊界，已夾制為 ${clampedFallback}`);
    }
    return clampedFallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    console.warn(`⚠️ ${name}=${raw} 非法，回退預設值 ${fallback}`);
    const clampedFallback = clamp(fallback);
    if (clampedFallback !== fallback) {
      console.warn(`⚠️ ${name} 預設值 ${fallback} 超出邊界，已夾制為 ${clampedFallback}`);
    }
    return clampedFallback;
  }
  const normalized = Math.floor(parsed);
  const clamped = clamp(normalized);
  if (clamped !== normalized) {
    const bound = normalized < min ? `下限 ${min}` : `上限 ${max}`;
    console.warn(`⚠️ ${name}=${raw} 超出${bound}，已夾制為 ${clamped}`);
  }
  return clamped;
}

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
const authToken = process.env.AUTH_TOKEN || '';
const sessionId = process.env.SESSION_ID || '';
const burstSize = parsePositiveIntEnv('BURST_SIZE', process.env.BURST_SIZE, 20, 2, 200);
const historyVisibilityMode = process.env.HISTORY_VISIBILITY_MODE || 'share_summary_only';
const messageContent = process.env.MESSAGE_CONTENT || '昨天又發生爭執，我希望得到具體判決建議。';
const statusPollTimes = parsePositiveIntEnv('STATUS_POLL_TIMES', process.env.STATUS_POLL_TIMES, 15, 1, 120);
const statusPollIntervalMs = parsePositiveIntEnv('STATUS_POLL_INTERVAL_MS', process.env.STATUS_POLL_INTERVAL_MS, 1000, 200, 60000);
const requestTimeoutMs = parsePositiveIntEnv('REQUEST_TIMEOUT_MS', process.env.REQUEST_TIMEOUT_MS, 15000, 1000, 120000);
const dryRun = String(process.env.DRY_RUN || 'false').toLowerCase() === 'true';
const reportPath = process.env.REPORT_PATH || '';

function buildHeaders(): Record<string, string> {
  if (!authToken && !sessionId) {
    throw new Error('請提供 AUTH_TOKEN 或 SESSION_ID');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (!authToken && sessionId) headers['x-session-id'] = sessionId;
  return headers;
}

async function requestJson(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const res = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBodyCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const maybeObj = body as JsonObject;
  const error = maybeObj.error;
  if (!error || typeof error !== 'object') return undefined;
  return (error as JsonObject).code as string | undefined;
}

function getBodyData(body: unknown): JsonObject | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const maybeObj = body as JsonObject;
  const data = maybeObj.data;
  if (!data || typeof data !== 'object') return undefined;
  return data as JsonObject;
}

function buildSummary(results: RequestResult[]) {
  const statusCount = new Map<number, number>();
  const codeCount = new Map<string, number>();
  const caseIds = new Set<string>();
  const linkIds = new Set<string>();
  const judgmentIds = new Set<string>();

  for (const r of results) {
    statusCount.set(r.httpStatus, (statusCount.get(r.httpStatus) || 0) + 1);
    if (r.code) codeCount.set(r.code, (codeCount.get(r.code) || 0) + 1);
    if (r.caseId) caseIds.add(r.caseId);
    if (r.linkId) linkIds.add(r.linkId);
    if (r.judgmentId) judgmentIds.add(r.judgmentId);
  }

  return {
    burstSize: results.length,
    statusCount: Object.fromEntries(statusCount),
    codeCount: Object.fromEntries(codeCount),
    uniqueCaseIds: Array.from(caseIds),
    uniqueLinkIds: Array.from(linkIds),
    uniqueJudgmentIds: Array.from(judgmentIds),
  };
}

function printSummary(summary: ReturnType<typeof buildSummary>) {
  console.log('\n=== request-judgment burst summary ===');
  console.log(`burstSize: ${summary.burstSize}`);
  console.log(`http status count: ${JSON.stringify(summary.statusCount)}`);
  console.log(`error code count: ${JSON.stringify(summary.codeCount)}`);
  console.log(`unique caseIds: ${summary.uniqueCaseIds.length} -> ${JSON.stringify(summary.uniqueCaseIds)}`);
  console.log(`unique linkIds: ${summary.uniqueLinkIds.length} -> ${JSON.stringify(summary.uniqueLinkIds)}`);
  console.log(`unique judgmentIds: ${summary.uniqueJudgmentIds.length} -> ${JSON.stringify(summary.uniqueJudgmentIds)}`);
}

async function writeReport(report: unknown) {
  if (!reportPath) return;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`report written: ${reportPath}`);
}

async function main() {
  console.log('=== chat judgment concurrency benchmark ===');
  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        burstSize,
        historyVisibilityMode,
        statusPollTimes,
        statusPollIntervalMs,
        requestTimeoutMs,
        useAuthToken: Boolean(authToken),
        useSessionId: Boolean(!authToken && sessionId),
        dryRun,
      },
      null,
      2
    )
  );

  if (dryRun) {
    await writeReport({
      benchmark: 'chat-judgment-concurrency',
      passed: true,
      dryRun: true,
      config: {
        apiBaseUrl,
        burstSize,
        historyVisibilityMode,
        statusPollTimes,
        statusPollIntervalMs,
        requestTimeoutMs,
      },
    });
    console.log('DRY_RUN=true，已跳過實際請求。');
    return;
  }
  const headers = buildHeaders();

  const roomRes = await requestJson('/chat/rooms', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      history_visibility_mode: historyVisibilityMode,
    }),
  });
  if (roomRes.status !== 200) {
    throw new Error(`create room failed: status=${roomRes.status} body=${JSON.stringify(roomRes.body)}`);
  }
  const roomData = getBodyData(roomRes.body);
  const room = roomData?.room as JsonObject | undefined;
  const roomId = room?.id as string | undefined;
  if (!roomId) {
    throw new Error(`create room response missing roomId: ${JSON.stringify(roomRes.body)}`);
  }
  console.log(`roomId=${roomId}`);

  const msgRes = await requestJson(`/chat/rooms/${roomId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: messageContent,
      visibility_scope: 'all',
    }),
  });
  if (msgRes.status !== 200) {
    throw new Error(`send message failed: status=${msgRes.status} body=${JSON.stringify(msgRes.body)}`);
  }

  const burstTasks = Array.from({ length: burstSize }, async (_, idx) => {
    const res = await requestJson(`/chat/rooms/${roomId}/request-judgment`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    const data = getBodyData(res.body);
    return {
      idx: idx + 1,
      httpStatus: res.status,
      ok: res.status >= 200 && res.status < 300,
      code: getBodyCode(res.body),
      caseId: data?.caseId as string | undefined,
      judgmentId: data?.judgmentId as string | undefined,
      linkId: data?.linkId as string | undefined,
      raw: res.body,
    } as RequestResult;
  });
  const burstResults = await Promise.all(burstTasks);
  const summary = buildSummary(burstResults);
  printSummary(summary);

  let latestStatus: unknown = undefined;
  for (let i = 0; i < statusPollTimes; i++) {
    const statusRes = await requestJson(`/chat/rooms/${roomId}/judgment-status`, {
      method: 'GET',
      headers,
    });
    latestStatus = statusRes.body;
    if (statusRes.status === 200) {
      const data = getBodyData(statusRes.body);
      const roomStatus = data?.roomStatus;
      if (roomStatus === 'judgment_completed' || roomStatus === 'judgment_failed') {
        break;
      }
    }
    await sleep(statusPollIntervalMs);
  }

  console.log('\n=== final judgment status ===');
  console.log(JSON.stringify(latestStatus, null, 2));

  const successResults = burstResults.filter((r) => r.ok && r.caseId);
  const uniqueCaseIds = new Set(successResults.map((r) => r.caseId));
  const uniqueLinkIds = new Set(successResults.map((r) => r.linkId).filter(Boolean) as string[]);

  // 驗收規則：
  // - 成功結果中的 caseId 不可超過 1 個；否則代表高機率重複建案。
  // - 成功結果中的 linkId 不可超過 1 個；否則代表高機率重複轉換鏈接。
  const passed = !(uniqueCaseIds.size > 1 || uniqueLinkIds.size > 1);
  const report = {
    benchmark: 'chat-judgment-concurrency',
    passed,
    config: {
      apiBaseUrl,
      burstSize,
      historyVisibilityMode,
      statusPollTimes,
      statusPollIntervalMs,
      requestTimeoutMs,
      useAuthToken: Boolean(authToken),
      useSessionId: Boolean(!authToken && sessionId),
    },
    summary,
    finalStatus: latestStatus,
  };
  await writeReport(report);

  if (!passed) {
    console.error('❌ 檢測到疑似並發重複建案/重複 link 風險');
    process.exit(2);
  }

  console.log('✅ 並發驗證通過：未檢測到重複 case/link');
}

main().catch((error) => {
  console.error('benchmark failed', error);
  process.exit(1);
});
