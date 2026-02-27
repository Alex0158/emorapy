/**
 * Chat invite-accept 並發驗證腳本
 *
 * 目的：
 * - 驗證同一邀請碼在高併發（可跨多實例）下不會出現多次成功接受。
 * - 驗證聊天室最終僅有 1 位 active roleB（搭配 DB 唯一約束 + 應用層 CAS）。
 *
 * 使用方式：
 * OWNER_AUTH_TOKEN=xxx INVITEE_TOKENS=tok1,tok2 npx tsx scripts/benchmark-chat-invite-accept-concurrency.ts
 *
 * 可選環境變數：
 * - API_BASE_URL (default: http://localhost:3001/api/v1)
 * - BURST_SIZE (default: INVITEE_TOKENS 數量)
 * - HISTORY_VISIBILITY_MODE (default: share_summary_only)
 * - EXPIRES_IN_HOURS (default: 24)
 * - REQUEST_TIMEOUT_MS (default: 15000)
 * - DRY_RUN (default: false)
 */

type JsonObject = Record<string, unknown>;
import { writeFile } from 'node:fs/promises';

type AcceptResult = {
  idx: number;
  tokenSuffix: string;
  httpStatus: number;
  ok: boolean;
  code?: string;
  roomId?: string;
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
const ownerToken = process.env.OWNER_AUTH_TOKEN || '';
const inviteeTokens = (process.env.INVITEE_TOKENS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);
const distinctInviteeTokenCount = new Set(inviteeTokens).size;
const tokenDiversityLimited = distinctInviteeTokenCount < 2;
const burstSize = parsePositiveIntEnv(
  'BURST_SIZE',
  process.env.BURST_SIZE,
  Math.max(2, inviteeTokens.length || 2),
  2,
  200
);
const historyVisibilityMode = process.env.HISTORY_VISIBILITY_MODE || 'share_summary_only';
const expiresInHours = parsePositiveIntEnv('EXPIRES_IN_HOURS', process.env.EXPIRES_IN_HOURS, 24, 1, 168);
const requestTimeoutMs = parsePositiveIntEnv('REQUEST_TIMEOUT_MS', process.env.REQUEST_TIMEOUT_MS, 15000, 1000, 120000);
const dryRun = String(process.env.DRY_RUN || 'false').toLowerCase() === 'true';
const reportPath = process.env.REPORT_PATH || '';

function buildOwnerHeaders(): Record<string, string> {
  if (!ownerToken) {
    throw new Error('請提供 OWNER_AUTH_TOKEN');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ownerToken}`,
  };
}

function buildInviteeHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
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

function tokenSuffix(token: string): string {
  return token.slice(-6) || token;
}

function buildSummary(results: AcceptResult[]) {
  const statusCount = new Map<number, number>();
  const codeCount = new Map<string, number>();
  for (const r of results) {
    statusCount.set(r.httpStatus, (statusCount.get(r.httpStatus) || 0) + 1);
    if (r.code) codeCount.set(r.code, (codeCount.get(r.code) || 0) + 1);
  }
  return {
    burstSize: results.length,
    statusCount: Object.fromEntries(statusCount),
    codeCount: Object.fromEntries(codeCount),
  };
}

function printSummary(summary: ReturnType<typeof buildSummary>) {
  console.log('\n=== invite-accept burst summary ===');
  console.log(`burstSize: ${summary.burstSize}`);
  console.log(`http status count: ${JSON.stringify(summary.statusCount)}`);
  console.log(`error code count: ${JSON.stringify(summary.codeCount)}`);
}

async function writeReport(report: unknown) {
  if (!reportPath) return;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`report written: ${reportPath}`);
}

async function main() {
  console.log('=== chat invite accept concurrency benchmark ===');
  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        burstSize,
        inviteeTokenCount: inviteeTokens.length,
        distinctInviteeTokenCount,
        tokenDiversityLimited,
        historyVisibilityMode,
        expiresInHours,
        requestTimeoutMs,
        dryRun,
      },
      null,
      2
    )
  );

  if (dryRun) {
    await writeReport({
      benchmark: 'chat-invite-accept-concurrency',
      passed: true,
      dryRun: true,
      config: {
        apiBaseUrl,
        burstSize,
        inviteeTokenCount: inviteeTokens.length,
        distinctInviteeTokenCount,
        tokenDiversityLimited,
        historyVisibilityMode,
        expiresInHours,
        requestTimeoutMs,
      },
    });
    console.log('DRY_RUN=true，已跳過實際請求。');
    return;
  }

  if (inviteeTokens.length === 0) {
    throw new Error('請提供 INVITEE_TOKENS，格式: tok1,tok2,...');
  }
  if (tokenDiversityLimited) {
    console.warn('⚠️ INVITEE_TOKENS 目前少於 2 個唯一 token，並發覆蓋度有限，結果僅供基礎驗證參考。');
  }

  const ownerHeaders = buildOwnerHeaders();
  const createRoomRes = await requestJson('/chat/rooms', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ history_visibility_mode: historyVisibilityMode }),
  });
  if (createRoomRes.status !== 200) {
    throw new Error(`create room failed: status=${createRoomRes.status} body=${JSON.stringify(createRoomRes.body)}`);
  }
  const roomId = (getBodyData(createRoomRes.body)?.room as JsonObject | undefined)?.id as string | undefined;
  if (!roomId) {
    throw new Error(`create room response missing roomId: ${JSON.stringify(createRoomRes.body)}`);
  }
  console.log(`roomId=${roomId}`);

  const inviteRes = await requestJson(`/chat/rooms/${roomId}/invites`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      history_visibility_mode: historyVisibilityMode,
      expires_in_hours: expiresInHours,
    }),
  });
  if (inviteRes.status !== 200) {
    throw new Error(`create invite failed: status=${inviteRes.status} body=${JSON.stringify(inviteRes.body)}`);
  }
  const inviteCode = (getBodyData(inviteRes.body)?.invite as JsonObject | undefined)?.invite_code as string | undefined;
  if (!inviteCode) {
    throw new Error(`create invite response missing invite_code: ${JSON.stringify(inviteRes.body)}`);
  }
  console.log(`inviteCode=${inviteCode}`);

  const tasks = Array.from({ length: burstSize }, async (_, idx) => {
    const token = inviteeTokens[idx % inviteeTokens.length];
    const res = await requestJson(`/chat/invites/${inviteCode}/accept`, {
      method: 'POST',
      headers: buildInviteeHeaders(token),
      body: JSON.stringify({}),
    });
    const data = getBodyData(res.body);
    const room = data?.room as JsonObject | undefined;
    return {
      idx: idx + 1,
      tokenSuffix: tokenSuffix(token),
      httpStatus: res.status,
      ok: res.status >= 200 && res.status < 300,
      code: getBodyCode(res.body),
      roomId: room?.id as string | undefined,
      raw: res.body,
    } as AcceptResult;
  });
  const results = await Promise.all(tasks);
  const summary = buildSummary(results);
  printSummary(summary);

  const success = results.filter((r) => r.ok);
  const successRoomIds = new Set(success.map((r) => r.roomId).filter(Boolean) as string[]);
  const inviteAcceptPassed = success.length === 1 && successRoomIds.size <= 1;
  if (!inviteAcceptPassed) {
    await writeReport({
      benchmark: 'chat-invite-accept-concurrency',
      passed: false,
      stage: 'accept-burst',
      config: {
        apiBaseUrl,
        burstSize,
        inviteeTokenCount: inviteeTokens.length,
        distinctInviteeTokenCount,
        tokenDiversityLimited,
        historyVisibilityMode,
        expiresInHours,
        requestTimeoutMs,
      },
      summary,
      results,
    });
    console.error('❌ 檢測到邀請接受並發異常：成功次數不等於 1 或成功房間不一致');
    process.exit(2);
  }

  const roomRes = await requestJson(`/chat/rooms/${roomId}`, {
    method: 'GET',
    headers: ownerHeaders,
  });
  if (roomRes.status !== 200) {
    throw new Error(`get room failed: status=${roomRes.status} body=${JSON.stringify(roomRes.body)}`);
  }
  const room = getBodyData(roomRes.body)?.room as JsonObject | undefined;
  const participants = (room?.participants as unknown[] | undefined) || [];
  const activeRoleB = participants.filter((p) => {
    if (!p || typeof p !== 'object') return false;
    const obj = p as JsonObject;
    return obj.role_in_room === 'roleB' && obj.is_active === true;
  });

  console.log('\n=== final room participant check ===');
  console.log(`active roleB count: ${activeRoleB.length}`);
  console.log(JSON.stringify(activeRoleB, null, 2));

  const passed = activeRoleB.length === 1;
  const report = {
    benchmark: 'chat-invite-accept-concurrency',
    passed,
    config: {
      apiBaseUrl,
      burstSize,
      inviteeTokenCount: inviteeTokens.length,
      distinctInviteeTokenCount,
      tokenDiversityLimited,
      historyVisibilityMode,
      expiresInHours,
      requestTimeoutMs,
    },
    summary,
    final: {
      activeRoleBCount: activeRoleB.length,
      activeRoleB,
      roomId,
      inviteCode,
    },
  };
  await writeReport(report);

  if (!passed) {
    console.error('❌ 檢測到 roleB 活躍成員數異常，預期為 1');
    process.exit(3);
  }

  console.log('✅ invite accept 並發驗證通過：僅 1 次成功，且僅 1 位 active roleB');
}

main().catch((error) => {
  console.error('benchmark failed', error);
  process.exit(1);
});
