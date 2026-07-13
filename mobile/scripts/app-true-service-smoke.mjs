import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001/api/v1';
const VALID_SCOPES = new Set(['m1', 'm2', 'm3', 'm4', 'm5', 'all']);
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_JUDGMENT_POLL_ATTEMPTS = 3;
const DEFAULT_JUDGMENT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_CHAT_MESSAGE_INTERVAL_MS = 5_200;
const DEFAULT_INTERVIEW_TURN_INTERVAL_MS = 3_200;
const DEFAULT_INTERVIEW_DEEP_RESPONSE_COUNT = 4;
const DEFAULT_INTERVIEW_RESPONSE_POLL_ATTEMPTS = 20;
const DEFAULT_INTERVIEW_RESPONSE_POLL_INTERVAL_MS = 500;
const DEFAULT_INTERVIEW_END_RETRY_ATTEMPTS = 10;
const DEFAULT_INTERVIEW_END_RETRY_INTERVAL_MS = 500;
const DEFAULT_MY_STORY_POLL_ATTEMPTS = 30;
const DEFAULT_MY_STORY_POLL_INTERVAL_MS = 1_000;
const DEFAULT_M1_STREAM_REPLAY_TIMEOUT_MS = 12_000;
const DEFAULT_REPAIR_REPLAN_STREAM_TIMEOUT_MS = 12_000;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const backendEnvPath = path.resolve(repoRoot, 'backend', '.env');

class SmokeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SmokeError';
    this.details = details;
  }
}

function parseArgs(argv) {
  const parsed = {
    apiBaseUrl: process.env.APP_SMOKE_API_BASE_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
    allowRemoteApi: process.env.APP_SMOKE_ALLOW_REMOTE_API === 'true',
    allowRemoteDb: process.env.APP_SMOKE_ALLOW_REMOTE_DB === 'true',
    bootstrapLocalUsers: process.env.APP_SMOKE_BOOTSTRAP_LOCAL_USERS === 'true',
    deep: process.env.APP_SMOKE_DEEP === 'true',
    dryRun: false,
    injectM1ExpiredSession: process.env.APP_SMOKE_M1_INJECT_EXPIRED_SESSION === 'true',
    m1StreamReplay: process.env.APP_SMOKE_M1_STREAM_REPLAY === 'true',
    injectM2Failure: process.env.APP_SMOKE_M2_INJECT_FAILURE === 'true',
    injectM2PartialSuccess: process.env.APP_SMOKE_M2_INJECT_PARTIAL_SUCCESS === 'true',
    requireJudgment: process.env.APP_SMOKE_REQUIRE_JUDGMENT === 'true',
    requestAi: process.env.APP_SMOKE_REQUEST_AI === 'true',
    run: process.env.APP_TRUE_SERVICE_SMOKE_RUN === 'true',
    scope: process.env.APP_SMOKE_SCOPE ?? 'm1',
    timeoutMs: Number(process.env.APP_SMOKE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  };

  for (const arg of argv) {
    if (arg === '--run') parsed.run = true;
    else if (arg === '--allow-remote-api') parsed.allowRemoteApi = true;
    else if (arg === '--allow-remote-db') parsed.allowRemoteDb = true;
    else if (arg === '--bootstrap-local-users') parsed.bootstrapLocalUsers = true;
    else if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--deep') parsed.deep = true;
    else if (arg === '--m1-inject-expired-session') parsed.injectM1ExpiredSession = true;
    else if (arg === '--m1-stream-replay') parsed.m1StreamReplay = true;
    else if (arg === '--m2-inject-failure') parsed.injectM2Failure = true;
    else if (arg === '--m2-inject-partial-success') parsed.injectM2PartialSuccess = true;
    else if (arg === '--require-judgment') parsed.requireJudgment = true;
    else if (arg === '--request-ai') parsed.requestAi = true;
    else if (arg.startsWith('--scope=')) parsed.scope = arg.slice('--scope='.length);
    else if (arg.startsWith('--api-base-url=')) parsed.apiBaseUrl = arg.slice('--api-base-url='.length);
    else if (arg.startsWith('--timeout-ms=')) parsed.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else throw new SmokeError(`Unknown argument: ${arg}`);
  }

  if (parsed.dryRun) parsed.run = false;
  return parsed;
}

function printHelp() {
  console.log(`Usage: npm --prefix mobile run smoke:true-service -- [options]

Options:
  --scope=m1|m2|m3|m4|m5|all    Smoke scope. Default: m1.
  --run                         Execute against the configured backend.
  --dry-run                     Validate smoke configuration without network calls.
  --api-base-url=<url>          API base URL. Default: ${DEFAULT_API_BASE_URL}.
  --allow-remote-api            Allow smoke against a non-local API URL.
  --allow-remote-db             Allow local backend smoke when backend/.env DATABASE_URL is non-local.
  --bootstrap-local-users       Register temporary smoke users. Requires local API + local DB.
  --deep                        Run optional deeper M2 interview mutation.
  --m1-inject-expired-session   Local-only M1 expired-session probe: expire smoke sessions and verify recovery/access/claim behavior.
  --m1-stream-replay            Probe M1 case_judgment SSE replay after quick judgment persistence.
  --m2-inject-failure           Local-only M2 failure probe: inject processing_failed and verify resume/retry.
  --m2-inject-partial-success   Local-only M2 partial-success probe: inject completed/no-feedback state.
  --request-ai                  Request AI-heavy Chat/Formal Case judgment work where supported.
  --require-judgment            Fail if quick/formal judgment is still pending after polling.
  --timeout-ms=<ms>             Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}.

Environment:
  APP_SMOKE_API_BASE_URL or EXPO_PUBLIC_API_BASE_URL
  APP_SMOKE_AUTH_TOKEN or APP_SMOKE_AUTH_TOKEN_A
  APP_SMOKE_PARTNER_AUTH_TOKEN or APP_SMOKE_AUTH_TOKEN_B
  APP_SMOKE_EMAIL / APP_SMOKE_PASSWORD
  APP_SMOKE_PARTNER_EMAIL / APP_SMOKE_PARTNER_PASSWORD
  APP_SMOKE_BOOTSTRAP_LOCAL_USERS=true to create temporary local smoke users
  APP_SMOKE_M1_INJECT_EXPIRED_SESSION=true to run the local-only M1 expired-session probe
  APP_SMOKE_M1_STREAM_REPLAY=true to run the M1 case_judgment stream replay probe
  APP_SMOKE_M2_INJECT_FAILURE=true to run the local-only M2 failed-session probe
  APP_SMOKE_M2_INJECT_PARTIAL_SUCCESS=true to run the local-only M2 partial-success probe
  APP_SMOKE_ALLOW_REMOTE_API=true to target a non-local API
  APP_SMOKE_ALLOW_REMOTE_DB=true to run local backend smoke with a non-local DB
`);
}

function normalizeBaseUrl(input) {
  const url = new URL(input);
  return url.toString().replace(/\/$/, '');
}

function parseScopes(scopeInput) {
  const rawScopes = scopeInput.split(',').map((scope) => scope.trim().toLowerCase()).filter(Boolean);
  if (rawScopes.length === 0) throw new SmokeError('At least one scope is required.');
  for (const scope of rawScopes) {
    if (!VALID_SCOPES.has(scope)) throw new SmokeError(`Invalid scope: ${scope}`);
  }
  if (rawScopes.includes('all')) return ['m1', 'm2', 'm3', 'm4', 'm5'];
  return [...new Set(rawScopes)];
}

function isLocalHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '0.0.0.0' ||
    normalized.startsWith('127.');
}

function isLocalUrl(urlString) {
  try {
    return isLocalHostname(new URL(urlString).hostname);
  } catch {
    return false;
  }
}

function stripEnvQuotes(value) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    values[trimmed.slice(0, index).trim()] = stripEnvQuotes(trimmed.slice(index + 1));
  }
  return values;
}

function classifyDatabaseTarget(databaseUrl) {
  if (!databaseUrl) {
    return { present: false, local: false, provider: null };
  }
  try {
    const url = new URL(databaseUrl);
    const provider = url.protocol.replace(':', '');
    const local = provider === 'file' || isLocalHostname(url.hostname);
    return {
      present: true,
      local,
      provider,
    };
  } catch {
    return {
      present: true,
      local: false,
      provider: 'unknown',
    };
  }
}

function getBackendDatabaseSafety() {
  const env = readDotEnv(backendEnvPath);
  const databaseUrl = getBackendDatabaseUrl(env);
  return {
    ...classifyDatabaseTarget(databaseUrl),
    source: process.env.APP_SMOKE_BACKEND_DATABASE_URL
      ? 'APP_SMOKE_BACKEND_DATABASE_URL'
      : (process.env.DATABASE_URL ? 'DATABASE_URL' : 'backend/.env'),
  };
}

function getBackendDatabaseUrl(env = readDotEnv(backendEnvPath)) {
  return process.env.APP_SMOKE_BACKEND_DATABASE_URL ?? process.env.DATABASE_URL ?? env.DATABASE_URL;
}

