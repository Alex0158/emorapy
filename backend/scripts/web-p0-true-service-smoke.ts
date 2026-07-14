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
import { redactLogInfo, redactSensitiveText } from '../src/utils/log-redaction';
import {
  buildSmokeAccountHygieneReport,
  collectSmokeAccountCandidates,
} from '../src/utils/smoke-account-hygiene';

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
const smtpSinkApiUrl = (process.env.SMTP_SINK_API_URL || '').replace(/\/$/, '');

const prisma = new PrismaClient();
const steps: StepResult[] = [];
const createdUserIds = new Set<string>();
const createdUserEmails = new Set<string>();

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function isObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneForRedaction(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export function safeErrorMessage(error: unknown): string {
  return redactSensitiveText(error instanceof Error ? error.message : String(error));
}

export function formatSafeResponseForError(
  result: Pick<RequestResult, 'body' | 'text'>
): string {
  const source = result.body === undefined ? result.text : result.body;
  const redacted = redactLogInfo({ body: cloneForRedaction(source) }).body;
  const serialized = typeof redacted === 'string' ? redacted : JSON.stringify(redacted);
  return redactSensitiveText(serialized || '[empty response]').slice(0, 1000);
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
      details: { error: safeErrorMessage(error) },
    });
    throw error;
  }
}

function expectStatus(result: RequestResult, expected: number | number[], label: string): void {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(result.status)) {
    fail(
      `${label}: expected HTTP ${allowed.join('/')}, got ${result.status}; body=${formatSafeResponseForError(result)}`
    );
  }
}

export type SmokeLifecycleDependencies = {
  run: () => Promise<void>;
  cleanup: () => Promise<void>;
  verifyHygiene: () => Promise<void>;
  writeReport: (status: 'passed' | 'failed', error?: unknown) => Promise<void>;
};

function appendLifecycleFailure(
  current: Error | undefined,
  phase: string,
  error: unknown
): Error {
  const message = `${phase}: ${safeErrorMessage(error)}`;
  return new Error(current ? `${current.message}; ${message}` : message);
}

