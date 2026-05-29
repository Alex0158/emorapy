import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const defaultApiBaseUrl = 'http://127.0.0.1:3001/api/v1';
const releaseEnvFileKeys = new Set([
  'DEVELOPER_DIR',
  'APP_RELEASE_EXTERNAL_SIGNOFF_RUN',
  'APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR',
  'APP_PHYSICAL_DEVICE_PLATFORM',
  'APP_EAS_IOS_REQUIRE_TESTFLIGHT',
  'APP_STORE_CONNECT_APP_ID',
  'APP_PUSH_DELIVERY_ACCESS_TOKEN',
  'APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT',
  'EXPO_TOKEN',
  'ASC_APPLE_ID',
  'EXPO_APPLE_APP_SPECIFIC_PASSWORD',
  'APP_STORE_CONNECT_ISSUER_ID',
  'APP_STORE_CONNECT_KEY_ID',
  'APP_STORE_CONNECT_PRIVATE_KEY_PATH',
  'APP_IOS_DEVICE_UDID',
  'APP_IOS_DEVICE_APP_PATH',
  'APP_ANDROID_DEVICE_SERIAL',
  'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN',
  'APP_SENTRY_ORG',
  'APP_SENTRY_PROJECT',
  'APP_SENTRY_AUTH_TOKEN',
  'APP_NATIVE_CRASH_SENTRY_EVENT_ID',
  'APP_TELEMETRY_RUNTIME_SMOKE_RUN',
  'APP_TELEMETRY_RUNTIME_API_BASE_URL',
  'APP_TELEMETRY_RUNTIME_TIMEOUT_MS',
  'DATABASE_URL',
]);

function parseEnvValue(rawValue) {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isPlaceholderValue(value) {
  const text = String(value ?? '').trim();
  return text.length === 0 || text.startsWith('REPLACE_WITH_');
}

function resolveExistingFilePath(input) {
  if (path.isAbsolute(input)) return fs.existsSync(input) ? input : null;
  return [
    path.resolve(process.cwd(), input),
    path.resolve(mobileRoot, input),
    path.resolve(repoRoot, input),
  ].find((candidate) => fs.existsSync(candidate)) ?? null;
}

function loadReleaseEnvFile(rawPath) {
  const resolvedPath = resolveExistingFilePath(rawPath);
  if (!resolvedPath) {
    console.error(`[telemetry-runtime-smoke] --release-env-file path does not exist: ${rawPath}`);
    process.exit(1);
  }
  const text = fs.readFileSync(resolvedPath, 'utf8');
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(normalized);
    if (!match) {
      console.error(
        `[telemetry-runtime-smoke] invalid --release-env-file line ${index + 1}; expected KEY=value without shell expansion`
      );
      process.exit(1);
    }
    const [, key, rawValue] = match;
    if (!releaseEnvFileKeys.has(key)) {
      console.error(`[telemetry-runtime-smoke] unsupported --release-env-file key: ${key}`);
      process.exit(1);
    }
    if (
      !key.startsWith('APP_TELEMETRY_RUNTIME_') ||
      (Object.prototype.hasOwnProperty.call(process.env, key) && process.env[key] !== '')
    ) {
      continue;
    }
    const value = parseEnvValue(rawValue);
    if (!isPlaceholderValue(value)) process.env[key] = value;
  }
}

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--env-file=')) {
    console.error('[telemetry-runtime-smoke] --env-file is reserved by Node/npm; use --release-env-file=<path>');
    process.exit(1);
  }
  if (arg.startsWith('--release-env-file=')) {
    const rawPath = arg.slice('--release-env-file='.length);
    if (!rawPath) {
      console.error('[telemetry-runtime-smoke] --release-env-file requires a path');
      process.exit(1);
    }
    loadReleaseEnvFile(rawPath);
  }
}