function evaluateRunSafety(options) {
  const localApi = isLocalUrl(options.apiBaseUrl);
  if (!localApi) {
    if (!options.allowRemoteApi) {
      return {
        status: 'blocked',
        details: {
          apiBaseUrl: options.apiBaseUrl,
          reason: 'Refusing to run against a non-local API URL without explicit override.',
          override: 'APP_SMOKE_ALLOW_REMOTE_API=true or --allow-remote-api',
        },
      };
    }
    return {
      status: 'warn',
      details: {
        apiBaseUrl: options.apiBaseUrl,
        reason: 'Remote API smoke was explicitly allowed; verify this is staging/sandbox before running.',
      },
    };
  }

  const database = getBackendDatabaseSafety();
  if (!database.present) {
    return {
      status: 'blocked',
      details: {
        apiBaseUrl: options.apiBaseUrl,
        database: { present: false, source: database.source },
        reason: 'Local backend smoke requires a discoverable backend DATABASE_URL safety classification.',
      },
    };
  }
  if (!database.local && !options.allowRemoteDb) {
    return {
      status: 'blocked',
      details: {
        apiBaseUrl: options.apiBaseUrl,
        database: {
          present: true,
          local: false,
          provider: database.provider,
          source: database.source,
        },
        reason: 'Refusing to run local API smoke because the backend database target is not local.',
        override: 'APP_SMOKE_ALLOW_REMOTE_DB=true or --allow-remote-db',
      },
    };
  }
  return {
    status: database.local ? 'passed' : 'warn',
    details: {
      apiBaseUrl: options.apiBaseUrl,
      database: {
        present: true,
        local: database.local,
        provider: database.provider,
        source: database.source,
      },
      reason: database.local
        ? 'Local API and local database target detected.'
        : 'Remote database smoke was explicitly allowed; verify this is staging/sandbox before running.',
    },
  };
}

function ensureLocalDbInjectionAllowed(options) {
  const database = getBackendDatabaseSafety();
  if (!isLocalUrl(options.apiBaseUrl) || !database.local) {
    throw new SmokeError('App smoke DB-state injection is only allowed against local API and local DB.', {
      apiBaseUrl: options.apiBaseUrl,
      database: {
        present: database.present,
        local: database.local,
        provider: database.provider,
        source: database.source,
      },
    });
  }
  return database;
}