export async function runSmokeLifecycle(
  dependencies: SmokeLifecycleDependencies
): Promise<void> {
  let failure: Error | undefined;
  const runPhase = async (phase: string, action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      failure = appendLifecycleFailure(failure, phase, error);
    }
  };

  await runPhase('smoke execution', dependencies.run);
  await runPhase('cleanup', dependencies.cleanup);
  await runPhase('post-run hygiene', dependencies.verifyHygiene);

  const status = failure ? 'failed' : 'passed';
  try {
    await dependencies.writeReport(status, failure);
  } catch (error) {
    failure = appendLifecycleFailure(failure, 'report write', error);
  }

  if (failure) throw failure;
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
  if (!envSource.SMTP_SINK_API_URL) {
    fail('SMTP_SINK_API_URL is required; auth smoke must verify delivered OTP without reading the database');
  }
  if (envSource.WEB_P0_SMOKE_DISABLE_CREATED_USERS === 'false') {
    fail('WEB_P0_SMOKE_DISABLE_CREATED_USERS=false is forbidden because cleanup is a pass condition');
  }
  if (!isLocalDatabaseUrl(envSource.DATABASE_URL) && envSource.WEB_P0_SMOKE_ALLOW_REMOTE_DB !== 'true') {
    fail('WEB_P0_SMOKE_ALLOW_REMOTE_DB=true is required for non-local DATABASE_URL because this smoke creates production-like test data');
  }
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function registerVerifiedUser(
  prefix: string
): Promise<{ email: string; token: string; userId: string }> {
  const email = `web-p0-${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
  const password = 'Password123!';
  createdUserEmails.add(email);

  const sendCodeRes = await requestJson('/auth/send-verification-code', {
    method: 'POST',
    body: JSON.stringify({ email, type: 'register' }),
  });
  expectStatus(sendCodeRes, 200, `send registration code ${prefix}`);

  const verificationCode = await waitForDeliveredRegistrationCode(email);

  const verifyRes = await requestJson('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code: verificationCode, type: 'register' }),
  });
  expectStatus(verifyRes, 200, `verify ${prefix}`);
  const registrationProof = requireString(
    readPath(verifyRes.body, 'data.registration_proof'),
    `verify ${prefix} registration proof`
  );

  const registerRes = await requestJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      nickname: `Web P0 ${prefix}`,
      registration_proof: registrationProof,
    }),
  });
  expectStatus(registerRes, 201, `register ${prefix}`);
  const token = requireString(readPath(registerRes.body, 'data.token'), `register ${prefix} token`);
  const userId = requireString(
    readPath(registerRes.body, 'data.user.id'),
    `register ${prefix} user id`
  );
  createdUserIds.add(userId);

  return {
    email,
    token,
    userId,
  };
}

async function waitForDeliveredRegistrationCode(email: string): Promise<string> {
  const attempts = Number(process.env.WEB_P0_SMOKE_VERIFICATION_POLL_TIMES || 20);
  const intervalMs = Number(process.env.WEB_P0_SMOKE_VERIFICATION_POLL_INTERVAL_MS || 250);
  const messageUrl = `${smtpSinkApiUrl}/messages/latest?to=${encodeURIComponent(email)}`;

  for (let i = 0; i < attempts; i += 1) {
    const response = await fetch(messageUrl, { signal: AbortSignal.timeout(5_000) }).catch(
      () => null
    );
    if (response?.ok) {
      const payload = (await response.json().catch(() => null)) as {
        verificationCode?: unknown;
      } | null;
      if (
        typeof payload?.verificationCode === 'string' &&
        /^\d{6}$/.test(payload.verificationCode)
      ) {
        return payload.verificationCode;
      }
    }
    await sleep(intervalMs);
  }
  fail('Registration OTP was not delivered to the configured SMTP sink');
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
  if (!cleanupCreatedUsers) {
    fail('Web P0 smoke user cleanup is disabled');
  }
  if (createdUserIds.size === 0 && createdUserEmails.size === 0) return;
  const userIds = Array.from(createdUserIds);
  const userEmails = Array.from(createdUserEmails);
  await prisma.user.updateMany({
    where: {
      email: { startsWith: 'web-p0-', endsWith: '@example.com', mode: 'insensitive' },
      OR: [
        { id: { in: userIds } },
        { email: { in: userEmails, mode: 'insensitive' } },
      ],
    },
    data: { is_active: false },
  });

  const remainingActiveUsers = await prisma.user.count({
    where: {
      is_active: true,
      email: { startsWith: 'web-p0-', endsWith: '@example.com', mode: 'insensitive' },
      OR: [
        { id: { in: userIds } },
        { email: { in: userEmails, mode: 'insensitive' } },
      ],
    },
  });
  assert(remainingActiveUsers === 0, 'Web P0 smoke user cleanup left active accounts');
}

async function verifyPostRunSmokeAccountHygiene(): Promise<void> {
  const report = buildSmokeAccountHygieneReport(
    await collectSmokeAccountCandidates(prisma)
  );
  assert(
    report.ok,
    `Post-run smoke-account hygiene found ${report.activeFindingCount} active synthetic account(s)`
  );
}

async function writeReport(status: 'passed' | 'failed', error?: unknown): Promise<void> {
  if (!reportPath) fail('WEB_P0_SMOKE_REPORT_PATH is required before report write');
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
    smtp_sink_configured: Boolean(smtpSinkApiUrl),
    cleanup_created_users: cleanupCreatedUsers,
    steps,
    error: error ? safeErrorMessage(error) : null,
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
        mode: 'remote',
        title: 'Web P0 true-service formal case',
        plaintiff_statement:
          'Web P0 true-service formal smoke: I need a structured analysis because repeated schedule changes made me feel unimportant and anxious.',
      }),
    });
    expectStatus(caseRes, 201, 'formal case create');
    const caseId = requireString(readPath(caseRes.body, 'data.case.id'), 'formal case id');
    assert(readPath(caseRes.body, 'data.case.status') === 'draft', 'formal remote case was not created as a draft');

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

    const responseRes = await requestJson(`/cases/${caseId}`, {
      method: 'PUT',
      headers: bearer(userB.token),
      body: JSON.stringify({
        defendant_statement:
          'I want to acknowledge the impact, explain that work pressure was real, and find a calmer concrete way to repair the relationship.',
      }),
    });
    expectStatus(responseRes, 200, 'formal counterparty response');
    assert(readPath(responseRes.body, 'data.case.status') === 'submitted', 'formal remote case was not submitted after the counterparty response');

    const judgment = await pollCaseJudgment(caseId, bearer(userA.token), 'formal case');
    const judgmentId = requireString(judgment.id, 'formal judgment id');
    const judgmentDetailRes = await requestJson(`/judgments/${judgmentId}`, { headers: bearer(userA.token) });
    expectStatus(judgmentDetailRes, 200, 'formal judgment detail');
    return { pairingId, caseId, judgmentId };
  });

  const chat = await recordStep(
    'chat invite/exact consent/request analysis/judgment status',
    async () => {
      const roomRes = await requestJson('/chat/rooms', {
        method: 'POST',
        headers: bearer(userA.token),
        body: JSON.stringify({ history_visibility_mode: 'share_summary_only' }),
      });
      expectStatus(roomRes, 200, 'chat room create');
      const roomId = requireString(readPath(roomRes.body, 'data.room.id'), 'chat room id');

      const inviteRes = await requestJson(`/chat/rooms/${roomId}/invites`, {
        method: 'POST',
        headers: bearer(userA.token),
        body: '{}',
      });
      expectStatus(inviteRes, 200, 'chat invite create');
      const chatInviteCode = requireString(
        readPath(inviteRes.body, 'data.invite.invite_code'),
        'chat invite code'
      );

      const acceptInviteRes = await requestJson(
        `/chat/invites/${encodeURIComponent(chatInviteCode)}/accept`,
        {
          method: 'POST',
          headers: bearer(userB.token),
          body: '{}',
        }
      );
      expectStatus(acceptInviteRes, 200, 'chat invite accept');
      assert(
        readPath(acceptInviteRes.body, 'data.room.status') === 'group_active',
        'chat room did not become group_active'
      );

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
      const messageId = requireString(
        readPath(messageRes.body, 'data.message.id'),
        'chat message id'
      );

      const createAnalysisRes = await requestJson(`/chat/rooms/${roomId}/analysis-requests`, {
        method: 'POST',
        headers: bearer(userA.token),
        body: JSON.stringify({
          selected_message_ids: [messageId],
          selected_capsule_ids: [],
        }),
      });
      expectStatus(createAnalysisRes, 201, 'chat exact analysis request create');
      const analysisRequestId = requireString(
        readPath(createAnalysisRes.body, 'data.analysis_request.id'),
        'chat exact analysis request id'
      );
      const selectionHash = requireString(
        readPath(createAnalysisRes.body, 'data.analysis_request.selection_hash'),
        'chat exact analysis selection hash'
      );
      const policyVersion = requireString(
        readPath(createAnalysisRes.body, 'data.analysis_request.policy_version'),
        'chat context policy version'
      );
      const approvalBody = JSON.stringify({
        selection_hash: selectionHash,
        policy_version: policyVersion,
        decision: 'approved',
      });

      const approvalARes = await requestJson(
        `/chat/rooms/${roomId}/analysis-requests/${analysisRequestId}/decision`,
        {
          method: 'POST',
          headers: bearer(userA.token),
          body: approvalBody,
        }
      );
      expectStatus(approvalARes, 201, 'chat exact analysis approval A');

      const approvalBRes = await requestJson(
        `/chat/rooms/${roomId}/analysis-requests/${analysisRequestId}/decision`,
        {
          method: 'POST',
          headers: bearer(userB.token),
          body: approvalBody,
        }
      );
      expectStatus(approvalBRes, 201, 'chat exact analysis approval B');

      const submitAnalysisRes = await requestJson(
        `/chat/rooms/${roomId}/analysis-requests/${analysisRequestId}/submit`,
        {
          method: 'POST',
          headers: bearer(userA.token),
          body: '{}',
        }
      );
      expectStatus(submitAnalysisRes, 200, 'chat exact analysis request submit');
      assert(
        readPath(submitAnalysisRes.body, 'data.analysis_request.status') === 'submitted',
        'chat exact analysis request was not submitted'
      );

      const analysisRes = await requestJson(`/chat/rooms/${roomId}/request-judgment`, {
        method: 'POST',
        headers: bearer(userA.token),
        body: JSON.stringify({ analysis_request_id: analysisRequestId }),
      });
      expectStatus(analysisRes, 200, 'chat request analysis');
      const caseId = requireString(
        readPath(analysisRes.body, 'data.caseId'),
        'chat linked case id'
      );
      const judgmentId = requireString(
        readPath(analysisRes.body, 'data.judgmentId'),
        'chat judgment id'
      );

      const statusRes = await requestJson(`/chat/rooms/${roomId}/judgment-status`, {
        headers: bearer(userA.token),
      });
      expectStatus(statusRes, 200, 'chat judgment status');
      assert(
        readPath(statusRes.body, 'data.roomStatus') === 'judgment_completed',
        'chat judgment status was not completed'
      );

      const judgmentDetailRes = await requestJson(`/judgments/${judgmentId}`, {
        headers: bearer(userA.token),
      });
      expectStatus(judgmentDetailRes, 200, 'chat judgment detail');
      return { roomId, caseId, judgmentId };
    }
  );

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
  let passed = false;
  try {
    await runSmokeLifecycle({
      run: runSmoke,
      cleanup: () => recordStep('cleanup created smoke users', cleanup),
      verifyHygiene: () =>
        recordStep('post-run smoke-account hygiene', verifyPostRunSmokeAccountHygiene),
      writeReport,
    });
    passed = true;
  } catch (error) {
    console.error('[web-p0-smoke] FAIL:', safeErrorMessage(error));
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error('[web-p0-smoke] disconnect failed:', safeErrorMessage(error));
      process.exitCode = 1;
      passed = false;
    }
    if (passed) console.log('[web-p0-smoke] PASS');
  }
}

if (require.main === module) {
  main();
}
