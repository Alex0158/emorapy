/**
 * Web P0 true-service smoke.
 *
 * This runner intentionally uses real HTTP plus the target DATABASE_URL.
 * It is allowed to use AI_MOCK=true for non-paid release-like verification, but it
 * must not be counted as mock-backed Playwright evidence.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '../src/types/prisma-client';

try {
  require('dotenv').config();
} catch {
  // dotenv is optional in hosted environments.
}

type JsonRecord = Record<string, unknown>;

type StepResult = {
  name: string;
  ok: boolean;
  httpStatus?: number;
  details?: JsonRecord;
};

type RequestResult = {
  status: number;
  body: unknown;
  text: string;
};

const apiBaseUrl = (process.env.API_BASE_URL || `${process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3001'}/api/v1`).replace(/\/$/, '');
const backendBaseUrl = (process.env.BACKEND_BASE_URL || apiBaseUrl.replace(/\/api\/v1$/, '')).replace(/\/$/, '');
const origin = process.env.ORIGIN || process.env.FRONTEND_BASE_URL || 'http://127.0.0.1:4173';
const requestTimeoutMs = Number(process.env.WEB_P0_SMOKE_REQUEST_TIMEOUT_MS || 30_000);
const reportPath = process.env.WEB_P0_SMOKE_REPORT_PATH || '';
const runMutatingSmoke = process.env.RUN_WEB_P0_TRUE_SERVICE_SMOKE === 'true';
const allowRemoteDb = process.env.WEB_P0_SMOKE_ALLOW_REMOTE_DB === 'true';
const cleanupCreatedUsers = process.env.WEB_P0_SMOKE_DISABLE_CREATED_USERS !== 'false';
const reportBaseDir = process.env.INIT_CWD || process.cwd();

const prisma = new PrismaClient();
const steps: StepResult[] = [];
const createdUserIds = new Set<string>();

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function isObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPath(value: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((current, key) => {
    if (!isObject(current)) return undefined;
    return current[key];
  }, value);
}

function requireString(value: unknown, label: string): string {
  assert(typeof value === 'string' && value.length > 0, `Missing ${label}`);
  return value;
}

function requireObject(value: unknown, label: string): JsonRecord {
  assert(isObject(value), `Missing ${label}`);
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(pathname: string, init: RequestInit = {}): Promise<RequestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Origin')) headers.set('Origin', origin);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const res = await fetch(`${apiBaseUrl}${pathname}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestMultipart(pathname: string, form: FormData, init: RequestInit = {}): Promise<RequestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Origin')) headers.set('Origin', origin);

    const res = await fetch(`${apiBaseUrl}${pathname}`, {
      ...init,
      method: init.method || 'POST',
      headers,
      body: form,
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function recordStep<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    steps.push({ name, ok: true });
    console.log(`[web-p0-smoke] ok: ${name}`);
    return result;
  } catch (error) {
    steps.push({
      name,
      ok: false,
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

function expectStatus(result: RequestResult, expected: number | number[], label: string): void {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(result.status)) {
    fail(`${label}: expected HTTP ${allowed.join('/')}, got ${result.status}; body=${result.text.slice(0, 1000)}`);
  }
}

function getDatabaseHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  const host = getDatabaseHost(databaseUrl);
  return ['localhost', '127.0.0.1', '::1'].includes(host);
}

export function validateSmokeSafetyEnv(envSource: NodeJS.ProcessEnv = process.env): void {
  if (envSource.RUN_WEB_P0_TRUE_SERVICE_SMOKE !== 'true') {
    fail('RUN_WEB_P0_TRUE_SERVICE_SMOKE=true is required because this smoke creates production-like test data');
  }
  if (!envSource.DATABASE_URL) {
    fail('DATABASE_URL is required so the smoke can verify DB-backed auth and ownership state');
  }
  if (!envSource.WEB_P0_SMOKE_REPORT_PATH) {
    fail('WEB_P0_SMOKE_REPORT_PATH is required so the mutating smoke leaves a release evidence artifact');
  }
  if (!isLocalDatabaseUrl(envSource.DATABASE_URL) && envSource.WEB_P0_SMOKE_ALLOW_REMOTE_DB !== 'true') {
    fail('WEB_P0_SMOKE_ALLOW_REMOTE_DB=true is required for non-local DATABASE_URL because this smoke creates production-like test data');
  }
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function registerVerifiedUser(prefix: string): Promise<{ email: string; token: string; userId: string }> {
  const email = `web-p0-${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
  const password = 'Password123!';
  const res = await requestJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, nickname: `Web P0 ${prefix}` }),
  });
  expectStatus(res, 201, `register ${prefix}`);
  const token = requireString(readPath(res.body, 'data.token'), `register ${prefix} token`);
  const userId = requireString(readPath(res.body, 'data.user.id'), `register ${prefix} user id`);
  createdUserIds.add(userId);

  const verification = await waitForRegisterVerification(email);
  assert(verification?.code, `Missing verification code for ${email}`);

  const verifyRes = await requestJson('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code: verification.code, type: 'register' }),
  });
  expectStatus(verifyRes, 200, `verify ${prefix}`);

  const loginRes = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  expectStatus(loginRes, 200, `login ${prefix}`);
  return {
    email,
    token: requireString(readPath(loginRes.body, 'data.token'), `login ${prefix} token`),
    userId,
  };
}

async function waitForRegisterVerification(email: string) {
  const attempts = Number(process.env.WEB_P0_SMOKE_VERIFICATION_POLL_TIMES || 20);
  const intervalMs = Number(process.env.WEB_P0_SMOKE_VERIFICATION_POLL_INTERVAL_MS || 100);

  for (let i = 0; i < attempts; i += 1) {
    const verification = await prisma.emailVerification.findFirst({
      where: { email, type: 'register', used: false },
      orderBy: { created_at: 'desc' },
    });
    if (verification) return verification;
    await sleep(intervalMs);
  }
  return null;
}

async function pollCaseJudgment(caseId: string, headers: Record<string, string>, label: string): Promise<JsonRecord> {
  const attempts = Number(process.env.WEB_P0_SMOKE_JUDGMENT_POLL_TIMES || 12);
  const intervalMs = Number(process.env.WEB_P0_SMOKE_JUDGMENT_POLL_INTERVAL_MS || 500);

  for (let i = 0; i < attempts; i += 1) {
    const res = await requestJson(`/cases/${caseId}/judgment`, { headers });
    if (res.status === 200) {
      return requireObject(readPath(res.body, 'data.judgment'), `${label} judgment`);
    }
    if (res.status !== 202) {
      expectStatus(res, [200, 202], `${label} judgment poll`);
    }
    await sleep(intervalMs);
  }
  fail(`${label}: judgment was not ready after ${attempts} attempts`);
}

async function cleanup(): Promise<void> {
  if (!cleanupCreatedUsers || createdUserIds.size === 0) return;
  await prisma.user.updateMany({
    where: {
      id: { in: Array.from(createdUserIds) },
      email: { startsWith: 'web-p0-', endsWith: '@example.com', mode: 'insensitive' },
    },
    data: { is_active: false },
  }).catch((error) => {
    console.warn('[web-p0-smoke] cleanup failed', error instanceof Error ? error.message : String(error));
  });
}

async function writeReport(status: 'passed' | 'failed', error?: unknown): Promise<void> {
  if (!reportPath) return;
  const resolvedReportPath = path.isAbsolute(reportPath) ? reportPath : path.resolve(reportBaseDir, reportPath);
  const report = {
    smoke: 'web-p0-true-service',
    status,
    generated_at: new Date().toISOString(),
    api_base_url: apiBaseUrl,
    backend_base_url: backendBaseUrl,
    origin,
    ai_mock: process.env.AI_MOCK === 'true',
    database_url_present: Boolean(process.env.DATABASE_URL),
    cleanup_created_users: cleanupCreatedUsers,
    steps,
    error: error instanceof Error ? error.message : error ? String(error) : null,
  };
  await mkdir(path.dirname(resolvedReportPath), { recursive: true });
  await writeFile(resolvedReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function runSmoke(): Promise<void> {
  validateSmokeSafetyEnv();

  console.log(`[web-p0-smoke] api=${apiBaseUrl}`);
  console.log(`[web-p0-smoke] origin=${origin}`);
  console.log(`[web-p0-smoke] ai_mock=${process.env.AI_MOCK === 'true' ? 'true' : 'false'}`);
  console.log(`[web-p0-smoke] db=${isLocalDatabaseUrl(process.env.DATABASE_URL || '') ? 'local' : 'remote'}`);
  console.log(`[web-p0-smoke] allow_remote_db=${allowRemoteDb ? 'true' : 'false'}`);

  await recordStep('backend health', async () => {
    const health = await fetch(`${backendBaseUrl}/health`);
    assert(health.status === 200, `Expected /health HTTP 200, got ${health.status}`);
    const ready = await fetch(`${backendBaseUrl}/health/ready`);
    assert(ready.status === 200, `Expected /health/ready HTTP 200, got ${ready.status}`);
  });

  const quick = await recordStep('quick create/result/judgment detail', async () => {
    const sessionRes = await requestJson('/sessions/quick', { method: 'POST', body: '{}' });
    expectStatus(sessionRes, [200, 201], 'quick session');
    const sessionId = requireString(readPath(sessionRes.body, 'data.session_id'), 'quick session id');

    const quickCaseRes = await requestJson('/cases/quick', {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId },
      body: JSON.stringify({
        plaintiff_statement:
          'Web P0 true-service quick smoke: I felt ignored after preparing a careful dinner and need a concrete relationship analysis with enough detail.',
        defendant_statement:
          'The other side wants to explain that work pressure caused the delay, while still caring about the relationship and wanting repair.',
      }),
    });
    expectStatus(quickCaseRes, 201, 'quick case');
    const caseId = requireString(readPath(quickCaseRes.body, 'data.case.id'), 'quick case id');

    const detailRes = await requestJson(`/cases/${caseId}`, { headers: { 'X-Session-Id': sessionId } });
    expectStatus(detailRes, 200, 'quick case detail');
    const judgment = await pollCaseJudgment(caseId, { 'X-Session-Id': sessionId }, 'quick case');
    const judgmentId = requireString(judgment.id, 'quick judgment id');

    const judgmentDetailRes = await requestJson(`/judgments/${judgmentId}`, { headers: { 'X-Session-Id': sessionId } });
    expectStatus(judgmentDetailRes, 200, 'quick judgment detail');
    return { sessionId, caseId, judgmentId };
  });

  const [userA, userB] = await recordStep('register and verify two users', async () => {
    const a = await registerVerifiedUser('a');
    const b = await registerVerifiedUser('b');
    return [a, b] as const;
  });

  const formal = await recordStep('formal pairing/case/list/evidence/judgment', async () => {
    const pairingRes = await requestJson('/pairing/create', { method: 'POST', headers: bearer(userA.token), body: '{}' });
    expectStatus(pairingRes, 200, 'pairing create');
    const inviteCode = requireString(readPath(pairingRes.body, 'data.pairing.invite_code'), 'pairing invite code');

    const joinRes = await requestJson('/pairing/join', {
      method: 'POST',
      headers: bearer(userB.token),
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    expectStatus(joinRes, 200, 'pairing join');
    const pairingId = requireString(readPath(joinRes.body, 'data.pairing.id'), 'active pairing id');

    const caseRes = await requestJson('/cases', {
      method: 'POST',
      headers: bearer(userA.token),
      body: JSON.stringify({
        pairing_id: pairingId,
        mode: 'collaborative',
        title: 'Web P0 true-service formal case',
        plaintiff_statement:
          'Web P0 true-service formal smoke: I need a structured analysis because repeated schedule changes made me feel unimportant and anxious.',
        defendant_statement:
          'I want to acknowledge the impact, explain that work pressure was real, and find a calmer concrete way to repair the relationship.',
      }),
    });
    expectStatus(caseRes, 201, 'formal case create');
    const caseId = requireString(readPath(caseRes.body, 'data.case.id'), 'formal case id');

    const listRes = await requestJson('/cases?page=1&page_size=10&sort_by=created_at&sort_order=desc', {
      headers: bearer(userA.token),
    });
    expectStatus(listRes, 200, 'formal case list');
    const cases = readPath(listRes.body, 'data.cases');
    assert(Array.isArray(cases) && cases.some((item) => isObject(item) && item.id === caseId), 'formal case list did not include created case');

    const detailRes = await requestJson(`/cases/${caseId}`, { headers: bearer(userA.token) });
    expectStatus(detailRes, 200, 'formal case detail');

    const form = new FormData();
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    );
    form.append('files', new Blob([png], { type: 'image/png' }), 'web-p0-smoke.png');
    const uploadRes = await requestMultipart(`/cases/${caseId}/evidence`, form, { headers: bearer(userA.token) });
    expectStatus(uploadRes, 200, 'formal evidence upload');
    const evidences = readPath(uploadRes.body, 'data.evidences');
    assert(Array.isArray(evidences) && evidences.length >= 1, 'formal evidence upload returned no evidences');

    const judgment = await pollCaseJudgment(caseId, bearer(userA.token), 'formal case');
    const judgmentId = requireString(judgment.id, 'formal judgment id');
    const judgmentDetailRes = await requestJson(`/judgments/${judgmentId}`, { headers: bearer(userA.token) });
    expectStatus(judgmentDetailRes, 200, 'formal judgment detail');
    return { pairingId, caseId, judgmentId };
  });

  const chat = await recordStep('chat room/message/request analysis/judgment status', async () => {
    const roomRes = await requestJson('/chat/rooms', {
      method: 'POST',
      headers: bearer(userA.token),
      body: JSON.stringify({ history_visibility_mode: 'share_summary_only' }),
    });
    expectStatus(roomRes, 200, 'chat room create');
    const roomId = requireString(readPath(roomRes.body, 'data.room.id'), 'chat room id');

    const messageRes = await requestJson(`/chat/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: bearer(userA.token),
      body: JSON.stringify({
        content:
          'Web P0 true-service chat smoke: I want an analysis of a repeated communication rupture where I feel unseen but still want repair.',
        visibility_scope: 'all',
      }),
    });
    expectStatus(messageRes, 200, 'chat send message');
    const messageId = requireString(readPath(messageRes.body, 'data.message.id'), 'chat message id');

    const analysisRes = await requestJson(`/chat/rooms/${roomId}/request-judgment`, {
      method: 'POST',
      headers: bearer(userA.token),
      body: JSON.stringify({ included_message_ids: [messageId] }),
    });
    expectStatus(analysisRes, 200, 'chat request analysis');
    const caseId = requireString(readPath(analysisRes.body, 'data.caseId'), 'chat linked case id');
    const judgmentId = requireString(readPath(analysisRes.body, 'data.judgmentId'), 'chat judgment id');

    const statusRes = await requestJson(`/chat/rooms/${roomId}/judgment-status`, { headers: bearer(userA.token) });
    expectStatus(statusRes, 200, 'chat judgment status');
    assert(readPath(statusRes.body, 'data.roomStatus') === 'judgment_completed', 'chat judgment status was not completed');

    const judgmentDetailRes = await requestJson(`/judgments/${judgmentId}`, { headers: bearer(userA.token) });
    expectStatus(judgmentDetailRes, 200, 'chat judgment detail');
    return { roomId, caseId, judgmentId };
  });

  await recordStep('db ownership and artifact sanity', async () => {
    const [quickCase, formalCase, chatLink] = await Promise.all([
      prisma.case.findUnique({ where: { id: quick.caseId }, include: { judgment: true } }),
      prisma.case.findUnique({ where: { id: formal.caseId }, include: { judgment: true, evidences: true } }),
      prisma.chatToCaseLink.findFirst({ where: { case_id: chat.caseId }, include: { judgment: true, room: true } }),
    ]);
    assert(quickCase?.judgment?.id === quick.judgmentId, 'quick DB judgment mismatch');
    assert(formalCase?.plaintiff_id === userA.userId, 'formal DB plaintiff mismatch');
    assert(formalCase?.defendant_id === userB.userId, 'formal DB defendant mismatch');
    assert(formalCase?.judgment?.id === formal.judgmentId, 'formal DB judgment mismatch');
    assert((formalCase?.evidences.length || 0) >= 1, 'formal DB evidence missing');
    assert(chatLink?.judgment?.id === chat.judgmentId, 'chat DB judgment link mismatch');
    assert(chatLink?.room.status === 'judgment_completed', 'chat DB room status mismatch');
  });
}

async function main(): Promise<void> {
  let status: 'passed' | 'failed' = 'failed';
  let caught: unknown;
  try {
    await runSmoke();
    status = 'passed';
    console.log('[web-p0-smoke] PASS');
  } catch (error) {
    caught = error;
    console.error('[web-p0-smoke] FAIL:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await cleanup();
    await writeReport(status, caught).catch((error) => {
      console.warn('[web-p0-smoke] failed to write report', error instanceof Error ? error.message : String(error));
    });
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