async function withBackendPrisma(options, callback) {
  ensureLocalDbInjectionAllowed(options);
  const databaseUrl = getBackendDatabaseUrl();
  if (!databaseUrl) throw new SmokeError('App smoke DB-state injection requires a backend DATABASE_URL.');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  const requireFromBackend = createRequire(path.resolve(repoRoot, 'backend', 'package.json'));
  const { PrismaClient } = requireFromBackend('@prisma/client');
  const prisma = new PrismaClient();
  try {
    return await callback(prisma);
  } finally {
    await prisma.$disconnect();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
}

function redact(value) {
  if (!value) return null;
  return '[provided]';
}

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hasPrimaryAuthInput() {
  return Boolean(
    readEnv('APP_SMOKE_AUTH_TOKEN_A') ??
    readEnv('APP_SMOKE_AUTH_TOKEN') ??
    (readEnv('APP_SMOKE_EMAIL') && readEnv('APP_SMOKE_PASSWORD'))
  );
}

function hasPartnerAuthInput() {
  return Boolean(
    readEnv('APP_SMOKE_AUTH_TOKEN_B') ??
    readEnv('APP_SMOKE_PARTNER_AUTH_TOKEN') ??
    (readEnv('APP_SMOKE_PARTNER_EMAIL') && readEnv('APP_SMOKE_PARTNER_PASSWORD'))
  );
}

function buildReport(options, scopes) {
  return {
    check: 'app-true-service-smoke',
    mode: options.run ? 'run' : 'dry-run',
    apiBaseUrl: options.apiBaseUrl,
    scope: scopes,
    options: {
      deep: options.deep,
      allowRemoteApi: options.allowRemoteApi,
      allowRemoteDb: options.allowRemoteDb,
      bootstrapLocalUsers: options.bootstrapLocalUsers,
      injectM1ExpiredSession: options.injectM1ExpiredSession,
      m1StreamReplay: options.m1StreamReplay,
      injectM2Failure: options.injectM2Failure,
      injectM2PartialSuccess: options.injectM2PartialSuccess,
      requestAi: options.requestAi,
      requireJudgment: options.requireJudgment,
      timeoutMs: options.timeoutMs,
    },
    auth: {
      primaryToken: redact(readEnv('APP_SMOKE_AUTH_TOKEN_A') ?? readEnv('APP_SMOKE_AUTH_TOKEN')),
      primaryLogin: redact(readEnv('APP_SMOKE_EMAIL') && readEnv('APP_SMOKE_PASSWORD')),
      partnerToken: redact(readEnv('APP_SMOKE_AUTH_TOKEN_B') ?? readEnv('APP_SMOKE_PARTNER_AUTH_TOKEN')),
      partnerLogin: redact(readEnv('APP_SMOKE_PARTNER_EMAIL') && readEnv('APP_SMOKE_PARTNER_PASSWORD')),
    },
    startedAt: new Date().toISOString(),
    steps: [],
    ok: false,
    blocked: false,
  };
}

function addStep(report, name, status, details = {}) {
  report.steps.push({
    name,
    status,
    ...details,
  });
}

function summarizeReport(report) {
  report.finishedAt = new Date().toISOString();
  report.blocked = report.steps.some((step) => step.status === 'blocked');
  report.ok = !report.steps.some((step) => step.status === 'failed') && !report.blocked;
  return report;
}

function writeReport(report) {
  console.log(JSON.stringify(summarizeReport(report), null, 2));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

function makeRequestId(scope) {
  return `app-smoke-${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createHttpClient({ apiBaseUrl, timeoutMs }) {
  return async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      Accept: 'application/json',
      'X-Locale': 'zh-TW',
      'X-Request-Id': makeRequestId(options.scope ?? 'core'),
      ...options.headers,
    };

    if (options.sessionId) headers['X-Session-Id'] = options.sessionId;
    if (options.token) headers.Authorization = `Bearer ${options.token}`;

    let body;
    if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      const payload = text ? safeParseJson(text) : null;
      const envelopeError = payload?.success === false
        ? {
            code: payload.error?.code ?? `HTTP_${response.status}`,
            message: payload.error?.message ?? response.statusText,
            details: payload.error?.details,
          }
        : null;
      const allowed = options.allowStatuses?.includes(response.status);

      if ((!response.ok && !allowed) || (envelopeError && !allowed)) {
        throw new SmokeError(`${options.method ?? 'GET'} ${path} failed`, {
          status: response.status,
          code: envelopeError?.code,
          message: envelopeError?.message ?? response.statusText,
        });
      }

      return {
        status: response.status,
        ok: response.ok && !envelopeError,
        data: payload?.success === true ? payload.data : payload,
        error: envelopeError,
      };
    } catch (error) {
      if (isAbortError(error)) {
        throw new SmokeError(`${options.method ?? 'GET'} ${path} timed out`, { timeoutMs });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function parseSseBlock(block) {
  const event = { name: 'message', data: null };
  const dataLines = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event.name = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trimStart());
  }
  const dataText = dataLines.join('\n');
  event.data = dataText ? safeParseJson(dataText) : null;
  return event;
}

function extractRepairStreamTerminal(event) {
  if (event.name === 'ready') {
    const snapshots = Array.isArray(event.data?.snapshots) ? event.data.snapshots : [];
    const terminalSnapshot = snapshots.find((snapshot) => ['persisted', 'failed'].includes(snapshot?.status));
    if (terminalSnapshot) {
      return {
        eventType: `ready.${terminalSnapshot.status}`,
        status: terminalSnapshot.status,
        streamId: terminalSnapshot.streamId ?? null,
        requestId: terminalSnapshot.requestId ?? null,
        lastSeq: terminalSnapshot.lastSeq ?? null,
      };
    }
    return null;
  }

  const eventType = event.data?.eventType ?? event.name;
  if (eventType === 'stream.persisted' || eventType === 'stream.failed') {
    return {
      eventType,
      status: eventType === 'stream.persisted' ? 'persisted' : 'failed',
      streamId: event.data?.streamId ?? null,
      requestId: event.data?.requestId ?? null,
      lastSeq: event.data?.seq ?? null,
    };
  }

  return null;
}

async function waitForRepairTrackStreamTerminal({
  apiBaseUrl,
  token,
  trackId,
  timeoutMs = DEFAULT_REPAIR_REPLAN_STREAM_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(`${apiBaseUrl}/streams/repair_track/${encodeURIComponent(trackId)}?after_seq=0`, {
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
      'X-Locale': 'zh-TW',
      'X-Request-Id': makeRequestId('m4-replan-stream'),
    },
    signal: controller.signal,
  }).catch((error) => {
    if (isAbortError(error)) {
      throw new SmokeError('Repair track stream did not open before timeout.', { trackId, timeoutMs });
    }
    throw error;
  });

  if (!response.ok) {
    clearTimeout(timeout);
    throw new SmokeError('Repair track stream subscribe failed.', { trackId, status: response.status });
  }

  const reader = response.body?.getReader();
  if (!reader) {
    clearTimeout(timeout);
    throw new SmokeError('Repair track stream response did not expose a readable body.', { trackId });
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const seenEvents = [];

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex !== -1) {
        const block = buffer.slice(0, separatorIndex).trim();
        buffer = buffer.slice(separatorIndex + 2);
        if (block) {
          const event = parseSseBlock(block);
          seenEvents.push(event.name);
          const terminal = extractRepairStreamTerminal(event);
          if (terminal) {
            await reader.cancel().catch(() => {});
            clearTimeout(timeout);
            return {
              ...terminal,
              seenEvents,
            };
          }
        }
        separatorIndex = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    if (!isAbortError(error)) throw error;
  } finally {
    clearTimeout(timeout);
    await reader.cancel().catch(() => {});
  }

  throw new SmokeError('Repair track stream did not emit persisted/failed before timeout.', {
    trackId,
    timeoutMs,
    seenEvents,
  });
}

async function waitForCaseJudgmentStreamTerminal({
  apiBaseUrl,
  sessionId,
  caseId,
  afterSeq = 0,
  timeoutMs = DEFAULT_M1_STREAM_REPLAY_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(
    `${apiBaseUrl}/streams/case_judgment/${encodeURIComponent(caseId)}?after_seq=${encodeURIComponent(String(afterSeq))}`,
    {
      headers: {
        Accept: 'text/event-stream',
        'X-Session-Id': sessionId,
        'X-Locale': 'zh-TW',
        'X-Request-Id': makeRequestId('m1-case-judgment-stream'),
      },
      signal: controller.signal,
    }
  ).catch((error) => {
    if (isAbortError(error)) {
      throw new SmokeError('Case judgment stream did not open before timeout.', { caseId, afterSeq, timeoutMs });
    }
    throw error;
  });

  if (!response.ok) {
    clearTimeout(timeout);
    throw new SmokeError('Case judgment stream subscribe failed.', { caseId, afterSeq, status: response.status });
  }

  const reader = response.body?.getReader();
  if (!reader) {
    clearTimeout(timeout);
    throw new SmokeError('Case judgment stream response did not expose a readable body.', { caseId, afterSeq });
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const seenEvents = [];

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex !== -1) {
        const block = buffer.slice(0, separatorIndex).trim();
        buffer = buffer.slice(separatorIndex + 2);
        if (block) {
          const event = parseSseBlock(block);
          seenEvents.push(event.name);
          const terminal = extractRepairStreamTerminal(event);
          if (terminal) {
            await reader.cancel().catch(() => {});
            clearTimeout(timeout);
            return {
              ...terminal,
              seenEvents,
            };
          }
        }
        separatorIndex = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    if (!isAbortError(error)) throw error;
  } finally {
    clearTimeout(timeout);
    await reader.cancel().catch(() => {});
  }

  throw new SmokeError('Case judgment stream did not emit persisted/failed before timeout.', {
    caseId,
    afterSeq,
    timeoutMs,
    seenEvents,
  });
}

function makeBootstrapUser(actor) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `app-smoke-${actor}-${suffix}@example.com`,
    password: 'AppSmoke123!',
    nickname: actor === 'partner' ? 'App Smoke Partner' : 'App Smoke Primary',
  };
}

async function resolveToken(request, report, actor, options = {}) {
  options.bootstrapTokenCache ??= {};
  if (options.bootstrapTokenCache[actor]) {
    addStep(report, `${actor}.auth`, 'passed', {
      method: 'bootstrap-cache',
      email: options.bootstrapTokenCache[actor].email,
    });
    return options.bootstrapTokenCache[actor].token;
  }

  const token = actor === 'partner'
    ? readEnv('APP_SMOKE_AUTH_TOKEN_B') ?? readEnv('APP_SMOKE_PARTNER_AUTH_TOKEN')
    : readEnv('APP_SMOKE_AUTH_TOKEN_A') ?? readEnv('APP_SMOKE_AUTH_TOKEN');
  if (token) {
    addStep(report, `${actor}.auth`, 'passed', { method: 'token' });
    return token;
  }

  const email = actor === 'partner' ? readEnv('APP_SMOKE_PARTNER_EMAIL') : readEnv('APP_SMOKE_EMAIL');
  const password = actor === 'partner' ? readEnv('APP_SMOKE_PARTNER_PASSWORD') : readEnv('APP_SMOKE_PASSWORD');
  if (email && password) {
    const response = await request('/auth/login', {
      method: 'POST',
      body: { email, password },
      scope: 'auth',
    });
    const resolvedToken = response.data?.token;
    if (!resolvedToken) {
      throw new SmokeError('Login response did not include a token.', { actor });
    }
    addStep(report, `${actor}.auth`, 'passed', { method: 'login' });
    return resolvedToken;
  }

  if (!options.bootstrapLocalUsers) return null;

  const user = makeBootstrapUser(actor);
  const response = await request('/auth/register', {
    method: 'POST',
    body: user,
    scope: 'auth',
  });
  const registeredToken = response.data?.token;
  const userId = response.data?.user?.id;
  if (!registeredToken || !userId) {
    throw new SmokeError('Register response did not include a token and user id.', { actor });
  }
  options.bootstrapTokenCache[actor] = {
    email: user.email,
    token: registeredToken,
    userId,
  };
  addStep(report, `${actor}.auth`, 'passed', {
    method: 'bootstrap-register',
    email: user.email,
    userId,
  });
  return registeredToken;
}

async function createQuickSession(request, scope) {
  const response = await request('/sessions/quick', { method: 'POST', scope });
  const sessionId = response.data?.session_id;
  if (!sessionId) throw new SmokeError('Quick session response did not include session_id.');
  return response.data;
}

async function pollJudgment(request, report, { caseId, sessionId, token, scope, requireJudgment, minAttempts }) {
  const configuredAttempts = Number(process.env.APP_SMOKE_JUDGMENT_POLL_ATTEMPTS ?? DEFAULT_JUDGMENT_POLL_ATTEMPTS);
  const attempts = Math.max(configuredAttempts, Number(minAttempts ?? 0));
  const intervalMs = Number(process.env.APP_SMOKE_JUDGMENT_POLL_INTERVAL_MS ?? DEFAULT_JUDGMENT_POLL_INTERVAL_MS);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) await wait(intervalMs);
    const response = await request(`/cases/${encodeURIComponent(caseId)}/judgment`, {
      allowStatuses: [202, 404],
      sessionId,
      token,
      scope,
    });
    if (response.ok && response.data?.judgment?.id) {
      addStep(report, `${scope}.judgment`, 'passed', {
        judgmentId: response.data.judgment.id,
        attempts: attempt,
      });
      return response.data.judgment;
    }
  }

  addStep(report, `${scope}.judgment`, requireJudgment ? 'failed' : 'warn', {
    message: 'Judgment was still pending after polling.',
    attempts,
  });
  return null;
}

async function runM1StreamReplayProbe(report, options, { caseId, sessionId, judgment }) {
  if (!judgment?.id) {
    throw new SmokeError('M1 stream replay probe requires a persisted judgment.', { caseId });
  }

  const terminal = await waitForCaseJudgmentStreamTerminal({
    apiBaseUrl: options.apiBaseUrl,
    sessionId,
    caseId,
    afterSeq: 0,
  });
  if (terminal.status !== 'persisted') {
    throw new SmokeError('Case judgment stream finished without persisted status.', {
      caseId,
      terminal,
    });
  }
  const lastSeq = Number(terminal.lastSeq);
  if (!Number.isFinite(lastSeq) || lastSeq <= 0) {
    throw new SmokeError('Case judgment stream terminal did not include a replayable lastSeq.', {
      caseId,
      terminal,
    });
  }

  const replayAfterSeq = Math.max(0, lastSeq - 1);
  const replay = await waitForCaseJudgmentStreamTerminal({
    apiBaseUrl: options.apiBaseUrl,
    sessionId,
    caseId,
    afterSeq: replayAfterSeq,
  });
  if (replay.eventType !== 'stream.persisted' || Number(replay.lastSeq) !== lastSeq) {
    throw new SmokeError('Case judgment stream after_seq replay did not return the terminal persisted event.', {
      caseId,
      replayAfterSeq,
      terminal,
      replay,
    });
  }

  addStep(report, 'm1.case_judgment_stream_replay', 'passed', {
    caseId,
    judgmentId: judgment.id,
    terminalEventType: terminal.eventType,
    replayEventType: replay.eventType,
    replayAfterSeq,
    lastSeq,
    initialSeenEvents: terminal.seenEvents,
    replaySeenEvents: replay.seenEvents,
  });
}

async function pollInterviewResponseCompletion(request, report, { sessionId, token, expectedTurnCount = 2 }) {
  const attempts = Number(process.env.APP_SMOKE_INTERVIEW_RESPONSE_POLL_ATTEMPTS ?? DEFAULT_INTERVIEW_RESPONSE_POLL_ATTEMPTS);
  const intervalMs = Number(process.env.APP_SMOKE_INTERVIEW_RESPONSE_POLL_INTERVAL_MS ?? DEFAULT_INTERVIEW_RESPONSE_POLL_INTERVAL_MS);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) await wait(intervalMs);
    const response = await request(`/interview/${encodeURIComponent(sessionId)}`, {
      token,
      scope: 'm2',
    });
    const turns = Array.isArray(response.data?.turns) ? response.data.turns : [];
    const completedAiTurn = turns.find((turn) =>
      Number(turn?.turn_order ?? 0) >= expectedTurnCount &&
      typeof turn?.ai_message === 'string' &&
      turn.ai_message.trim().length > 0
    );
    if (completedAiTurn) {
      addStep(report, 'm2.interview_response_complete', 'passed', {
        sessionId,
        attempts: attempt,
        turns: turns.length,
        expectedTurnCount,
      });
      return;
    }
  }

  addStep(report, 'm2.interview_response_complete', 'failed', {
    message: 'Interview background AI response did not complete before polling ended.',
    sessionId,
    attempts,
    expectedTurnCount,
  });
  throw new SmokeError('Interview background AI response did not complete.', { sessionId, attempts, expectedTurnCount });
}

async function pollMyStoryCompletion(request, report, { sessionId, token }) {
  const attempts = Number(process.env.APP_SMOKE_MY_STORY_POLL_ATTEMPTS ?? DEFAULT_MY_STORY_POLL_ATTEMPTS);
  const intervalMs = Number(process.env.APP_SMOKE_MY_STORY_POLL_INTERVAL_MS ?? DEFAULT_MY_STORY_POLL_INTERVAL_MS);
  let lastStatus = null;
  let lastPipelineStep = null;
  let lastNarrativeCount = 0;
  let lastFeedbackCardPresent = false;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) await wait(intervalMs);

    const [sessionResponse, profileResponse, feedbackResponse] = await Promise.all([
      request(`/interview/${encodeURIComponent(sessionId)}`, { token, scope: 'm2' }),
      request('/psych-profile', { token, scope: 'm2' }),
      request('/psych-profile/feedback', { token, scope: 'm2' }),
    ]);

    const session = sessionResponse.data;
    const profile = profileResponse.data;
    const history = Array.isArray(feedbackResponse.data?.history) ? feedbackResponse.data.history : [];
    const historyItem = history.find((item) => item?.session_id === sessionId);
    const feedbackCardPresent = typeof historyItem?.feedback_card === 'string' && historyItem.feedback_card.trim().length > 0;
    const narrativeCount = Array.isArray(profile?.narratives) ? profile.narratives.length : 0;
    const pipelineStep = Number(session?.pipeline_step ?? 0);
    const status = session?.status ?? null;

    lastStatus = status;
    lastPipelineStep = Number.isFinite(pipelineStep) ? pipelineStep : null;
    lastNarrativeCount = narrativeCount;
    lastFeedbackCardPresent = feedbackCardPresent;

    if (status === 'processing_failed') {
      addStep(report, 'm2.my_story_completion', 'failed', {
        sessionId,
        status,
        pipelineStep: lastPipelineStep,
      });
      throw new SmokeError('Interview my-story pipeline failed.', { sessionId, status, pipelineStep: lastPipelineStep });
    }

    if (status === 'completed' && narrativeCount > 0 && feedbackCardPresent) {
      addStep(report, 'm2.my_story_completion', 'passed', {
        sessionId,
        attempts: attempt,
        pipelineStep: lastPipelineStep,
        narrativeCount,
        richnessScore: profile?.richness_score ?? null,
        feedbackHistoryCount: history.length,
      });
      return;
    }
  }

  addStep(report, 'm2.my_story_completion', 'failed', {
    message: 'Interview ended, but my-story profile/feedback artifacts were not ready before polling ended.',
    sessionId,
    attempts,
    lastStatus,
    lastPipelineStep,
    lastNarrativeCount,
    lastFeedbackCardPresent,
  });
  throw new SmokeError('Interview my-story artifacts were not ready before polling ended.', {
    sessionId,
    attempts,
    lastStatus,
    lastPipelineStep,
    lastNarrativeCount,
    lastFeedbackCardPresent,
  });
}

async function endInterviewWithRetry(request, report, { sessionId, token }) {
  const attempts = Number(process.env.APP_SMOKE_INTERVIEW_END_RETRY_ATTEMPTS ?? DEFAULT_INTERVIEW_END_RETRY_ATTEMPTS);
  const intervalMs = Number(process.env.APP_SMOKE_INTERVIEW_END_RETRY_INTERVAL_MS ?? DEFAULT_INTERVIEW_END_RETRY_INTERVAL_MS);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await request(`/interview/${encodeURIComponent(sessionId)}/end`, {
      method: 'POST',
      token,
      scope: 'm2',
      allowStatuses: [409],
    });
    if (response.ok) {
      addStep(report, 'm2.interview_end', 'passed', { sessionId, attempts: attempt });
      return;
    }
    if (attempt < attempts) {
      await wait(intervalMs);
    }
  }

  addStep(report, 'm2.interview_end', 'failed', {
    message: 'Interview end still conflicted after retrying.',
    sessionId,
    attempts,
  });
  throw new SmokeError('Interview end still conflicted after retrying.', { sessionId, attempts });
}

async function injectM2FailedSession(request, report, options, { sessionId, token }) {
  await withBackendPrisma(options, async (prisma) => {
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'processing_failed',
        pipeline_step: 2,
        ended_at: new Date(),
      },
    });
  });
  addStep(report, 'm2.failed_injection_db', 'passed', {
    sessionId,
    injectedStatus: 'processing_failed',
    pipelineStep: 2,
    safety: 'local-db-only',
  });

  const failedSession = await request(`/interview/${encodeURIComponent(sessionId)}`, {
    token,
    scope: 'm2',
  });
  if (failedSession.data?.status !== 'processing_failed') {
    throw new SmokeError('Injected M2 failed session did not read back as processing_failed.', {
      sessionId,
      observedStatus: failedSession.data?.status ?? null,
    });
  }
  addStep(report, 'm2.failed_session_readback', 'passed', {
    sessionId,
    observedStatus: failedSession.data.status,
    partialSuccess: failedSession.data.partial_success ?? null,
  });

  const resume = await request('/interview/resume', { token, scope: 'm2' });
  if (resume.data?.has_failed !== true || resume.data?.failed_session_id !== sessionId) {
    throw new SmokeError('Interview resume did not expose the injected failed session.', {
      sessionId,
      hasFailed: resume.data?.has_failed ?? null,
      failedSessionId: resume.data?.failed_session_id ?? null,
    });
  }
  addStep(report, 'm2.failed_session_resume_state', 'passed', {
    sessionId,
    hasFailed: true,
  });

  await request(`/interview/${encodeURIComponent(sessionId)}/retry`, {
    method: 'POST',
    token,
    scope: 'm2',
  });
  addStep(report, 'm2.failed_session_retry_accept', 'passed', { sessionId });
}

async function injectM2PartialSuccessSession(request, report, options, { sessionId, token }) {
  const completedPipelineStep = 6;
  await withBackendPrisma(options, async (prisma) => {
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        pipeline_step: completedPipelineStep,
        feedback_card: null,
        ended_at: new Date(),
      },
    });
  });
  addStep(report, 'm2.partial_success_injection_db', 'passed', {
    sessionId,
    injectedStatus: 'completed',
    pipelineStep: completedPipelineStep,
    feedbackCard: null,
    safety: 'local-db-only',
  });

  const partialSession = await request(`/interview/${encodeURIComponent(sessionId)}`, {
    token,
    scope: 'm2',
  });
  const partialSuccess = partialSession.data?.partial_success === true;
  if (!partialSuccess) {
    throw new SmokeError('Injected M2 partial-success session did not read back partial_success=true.', {
      sessionId,
      observedStatus: partialSession.data?.status ?? null,
      pipelineStep: partialSession.data?.pipeline_step ?? null,
      partialSuccess: partialSession.data?.partial_success ?? null,
      feedbackCardPresent: Boolean(partialSession.data?.feedback_card),
    });
  }
  addStep(report, 'm2.partial_success_readback', 'passed', {
    sessionId,
    observedStatus: partialSession.data.status,
    pipelineStep: partialSession.data.pipeline_step,
    partialSuccess: true,
  });

  const retry = await request(`/interview/${encodeURIComponent(sessionId)}/retry`, {
    method: 'POST',
    token,
    scope: 'm2',
    allowStatuses: [400, 422],
  });
  if (retry.ok) {
    throw new SmokeError('M2 partial-success session unexpectedly accepted failed-processing retry.', { sessionId });
  }
  addStep(report, 'm2.partial_success_retry_rejected', 'passed', {
    sessionId,
    httpStatus: retry.status,
    code: retry.error?.code ?? null,
  });
}

function getInterviewDeepResponses() {
  const configuredCount = Number(process.env.APP_SMOKE_INTERVIEW_DEEP_RESPONSE_COUNT ?? DEFAULT_INTERVIEW_DEEP_RESPONSE_COUNT);
  const responseCount = Math.max(DEFAULT_INTERVIEW_DEEP_RESPONSE_COUNT, Math.floor(configuredCount || DEFAULT_INTERVIEW_DEEP_RESPONSE_COUNT));
  const responses = [
    'I want the conversation to stay specific, calm, and focused on one next step. I usually become tense when a small disagreement starts repeating.',
    'A common pattern is that I try to explain my intention, but I also notice I can sound defensive when I feel misunderstood.',
    'I grew up thinking conflict should be solved quickly, so waiting or leaving things unclear makes me anxious and impatient.',
    'What would help me is a fair summary, a practical repair step, and a reminder to slow down before making assumptions.',
  ];

  while (responses.length < responseCount) {
    responses.push(
      `Additional app smoke detail ${responses.length + 1}: I can share one concrete example, one feeling, and one next action so the profile story has enough context.`
    );
  }
  return responses.slice(0, responseCount);
}

async function waitForInterviewTurnInterval(report) {
  const interviewTurnIntervalMs = Number(process.env.APP_SMOKE_INTERVIEW_TURN_INTERVAL_MS ?? DEFAULT_INTERVIEW_TURN_INTERVAL_MS);
  if (interviewTurnIntervalMs > 0) {
    await wait(interviewTurnIntervalMs);
    addStep(report, 'm2.interview_turn_interval_wait', 'passed', { waitedMs: interviewTurnIntervalMs });
  }
}

function createTinyPngUploadFormData() {
  if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
    throw new SmokeError('Global FormData/Blob is not available. Use Node 18+ to run App upload smoke.');
  }

  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const formData = new FormData();
  formData.append('files', new Blob([pngBytes], { type: 'image/png' }), 'app-smoke-evidence.png');
  formData.append('safety_assertion', JSON.stringify({
    contains_minor: false,
    contains_sensitive_content: false,
    contains_nonconsensual_content: false,
    contains_illegal_content: false,
    minor_guardian_or_self_upload_confirmed: false,
    sensitive_content_handling_ack: false,
  }));
  return formData;
}

async function uploadTinyPngEvidence(request, report, {
  caseId,
  scope,
  stepPrefix,
  sessionId,
  token,
  deleteAfter = false,
}) {
  const upload = await request(`/cases/${encodeURIComponent(caseId)}/evidence`, {
    method: 'POST',
    token,
    sessionId,
    scope,
    body: createTinyPngUploadFormData(),
  });
  const evidences = Array.isArray(upload.data?.evidences) ? upload.data.evidences : [];
  const evidenceId = evidences[0]?.id;
  if (!evidenceId) {
    throw new SmokeError('Evidence upload response did not include evidence id.', { caseId, evidenceCount: evidences.length });
  }
  addStep(report, `${stepPrefix}.evidence_upload`, 'passed', { caseId, evidenceId });

  if (deleteAfter) {
    await request(`/cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(evidenceId)}`, {
      method: 'DELETE',
      token,
      sessionId,
      scope,
    });
    addStep(report, `${stepPrefix}.evidence_delete`, 'passed', { caseId, evidenceId });
  }

  return { evidenceId, count: evidences.length };
}

async function createM5Notification(request, token, name, payload = {}) {
  const response = await request('/notifications', {
    method: 'POST',
    token,
    scope: 'm5',
    body: {
      channel: 'push',
      template_code: 'repair_journey_start_step',
      action_key: 'continue_today_step',
      priority: 'now',
      group_key: `app-smoke-m5-${name}`,
      dedup_key: `app-smoke-m5-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      payload: {
        title: 'App smoke M5 reminder',
        body: 'Synthetic notification for App true-service M5 smoke.',
        path: '/execution/dashboard',
        cta_label: 'Open repair dashboard',
        ...payload,
      },
    },
  });
  const notification = response.data?.notification;
  if (!notification?.id) throw new SmokeError('Notification create response did not include notification.id.', { name });
  return notification;
}