const options = {
  run: process.env.APP_TELEMETRY_RUNTIME_SMOKE_RUN === 'true',
  apiBaseUrl:
    process.env.APP_TELEMETRY_RUNTIME_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    defaultApiBaseUrl,
  timeoutMs: Number(process.env.APP_TELEMETRY_RUNTIME_TIMEOUT_MS || 30000),
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--run') {
    options.run = true;
  } else if (arg === '--dry-run') {
    options.run = false;
  } else if (arg.startsWith('--api-base-url=')) {
    options.apiBaseUrl = arg.slice('--api-base-url='.length);
  } else if (arg.startsWith('--timeout-ms=')) {
    options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else if (arg.startsWith('--release-env-file=')) {
    continue;
  } else {
    console.error(`[telemetry-runtime-smoke] unknown argument: ${arg}`);
    process.exit(1);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hashValue(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function isLocalHost(hostname) {
  const normalized = hostname.toLowerCase();
  return [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
  ].includes(normalized) || normalized.endsWith('.localhost');
}

function readResponseBody(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function sanitizeResponseBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
  return {
    success: body.success === true,
    data: {
      accepted_count: Number.isFinite(data.accepted_count) ? data.accepted_count : null,
      persisted_count: Number.isFinite(data.persisted_count) ? data.persisted_count : null,
      severities: data.severities && typeof data.severities === 'object' ? data.severities : null,
      partial_success:
        data.partial_success && typeof data.partial_success === 'object'
          ? {
              rejected_spans: Number.isFinite(data.partial_success.rejected_spans)
                ? data.partial_success.rejected_spans
                : null,
            }
          : null,
    },
  };
}

async function postJson(endpoint, payload, headers) {
  const startedAt = Date.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    duration_ms: Date.now() - startedAt,
    body: readResponseBody(text),
    body_text_tail: response.ok ? '' : text.slice(-1000),
  };
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-Telemetry-Runtime-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function buildTracePayload(app, traceId, spanId, nowNs, endNs) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'cj-mobile' } },
            { key: 'service.version', value: { stringValue: app.version ?? '0.0.0' } },
            { key: 'app.version', value: { stringValue: app.version ?? '0.0.0' } },
            { key: 'app.build_number', value: { stringValue: app.ios?.buildNumber ?? 'dev' } },
            { key: 'app.platform', value: { stringValue: 'ios' } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: 'cj.mobile.app' },
            spans: [
              {
                traceId,
                spanId,
                name: 'release.telemetry.runtime_smoke',
                startTimeUnixNano: nowNs,
                endTimeUnixNano: endNs,
                attributes: [
                  { key: 'route', value: { stringValue: '/notifications' } },
                  { key: 'runtimeSmoke', value: { boolValue: true } },
                  { key: 'source', value: { stringValue: 'app_release_telemetry_runtime_smoke' } },
                ],
                status: { code: 1 },
              },
            ],
          },
        ],
      },
    ],
  };
}

function buildBaseEvidence(app, startedAt, normalizedApiBaseUrl) {
  const apiUrl = new URL(normalizedApiBaseUrl);
  return {
    type: 'app-telemetry-runtime-evidence',
    provider: 'backend',
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    working_directory: mobileRoot,
    node_version: process.version,
    app_android_package: app.android?.package,
    app_ios_bundle_identifier: app.ios?.bundleIdentifier,
    app_version: app.version,
    app_build_number: app.ios?.buildNumber,
    app_version_code: String(app.android?.versionCode ?? ''),
    api: {
      protocol: apiUrl.protocol.replace(':', ''),
      host_sha256: hashValue(apiUrl.host),
      base_path: apiUrl.pathname,
      non_local: !isLocalHost(apiUrl.hostname),
      raw_url_redacted: true,
    },
  };
}

function printDryRun(app, normalizedApiBaseUrl) {
  const apiUrl = new URL(normalizedApiBaseUrl);
  console.log('[telemetry-runtime-smoke] dry-run');
  console.log('- Requires --run or APP_TELEMETRY_RUNTIME_SMOKE_RUN=true before posting telemetry events.');
  console.log('- Requires APP_TELEMETRY_RUNTIME_API_BASE_URL, --api-base-url=<release-api-base-url>, or --release-env-file=release.env.local for release evidence.');
  console.log('- Release evidence must target a non-local API host; localhost is accepted only as dry-run planning context.');
  console.log(`- API protocol/path: ${apiUrl.protocol.replace(':', '')} ${apiUrl.pathname}`);
  console.log(`- API host sha256: ${hashValue(apiUrl.host)}`);
  console.log(`- App: ${app.ios?.bundleIdentifier} / ${app.android?.package} ${app.version}`);
  console.log('- Evidence stores request ids, trace ids, span ids, and host as SHA-256 hashes only.');
}