async function expireQuickSession(options, sessionId) {
  const expiredAt = new Date(Date.now() - 60_000);
  await withBackendPrisma(options, async (prisma) => {
    await prisma.quickSession.update({
      where: { id: sessionId },
      data: { expires_at: expiredAt },
    });
  });
  return expiredAt;
}

async function runM1ExpiredSessionProbe(request, report, options) {
  ensureLocalDbInjectionAllowed(options);

  const expiredSubmitSession = await createQuickSession(request, 'm1');
  const expiredSubmitAt = await expireQuickSession(options, expiredSubmitSession.session_id);
  addStep(report, 'm1.expired_submit_session_injection_db', 'passed', {
    sessionId: expiredSubmitSession.session_id,
    expiredAt: expiredSubmitAt.toISOString(),
    safety: 'local-db-only',
  });

  const recoveredCreate = await request('/cases/quick', {
    method: 'POST',
    sessionId: expiredSubmitSession.session_id,
    scope: 'm1',
    body: {
      plaintiff_statement: 'App true-service smoke M1 expired submit: the old anonymous session should not block a new quick case.',
      defendant_statement: 'The backend should rotate to a fresh anonymous session before creating the case.',
      evidence_urls: [],
    },
  });
  const recoveredSessionId = recoveredCreate.data?.session_id;
  const recoveredCaseId = recoveredCreate.data?.case?.id;
  if (!recoveredCaseId || !recoveredSessionId || recoveredSessionId === expiredSubmitSession.session_id) {
    throw new SmokeError('Expired quick submit did not recover with a fresh session.', {
      expiredSessionId: expiredSubmitSession.session_id,
      recoveredSessionId: recoveredSessionId ?? null,
      recoveredCaseId: recoveredCaseId ?? null,
    });
  }
  addStep(report, 'm1.expired_submit_session_recovered', 'passed', {
    expiredSessionId: expiredSubmitSession.session_id,
    recoveredSessionId,
    caseId: recoveredCaseId,
  });

  const accessSession = await createQuickSession(request, 'm1');
  const accessCreate = await request('/cases/quick', {
    method: 'POST',
    sessionId: accessSession.session_id,
    scope: 'm1',
    body: {
      plaintiff_statement: 'App true-service smoke M1 expired result: create a session-bound case before expiring its session.',
      defendant_statement: 'Reading the result with the expired session should be rejected.',
      evidence_urls: [],
    },
  });
  const accessSessionId = accessCreate.data?.session_id ?? accessSession.session_id;
  const accessCaseId = accessCreate.data?.case?.id;
  if (!accessCaseId) throw new SmokeError('Expired result probe quick case response did not include case.id.');
  await pollJudgment(request, report, {
    caseId: accessCaseId,
    sessionId: accessSessionId,
    scope: 'm1.expired_access',
    requireJudgment: true,
  });
  const expiredAccessAt = await expireQuickSession(options, accessSessionId);
  addStep(report, 'm1.expired_access_session_injection_db', 'passed', {
    sessionId: accessSessionId,
    caseId: accessCaseId,
    expiredAt: expiredAccessAt.toISOString(),
    safety: 'local-db-only',
  });

  const expiredAccess = await request(`/cases/${encodeURIComponent(accessCaseId)}`, {
    sessionId: accessSessionId,
    scope: 'm1',
    allowStatuses: [401],
  });
  if (expiredAccess.ok || expiredAccess.error?.code !== 'SESSION_EXPIRED') {
    throw new SmokeError('Expired quick result access did not return SESSION_EXPIRED.', {
      caseId: accessCaseId,
      sessionId: accessSessionId,
      httpStatus: expiredAccess.status,
      code: expiredAccess.error?.code ?? null,
    });
  }
  addStep(report, 'm1.expired_result_access_rejected', 'passed', {
    caseId: accessCaseId,
    sessionId: accessSessionId,
    httpStatus: expiredAccess.status,
    code: expiredAccess.error.code,
  });

  const token = await resolveToken(request, report, 'primary', options);
  if (!token) {
    addStep(report, 'm1.expired_claim_session', 'warn', {
      message: 'Skipped expired claim-session probe because no smoke auth token/login was provided.',
    });
    return;
  }

  const claimSession = await createQuickSession(request, 'm1');
  const claimCreate = await request('/cases/quick', {
    method: 'POST',
    sessionId: claimSession.session_id,
    scope: 'm1',
    body: {
      plaintiff_statement: 'App true-service smoke M1 expired claim: this anonymous case should not be claimable after expiry.',
      defendant_statement: 'The claim response should succeed without returning a case id.',
      evidence_urls: [],
    },
  });
  const claimSessionId = claimCreate.data?.session_id ?? claimSession.session_id;
  const claimCaseId = claimCreate.data?.case?.id;
  if (!claimCaseId) throw new SmokeError('Expired claim probe quick case response did not include case.id.');
  await pollJudgment(request, report, {
    caseId: claimCaseId,
    sessionId: claimSessionId,
    scope: 'm1.expired_claim',
    requireJudgment: true,
  });
  const expiredClaimAt = await expireQuickSession(options, claimSessionId);
  addStep(report, 'm1.expired_claim_session_injection_db', 'passed', {
    sessionId: claimSessionId,
    caseId: claimCaseId,
    expiredAt: expiredClaimAt.toISOString(),
    safety: 'local-db-only',
  });

  const claim = await request('/auth/claim-session', {
    method: 'POST',
    token,
    scope: 'm1',
    body: { session_id: claimSessionId },
  });
  if (claim.data?.case_id) {
    throw new SmokeError('Expired claim-session unexpectedly returned a case id.', {
      sessionId: claimSessionId,
      caseId: claim.data.case_id,
    });
  }
  addStep(report, 'm1.expired_claim_session_ignored', 'passed', {
    sessionId: claimSessionId,
    originalCaseId: claimCaseId,
    returnedCaseId: claim.data?.case_id ?? null,
  });
}

async function runM1(request, report, options) {
  const session = await createQuickSession(request, 'm1');
  addStep(report, 'm1.session', 'passed', { sessionId: session.session_id });

  const createCase = await request('/cases/quick', {
    method: 'POST',
    sessionId: session.session_id,
    scope: 'm1',
    body: {
      plaintiff_statement: 'App true-service smoke M1: I need a calm, fair summary of a small recurring household disagreement.',
      defendant_statement: 'The other person feels unheard and wants a practical next step.',
      evidence_urls: [],
    },
  });
  const caseId = createCase.data?.case?.id;
  const effectiveSessionId = createCase.data?.session_id ?? session.session_id;
  if (!caseId) throw new SmokeError('Quick case response did not include case.id.');
  addStep(report, 'm1.quick_case_create', 'passed', { caseId, sessionRotated: effectiveSessionId !== session.session_id });

  await request(`/cases/${encodeURIComponent(caseId)}`, {
    sessionId: effectiveSessionId,
    scope: 'm1',
  });
  addStep(report, 'm1.quick_case_get_by_id', 'passed', { caseId });

  await request('/cases/by-session', {
    sessionId: effectiveSessionId,
    scope: 'm1',
  });
  addStep(report, 'm1.quick_case_get_by_session', 'passed', { sessionId: effectiveSessionId });

  const judgment = await pollJudgment(request, report, {
    caseId,
    sessionId: effectiveSessionId,
    scope: 'm1',
    requireJudgment: options.requireJudgment || options.m1StreamReplay,
    minAttempts: options.m1StreamReplay ? 30 : undefined,
  });

  if (options.m1StreamReplay) {
    await runM1StreamReplayProbe(report, options, {
      caseId,
      sessionId: effectiveSessionId,
      judgment,
    });
  }

  const token = await resolveToken(request, report, 'primary', options);
  if (token) {
    await request('/auth/claim-session', {
      method: 'POST',
      token,
      scope: 'm1',
      body: { session_id: effectiveSessionId },
    });
    addStep(report, 'm1.claim_session', 'passed', { sessionId: effectiveSessionId });
  } else {
    addStep(report, 'm1.claim_session', 'warn', {
      message: 'Skipped claim-session because no smoke auth token/login was provided.',
    });
  }

  if (options.injectM1ExpiredSession) {
    await runM1ExpiredSessionProbe(request, report, options);
  }
}