async function run() {
  const startedAt = new Date().toISOString();
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  const normalizedApiBaseUrl = normalizeBaseUrl(options.apiBaseUrl);

  if (!options.run) {
    printDryRun(app, normalizedApiBaseUrl);
    return null;
  }

  const base = buildBaseEvidence(app, startedAt, normalizedApiBaseUrl);
  const apiUrl = new URL(normalizedApiBaseUrl);
  if (isLocalHost(apiUrl.hostname)) {
    return {
      ...base,
      summary: {
        run_mode: 'run',
        api_non_local: false,
        event_ingest_passed: false,
        otlp_ingest_passed: false,
        event_accepted_count: 0,
        otlp_accepted_spans: 0,
        safe_payload: true,
        blocked: true,
        failure: 'Release telemetry runtime evidence must target a non-local API host.',
      },
    };
  }

  const requestId = `app-telemetry-smoke-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  const sessionId = `app-telemetry-smoke-session-${randomBytes(8).toString('hex')}`;
  const traceId = randomBytes(16).toString('hex');
  const spanId = randomBytes(8).toString('hex');
  const nowNs = String(BigInt(Date.now()) * 1_000_000n);
  const endNs = String(BigInt(Date.now() + 25) * 1_000_000n);
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'cj-app-telemetry-runtime-smoke/1.0',
    'X-Request-Id': requestId,
    'X-Locale': 'zh-TW',
    'X-Session-Id': sessionId,
  };

  const eventPayload = {
    events: [
      {
        name: 'release.telemetry.runtime_smoke',
        severity: 'info',
        route: '/notifications',
        request_id: requestId,
        app_version: app.version,
        platform: 'ios',
        build_number: app.ios?.buildNumber ?? 'dev',
        context: {
          runtimeSmoke: true,
          source: 'app_release_telemetry_runtime_smoke',
          safePayload: true,
          token_probe: 'must_be_redacted_by_backend',
        },
      },
    ],
  };
  const otlpPayload = buildTracePayload(app, traceId, spanId, nowNs, endNs);
  const eventResponse = await postJson(`${normalizedApiBaseUrl}/telemetry/events`, eventPayload, headers);
  const otlpResponse = await postJson(`${normalizedApiBaseUrl}/telemetry/otlp/v1/traces`, otlpPayload, {
    ...headers,
    'X-Request-Id': `${requestId}-otlp`,
  });
  const eventAcceptedCount = Number(eventResponse.body?.data?.accepted_count ?? 0);
  const otlpAcceptedSpans = Number(otlpResponse.body?.data?.accepted_count ?? 0);
  const eventPassed = eventResponse.ok && eventAcceptedCount >= 1;
  const otlpPassed = otlpResponse.ok && otlpAcceptedSpans >= 1;

  return {
    ...base,
    request: {
      request_id_sha256: hashValue(requestId),
      session_id_sha256: hashValue(sessionId),
      locale: 'zh-TW',
      authorization_present: false,
    },
    event: {
      name: 'release.telemetry.runtime_smoke',
      request_id_sha256: hashValue(requestId),
      response_status: eventResponse.status,
      response_ok: eventResponse.ok,
      duration_ms: eventResponse.duration_ms,
      response: sanitizeResponseBody(eventResponse.body),
      body_text_tail: eventResponse.body_text_tail,
    },
    otlp: {
      trace_id_sha256: hashValue(traceId),
      span_id_sha256: hashValue(spanId),
      response_status: otlpResponse.status,
      response_ok: otlpResponse.ok,
      duration_ms: otlpResponse.duration_ms,
      response: sanitizeResponseBody(otlpResponse.body),
      body_text_tail: otlpResponse.body_text_tail,
    },
    summary: {
      run_mode: 'run',
      api_non_local: true,
      event_ingest_passed: eventPassed,
      otlp_ingest_passed: otlpPassed,
      event_accepted_count: eventAcceptedCount,
      otlp_accepted_spans: otlpAcceptedSpans,
      safe_payload: true,
      blocked: !(eventPassed && otlpPassed),
    },
  };
}

try {
  const evidence = await run();
  if (!evidence) process.exit(0);

  const evidencePath = writeEvidence(evidence);
  console.log(`[telemetry-runtime-smoke] evidence written: ${evidencePath}`);
  if (evidence.summary.blocked) {
    console.error('[telemetry-runtime-smoke] failed: telemetry events and OTLP traces did not both reach accepted runtime ingest.');
    process.exit(1);
  }
  console.log('[telemetry-runtime-smoke] ok: telemetry event and OTLP runtime ingest accepted by non-local backend.');
} catch (error) {
  console.error(`[telemetry-runtime-smoke] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