async function runM2(request, report, options) {
  const token = await resolveToken(request, report, 'primary', options);
  if (!token) {
    addStep(report, 'm2.auth', 'blocked', {
      missing: ['APP_SMOKE_AUTH_TOKEN or APP_SMOKE_EMAIL/APP_SMOKE_PASSWORD'],
    });
    return;
  }

  await request('/profile/me', { token, scope: 'm2' });
  addStep(report, 'm2.profile_me', 'passed');

  await request('/psych-profile', { token, scope: 'm2' });
  addStep(report, 'm2.psych_profile', 'passed');

  await request('/psych-profile/consent', {
    method: 'POST',
    token,
    scope: 'm2',
  });
  addStep(report, 'm2.consent', 'passed');

  await request('/interview/resume', { token, scope: 'm2' });
  addStep(report, 'm2.interview_resume', 'passed');

  if (options.injectM2Failure) {
    ensureLocalDbInjectionAllowed(options);
    const failedStart = await request('/interview/start', {
      method: 'POST',
      token,
      scope: 'm2',
      body: { trigger: 'organic' },
    });
    const failedSessionId = failedStart.data?.id;
    if (!failedSessionId) throw new SmokeError('M2 failure injection start response did not include id.');
    addStep(report, 'm2.failed_injection_session_start', 'passed', { sessionId: failedSessionId });
    await injectM2FailedSession(request, report, options, { sessionId: failedSessionId, token });
  }

  if (options.injectM2PartialSuccess) {
    ensureLocalDbInjectionAllowed(options);
    const partialStart = await request('/interview/start', {
      method: 'POST',
      token,
      scope: 'm2',
      body: { trigger: 'organic' },
    });
    const partialSessionId = partialStart.data?.id;
    if (!partialSessionId) throw new SmokeError('M2 partial-success injection start response did not include id.');
    addStep(report, 'm2.partial_success_injection_session_start', 'passed', { sessionId: partialSessionId });
    await injectM2PartialSuccessSession(request, report, options, { sessionId: partialSessionId, token });
  }

  if (!options.deep) {
    addStep(report, 'm2.interview_deep_flow', 'warn', {
      message: 'Skipped start/respond/end; pass --deep for deeper synthetic smoke.',
    });
    return;
  }

  const start = await request('/interview/start', {
    method: 'POST',
    token,
    scope: 'm2',
    body: { trigger: 'organic' },
  });
  const sessionId = start.data?.id;
  if (!sessionId) throw new SmokeError('Interview start response did not include id.');
  addStep(report, 'm2.interview_start', 'passed', { sessionId });

  const responses = getInterviewDeepResponses();
  for (let index = 0; index < responses.length; index += 1) {
    await waitForInterviewTurnInterval(report);
    await request(`/interview/${encodeURIComponent(sessionId)}/respond`, {
      method: 'POST',
      token,
      scope: 'm2',
      body: { message: responses[index] },
    });
    addStep(report, 'm2.interview_respond', 'passed', {
      sessionId,
      responseIndex: index + 1,
      responseCount: responses.length,
    });

    await pollInterviewResponseCompletion(request, report, {
      sessionId,
      token,
      expectedTurnCount: index + 2,
    });
  }
  await endInterviewWithRetry(request, report, { sessionId, token });
  await pollMyStoryCompletion(request, report, { sessionId, token });
}

async function runM3(request, report, options) {
  const actorA = await createQuickSession(request, 'm3');
  addStep(report, 'm3.sessions', 'passed', { anonymousActors: 1 });

  const roomResponse = await request('/chat/rooms', {
    method: 'POST',
    sessionId: actorA.session_id,
    scope: 'm3',
    body: { history_visibility_mode: 'share_summary_only' },
  });
  const room = roomResponse.data?.room;
  if (!room?.id) throw new SmokeError('Chat room response did not include room.id.');
  addStep(report, 'm3.room_create', 'passed', { roomId: room.id });

  await request(`/chat/rooms/${encodeURIComponent(room.id)}/messages`, {
    method: 'POST',
    sessionId: actorA.session_id,
    scope: 'm3',
    body: { content: 'App smoke A: I want us to make a fair decision without escalating.', visibility_scope: 'all' },
  });
  addStep(report, 'm3.message_a', 'passed', { roomId: room.id });

  const inviteResponse = await request(`/chat/rooms/${encodeURIComponent(room.id)}/invites`, {
    method: 'POST',
    sessionId: actorA.session_id,
    scope: 'm3',
    body: { history_visibility_mode: 'share_from_join_time', expires_in_hours: 24 },
  });
  const inviteCode = inviteResponse.data?.invite?.invite_code;
  if (!inviteCode) throw new SmokeError('Chat invite response did not include invite_code.');
  addStep(report, 'm3.invite_create', 'passed', { roomId: room.id });

  await request(`/chat/rooms/${encodeURIComponent(room.id)}/messages?limit=10`, {
    sessionId: actorA.session_id,
    scope: 'm3',
  });
  addStep(report, 'm3.messages_list', 'passed', { roomId: room.id });

  await request(`/chat/rooms/${encodeURIComponent(room.id)}/judgment-status`, {
    sessionId: actorA.session_id,
    scope: 'm3',
  });
  addStep(report, 'm3.judgment_status', 'passed', { roomId: room.id });

  const partnerToken = await resolveToken(request, report, 'partner', options);
  if (!partnerToken) {
    addStep(report, 'm3.invite_accept', options.requestAi ? 'blocked' : 'warn', {
      message: 'Skipped invite accept because backend requires a logged-in accepting user.',
      required: ['APP_SMOKE_AUTH_TOKEN_B or APP_SMOKE_PARTNER_AUTH_TOKEN or APP_SMOKE_PARTNER_EMAIL/APP_SMOKE_PARTNER_PASSWORD'],
    });
    return;
  }

  await request(`/chat/invites/${encodeURIComponent(inviteCode)}/accept`, {
    method: 'POST',
    token: partnerToken,
    scope: 'm3',
  });
  addStep(report, 'm3.invite_accept', 'passed', { roomId: room.id });

  const chatMessageIntervalMs = Number(process.env.APP_SMOKE_CHAT_MESSAGE_INTERVAL_MS ?? DEFAULT_CHAT_MESSAGE_INTERVAL_MS);
  if (chatMessageIntervalMs > 0) {
    await wait(chatMessageIntervalMs);
    addStep(report, 'm3.message_rate_limit_wait', 'passed', { waitedMs: chatMessageIntervalMs });
  }

  await request(`/chat/rooms/${encodeURIComponent(room.id)}/messages`, {
    method: 'POST',
    token: partnerToken,
    scope: 'm3',
    body: { content: 'App smoke B: I can share context and agree to a balanced summary.', visibility_scope: 'all' },
  });
  addStep(report, 'm3.message_b', 'passed', { roomId: room.id });

  if (!options.requestAi) {
    addStep(report, 'm3.request_judgment', 'warn', {
      message: 'Skipped AI-heavy request-judgment; pass --request-ai to execute it.',
    });
    return;
  }

  if (chatMessageIntervalMs > 0) {
    await wait(chatMessageIntervalMs);
    addStep(report, 'm3.message_rate_limit_wait_after_b', 'passed', { waitedMs: chatMessageIntervalMs });
  }

  await request(`/chat/rooms/${encodeURIComponent(room.id)}/messages`, {
    method: 'POST',
    sessionId: actorA.session_id,
    scope: 'm3',
    body: { content: 'App smoke A follow-up: I consent to include both sides and want a practical judgment.', visibility_scope: 'all' },
  });
  addStep(report, 'm3.message_a_followup', 'passed', { roomId: room.id });

  const analysisMessagesResponse = await request(
    `/chat/rooms/${encodeURIComponent(room.id)}/messages?limit=50`,
    {
      sessionId: actorA.session_id,
      scope: 'm3',
    },
  );
  const selectedMessageIds = (analysisMessagesResponse.data?.messages ?? [])
    .filter((message) => message.message_type === 'user_text' && message.visibility_scope === 'all')
    .map((message) => message.id);
  if (selectedMessageIds.length < 2) {
    throw new SmokeError('Exact analysis smoke did not find both parties shared messages.', {
      roomId: room.id,
      selectedMessageCount: selectedMessageIds.length,
    });
  }

  const analysisRequestResponse = await request(
    `/chat/rooms/${encodeURIComponent(room.id)}/analysis-requests`,
    {
      method: 'POST',
      sessionId: actorA.session_id,
      scope: 'm3',
      body: {
        selected_message_ids: selectedMessageIds,
        selected_capsule_ids: [],
      },
    },
  );
  const analysisRequest = analysisRequestResponse.data?.analysis_request;
  if (!analysisRequest?.id || !analysisRequest.selection_hash || !analysisRequest.policy_version) {
    throw new SmokeError('Exact analysis request response was incomplete.', { roomId: room.id });
  }
  addStep(report, 'm3.analysis_request_create', 'passed', {
    analysisRequestId: analysisRequest.id,
    selectedMessageCount: selectedMessageIds.length,
  });

  const approvalBody = {
    decision: 'approved',
    policy_version: analysisRequest.policy_version,
    selection_hash: analysisRequest.selection_hash,
  };
  await request(
    `/chat/rooms/${encodeURIComponent(room.id)}/analysis-requests/${encodeURIComponent(analysisRequest.id)}/decision`,
    {
      method: 'POST',
      sessionId: actorA.session_id,
      scope: 'm3',
      body: approvalBody,
    },
  );
  await request(
    `/chat/rooms/${encodeURIComponent(room.id)}/analysis-requests/${encodeURIComponent(analysisRequest.id)}/decision`,
    {
      method: 'POST',
      token: partnerToken,
      scope: 'm3',
      body: approvalBody,
    },
  );
  addStep(report, 'm3.analysis_request_exact_approvals', 'passed', {
    analysisRequestId: analysisRequest.id,
    approvals: 2,
  });

  await request(
    `/chat/rooms/${encodeURIComponent(room.id)}/analysis-requests/${encodeURIComponent(analysisRequest.id)}/submit`,
    {
      method: 'POST',
      sessionId: actorA.session_id,
      scope: 'm3',
    },
  );
  addStep(report, 'm3.analysis_request_submit', 'passed', {
    analysisRequestId: analysisRequest.id,
  });

  await request(`/chat/rooms/${encodeURIComponent(room.id)}/request-judgment`, {
    method: 'POST',
    sessionId: actorA.session_id,
    scope: 'm3',
    body: {
      analysis_request_id: analysisRequest.id,
    },
  });
  addStep(report, 'm3.request_judgment', 'passed', { roomId: room.id });
}

async function runM4(request, report, options) {
  const tokenA = await resolveToken(request, report, 'primary', options);
  if (!tokenA) {
    addStep(report, 'm4.auth_primary', 'blocked', {
      missing: ['APP_SMOKE_AUTH_TOKEN_A or APP_SMOKE_AUTH_TOKEN or APP_SMOKE_EMAIL/APP_SMOKE_PASSWORD'],
    });
    return;
  }

  const tokenB = await resolveToken(request, report, 'partner', options);
  if (!tokenB) {
    addStep(report, 'm4.auth_partner', 'blocked', {
      missing: ['APP_SMOKE_AUTH_TOKEN_B or APP_SMOKE_PARTNER_AUTH_TOKEN or APP_SMOKE_PARTNER_EMAIL/APP_SMOKE_PARTNER_PASSWORD'],
    });
    return;
  }

  let pairing = null;
  try {
    const createPairing = await request('/pairing/create', {
      method: 'POST',
      token: tokenA,
      scope: 'm4',
      body: {},
    });
    const inviteCode = createPairing.data?.pairing?.invite_code;
    if (!inviteCode) throw new SmokeError('Pairing create response did not include invite_code.');
    addStep(report, 'm4.pairing_create', 'passed');

    const joinPairing = await request('/pairing/join', {
      method: 'POST',
      token: tokenB,
      scope: 'm4',
      body: { invite_code: inviteCode },
    });
    pairing = joinPairing.data?.pairing;
    addStep(report, 'm4.pairing_join', 'passed', { pairingId: pairing?.id });
  } catch (error) {
    if (!(error instanceof SmokeError)) throw error;
    const status = await request('/pairing/status', {
      token: tokenA,
      scope: 'm4',
    });
    pairing = status.data?.pairing;
    if (!pairing?.id || pairing.status !== 'active') {
      throw error;
    }
    addStep(report, 'm4.pairing_reuse', 'warn', {
      pairingId: pairing.id,
      message: 'Reused existing active pairing after create/join was unavailable.',
    });
  }

  const caseResponse = await request('/cases', {
    method: 'POST',
    token: tokenA,
    scope: 'm4',
    body: {
      pairing_id: pairing.id,
      mode: 'collaborative',
      title: 'App true-service smoke formal case',
      plaintiff_statement: 'App true-service smoke formal case from user A. The concern is recurring and needs a fair, low-conflict plan.',
      defendant_statement: 'App true-service smoke formal case from user B. The reply adds context and agrees to a practical next step.',
      evidence_urls: [],
      contains_minor: false,
      contains_sensitive_content: false,
      contains_nonconsensual_content: false,
      contains_illegal_content: false,
    },
  });
  const caseId = caseResponse.data?.case?.id;
  if (!caseId) throw new SmokeError('Formal case response did not include case.id.');
  addStep(report, 'm4.case_create', 'passed', { caseId });

  await uploadTinyPngEvidence(request, report, {
    caseId,
    token: tokenA,
    scope: 'm4',
    stepPrefix: 'm4',
  });

  await request('/cases?page=1&page_size=5', { token: tokenA, scope: 'm4' });
  addStep(report, 'm4.case_list', 'passed');

  const judgment = await pollJudgment(request, report, {
    caseId,
    token: tokenA,
    scope: 'm4',
    requireJudgment: options.requireJudgment,
  });

  await request('/execution/dashboard', { token: tokenA, scope: 'm4' });
  addStep(report, 'm4.execution_dashboard', 'passed');

  if (!judgment?.id || !options.requestAi) {
    addStep(report, 'm4.repair_plan_generation', 'warn', {
      message: judgment?.id
        ? 'Skipped plan generation; pass --request-ai to execute it.'
        : 'Skipped plan generation because no judgment was available.',
    });
    return;
  }

  const planResponse = await request(`/judgments/${encodeURIComponent(judgment.id)}/reconciliation-plans`, {
    method: 'POST',
    token: tokenA,
    scope: 'm4',
    body: {
      intent: 'repair',
      preferences: {
        difficulty: 'easy',
        pace: 'today',
        style: ['conversation'],
      },
    },
  });
  const plans = Array.isArray(planResponse.data?.plans) ? planResponse.data.plans : [];
  const recommendedPlanId = planResponse.data?.recommended_plan_id ?? null;
  const planId = recommendedPlanId || plans[0]?.id;
  if (!planId) {
    throw new SmokeError('Repair plan generation response did not include a plan id.', {
      judgmentId: judgment.id,
      planCount: plans.length,
    });
  }
  addStep(report, 'm4.repair_plan_generation', 'passed', { judgmentId: judgment.id, planId, planCount: plans.length });

  await request(`/reconciliation-plans/${encodeURIComponent(planId)}/select`, {
    method: 'POST',
    token: tokenA,
    scope: 'm4',
    body: {},
  });
  addStep(report, 'm4.repair_plan_select', 'passed', { planId });

  await request('/execution/confirm', {
    method: 'POST',
    token: tokenA,
    scope: 'm4',
    body: { plan_id: planId },
  });
  addStep(report, 'm4.execution_confirm', 'passed', { planId });

  const postConfirmDashboard = await request('/execution/dashboard', { token: tokenA, scope: 'm4' });
  const executions = Array.isArray(postConfirmDashboard.data?.executions) ? postConfirmDashboard.data.executions : [];
  const executionStatus = executions.find((item) => item.plan_id === planId || item.reconciliation_plan_id === planId)
    || executions.find((item) => item.track_id);
  const trackId = executionStatus?.track_id;
  if (!trackId) {
    throw new SmokeError('Execution dashboard did not expose repair track id after confirm.', {
      planId,
      executionCount: executions.length,
    });
  }
  addStep(report, 'm4.repair_track_dashboard', 'passed', {
    planId,
    trackId,
    journeyStatus: executionStatus.journey_status ?? null,
  });

  const replanResponse = await request(`/repair-tracks/${encodeURIComponent(trackId)}/replan`, {
    method: 'POST',
    token: tokenA,
    scope: 'm4',
    body: { mode: 'lower_pressure', reason: 'manual' },
  });
  const acceptedTrack = replanResponse.data?.track;
  if (!acceptedTrack?.stream_id || acceptedTrack.track_id !== trackId) {
    throw new SmokeError('Repair track replan response did not include expected stream metadata.', {
      trackId,
      acceptedTrack,
    });
  }
  addStep(report, 'm4.repair_track_replan_accept', 'passed', {
    trackId,
    streamId: acceptedTrack.stream_id,
    requestId: acceptedTrack.request_id ?? null,
  });

  const terminal = await waitForRepairTrackStreamTerminal({
    apiBaseUrl: options.apiBaseUrl,
    token: tokenA,
    trackId,
  });
  if (terminal.status !== 'persisted') {
    throw new SmokeError('Repair track replan stream finished without persisted status.', {
      trackId,
      terminal,
    });
  }
  addStep(report, 'm4.repair_track_replan_stream', 'passed', {
    trackId,
    eventType: terminal.eventType,
    streamId: terminal.streamId,
    lastSeq: terminal.lastSeq,
    seenEvents: terminal.seenEvents,
  });
}

async function runM5(request, report, options) {
  const token = await resolveToken(request, report, 'primary', options);
  if (!token) {
    addStep(report, 'm5.auth', 'blocked', {
      missing: ['APP_SMOKE_AUTH_TOKEN or APP_SMOKE_EMAIL/APP_SMOKE_PASSWORD'],
    });
    return;
  }

  const smokeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const deviceId = `app-smoke-device-${smokeId}`;
  const pushToken = `ExponentPushToken[app-smoke-${smokeId}]`;

  const registerToken = await request('/notifications/device-tokens', {
    method: 'POST',
    token,
    scope: 'm5',
    body: {
      token: pushToken,
      platform: 'ios',
      device_id: deviceId,
      app_version: '0.0.0-smoke',
      build_number: smokeId.slice(0, 40),
    },
  });
  const deviceToken = registerToken.data?.device_token;
  if (!deviceToken?.id || deviceToken.revoked_at) {
    throw new SmokeError('Push device token registration response was invalid.', {
      hasId: Boolean(deviceToken?.id),
      revokedAt: deviceToken?.revoked_at ?? null,
    });
  }
  addStep(report, 'm5.push_token_register', 'passed', {
    deviceTokenId: deviceToken.id,
    platform: deviceToken.platform,
  });

  const notificationForRead = await createM5Notification(request, token, `read-${smokeId}`);
  const notificationForSnooze = await createM5Notification(request, token, `snooze-${smokeId}`);
  const notificationForDismiss = await createM5Notification(request, token, `dismiss-${smokeId}`);
  const notificationForAct = await createM5Notification(request, token, `act-${smokeId}`);
  addStep(report, 'm5.notification_create', 'passed', {
    notificationIds: [
      notificationForRead.id,
      notificationForSnooze.id,
      notificationForDismiss.id,
      notificationForAct.id,
    ],
  });

  const list = await request('/notifications?state=all&limit=10', {
    token,
    scope: 'm5',
  });
  const notifications = Array.isArray(list.data?.notifications) ? list.data.notifications : [];
  const listedIds = new Set(notifications.map((item) => item.id));
  if (!listedIds.has(notificationForRead.id)) {
    throw new SmokeError('Notification list did not include a freshly created notification.', {
      notificationId: notificationForRead.id,
      listCount: notifications.length,
    });
  }
  addStep(report, 'm5.notification_list', 'passed', {
    count: notifications.length,
    hasMore: Boolean(list.data?.has_more),
  });

  const unreadCount = await request('/notifications/unread-count', {
    token,
    scope: 'm5',
  });
  addStep(report, 'm5.notification_unread_count', 'passed', {
    unreadCount: unreadCount.data?.unread_count ?? null,
  });

  const read = await request(`/notifications/${encodeURIComponent(notificationForRead.id)}/read`, {
    method: 'POST',
    token,
    scope: 'm5',
  });
  if (!read.data?.notification?.read_at) {
    throw new SmokeError('Notification read response did not include read_at.', { notificationId: notificationForRead.id });
  }
  addStep(report, 'm5.notification_read', 'passed', { notificationId: notificationForRead.id });

  const snooze = await request(`/notifications/${encodeURIComponent(notificationForSnooze.id)}/snooze`, {
    method: 'POST',
    token,
    scope: 'm5',
    body: { hours: 1 },
  });
  if (!snooze.data?.notification?.snoozed_until) {
    throw new SmokeError('Notification snooze response did not include snoozed_until.', { notificationId: notificationForSnooze.id });
  }
  addStep(report, 'm5.notification_snooze', 'passed', { notificationId: notificationForSnooze.id });

  const dismiss = await request(`/notifications/${encodeURIComponent(notificationForDismiss.id)}/dismiss`, {
    method: 'POST',
    token,
    scope: 'm5',
  });
  if (!dismiss.data?.notification?.dismissed_at) {
    throw new SmokeError('Notification dismiss response did not include dismissed_at.', { notificationId: notificationForDismiss.id });
  }
  addStep(report, 'm5.notification_dismiss', 'passed', { notificationId: notificationForDismiss.id });

  const act = await request(`/notifications/${encodeURIComponent(notificationForAct.id)}/act`, {
    method: 'POST',
    token,
    scope: 'm5',
    body: { action_key: 'continue_today_step' },
  });
  if (act.data?.target?.path !== '/execution/dashboard' || !act.data?.notification?.acted_at) {
    throw new SmokeError('Notification act response did not include the expected target/action state.', {
      notificationId: notificationForAct.id,
      target: act.data?.target ?? null,
      actedAt: act.data?.notification?.acted_at ?? null,
    });
  }
  addStep(report, 'm5.notification_act', 'passed', {
    notificationId: notificationForAct.id,
    targetPath: act.data.target.path,
  });

  const markAll = await request('/notifications/read-all', {
    method: 'POST',
    token,
    scope: 'm5',
  });
  addStep(report, 'm5.notification_mark_all_read', 'passed', {
    updatedCount: markAll.data?.updatedCount ?? null,
  });

  const session = await createQuickSession(request, 'm5');
  const createCase = await request('/cases/quick', {
    method: 'POST',
    sessionId: session.session_id,
    scope: 'm5',
    body: {
      plaintiff_statement: 'App true-service smoke M5 upload: I need a calm record before adding one small evidence image.',
      defendant_statement: 'The other side wants the record to stay practical and not expose sensitive details.',
      evidence_urls: [],
    },
  });
  const caseId = createCase.data?.case?.id;
  const effectiveSessionId = createCase.data?.session_id ?? session.session_id;
  if (!caseId) throw new SmokeError('M5 quick case response did not include case.id.');
  addStep(report, 'm5.upload_case_create', 'passed', { caseId });

  await uploadTinyPngEvidence(request, report, {
    caseId,
    sessionId: effectiveSessionId,
    scope: 'm5',
    stepPrefix: 'm5',
    deleteAfter: true,
  });

  const telemetry = await request('/telemetry/events', {
    method: 'POST',
    token,
    sessionId: effectiveSessionId,
    scope: 'm5',
    body: {
      events: [{
        name: 'app_smoke_m5_true_service',
        severity: 'info',
        route: '/notifications',
        app_version: '0.0.0-smoke',
        platform: 'ios',
        build_number: smokeId.slice(0, 40),
        context: {
          smoke_scope: 'm5',
          auth_token: pushToken,
        },
      }],
    },
  });
  if (telemetry.status !== 202 || telemetry.data?.accepted_count !== 1) {
    throw new SmokeError('Telemetry ingest response was invalid.', {
      status: telemetry.status,
      acceptedCount: telemetry.data?.accepted_count ?? null,
    });
  }
  addStep(report, 'm5.telemetry_ingest', 'passed', {
    acceptedCount: telemetry.data.accepted_count,
    persistedCount: telemetry.data.persisted_count ?? null,
  });

  const revoke = await request('/notifications/device-tokens/revoke', {
    method: 'POST',
    token,
    scope: 'm5',
    body: { token: pushToken },
  });
  if (Number(revoke.data?.revokedCount ?? 0) < 1) {
    throw new SmokeError('Push device token revoke did not revoke the registered token.', {
      revokedCount: revoke.data?.revokedCount ?? null,
    });
  }
  addStep(report, 'm5.push_token_revoke', 'passed', {
    revokedCount: revoke.data.revokedCount,
  });
}

function addDryRunSteps(report, scopes) {
  const safety = evaluateRunSafety({
    ...report.options,
    apiBaseUrl: report.apiBaseUrl,
  });
  addStep(report, 'safety.run_target', safety.status, safety.details);
  addStep(report, 'config.api_base_url', 'passed', { apiBaseUrl: report.apiBaseUrl });
  if (scopes.includes('m1')) {
    addStep(report, 'm1.requirements', 'passed', {
      message: 'M1 run uses anonymous quick session; auth token is optional for claim-session.',
      streamReplay: report.options.m1StreamReplay
        ? 'enabled; run mode requires judgment persistence and probes /streams/case_judgment/:caseId with after_seq replay'
        : 'disabled',
      dbStateInjection: report.options.injectM1ExpiredSession
        ? 'enabled; run mode requires local API + local DB and writes only smoke-created quick sessions'
        : 'disabled',
    });
  }
  if (scopes.includes('m2')) {
    addStep(report, 'm2.requirements', hasPrimaryAuthInput() || report.options.bootstrapLocalUsers ? 'passed' : 'blocked', {
      required: ['APP_SMOKE_AUTH_TOKEN or APP_SMOKE_EMAIL/APP_SMOKE_PASSWORD'],
      localBootstrap: report.options.bootstrapLocalUsers,
      dbStateInjection: report.options.injectM2Failure || report.options.injectM2PartialSuccess
        ? 'enabled; run mode requires local API + local DB and writes only smoke-created interview sessions'
        : 'disabled',
    });
  }
  if (scopes.includes('m3')) {
    const requiresPartner = report.options.requestAi;
    addStep(report, 'm3.requirements', requiresPartner && !hasPartnerAuthInput() && !report.options.bootstrapLocalUsers ? 'blocked' : 'passed', {
      message: 'M3 run can probe anonymous room/message/invite/list/status. Invite accept and --request-ai require partner auth.',
      required: requiresPartner
        ? ['APP_SMOKE_AUTH_TOKEN_B or APP_SMOKE_PARTNER_AUTH_TOKEN or APP_SMOKE_PARTNER_EMAIL/APP_SMOKE_PARTNER_PASSWORD']
        : undefined,
      localBootstrap: report.options.bootstrapLocalUsers,
    });
  }
  if (scopes.includes('m4')) {
    addStep(report, 'm4.requirements', (hasPrimaryAuthInput() && hasPartnerAuthInput()) || report.options.bootstrapLocalUsers ? 'passed' : 'blocked', {
      required: [
        'APP_SMOKE_AUTH_TOKEN_A or APP_SMOKE_AUTH_TOKEN or APP_SMOKE_EMAIL/APP_SMOKE_PASSWORD',
        'APP_SMOKE_AUTH_TOKEN_B or APP_SMOKE_PARTNER_AUTH_TOKEN or APP_SMOKE_PARTNER_EMAIL/APP_SMOKE_PARTNER_PASSWORD',
      ],
      localBootstrap: report.options.bootstrapLocalUsers,
    });
  }
  if (scopes.includes('m5')) {
    addStep(report, 'm5.requirements', hasPrimaryAuthInput() || report.options.bootstrapLocalUsers ? 'passed' : 'blocked', {
      message: 'M5 probes authenticated notification/device-token APIs plus anonymous-session evidence upload and telemetry ingest.',
      required: ['APP_SMOKE_AUTH_TOKEN or APP_SMOKE_EMAIL/APP_SMOKE_PASSWORD'],
      localBootstrap: report.options.bootstrapLocalUsers,
    });
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (typeof fetch !== 'function') {
    throw new SmokeError('Global fetch is not available. Use Node 18+ to run this smoke script.');
  }
  options.apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl);
  const scopes = parseScopes(options.scope);
  const report = buildReport(options, scopes);

  if (!options.run) {
    addDryRunSteps(report, scopes);
    writeReport(report);
    return;
  }

  const safety = evaluateRunSafety(options);
  addStep(report, 'safety.run_target', safety.status, safety.details);
  if (safety.status === 'blocked') {
    writeReport(report);
    process.exit(1);
  }
  if (options.bootstrapLocalUsers && (!isLocalUrl(options.apiBaseUrl) || safety.details?.database?.local !== true)) {
    addStep(report, 'safety.bootstrap_local_users', 'blocked', {
      reason: 'Refusing to create smoke users unless both API and database targets are local.',
      apiBaseUrl: options.apiBaseUrl,
      database: safety.details?.database,
    });
    writeReport(report);
    process.exit(1);
  }
  if (options.bootstrapLocalUsers) {
    addStep(report, 'safety.bootstrap_local_users', 'passed', {
      reason: 'Temporary smoke user bootstrap is limited to the local API and local database target.',
    });
  }

  const request = createHttpClient(options);
  await request('/version', { scope: 'core' });
  addStep(report, 'core.version', 'passed');

  for (const scope of scopes) {
    if (scope === 'm1') await runM1(request, report, options);
    if (scope === 'm2') await runM2(request, report, options);
    if (scope === 'm3') await runM3(request, report, options);
    if (scope === 'm4') await runM4(request, report, options);
    if (scope === 'm5') await runM5(request, report, options);
  }

  writeReport(report);
  if (!summarizeReport(report).ok) process.exitCode = 1;
}

run().catch((error) => {
  const message = error instanceof SmokeError ? error.message : (error?.message ?? String(error));
  const details = error instanceof SmokeError ? error.details : {};
  console.error(JSON.stringify({
    check: 'app-true-service-smoke',
    ok: false,
    error: message,
    details,
    finishedAt: new Date().toISOString(),
  }, null, 2));
  process.exit(1);
});
