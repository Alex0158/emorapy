import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const releaseNativeCrashEnvironment = 'production';

const options = {
  run: process.env.APP_NATIVE_CRASH_RUNTIME_SMOKE_RUN === 'true',
  sentryBaseUrl: process.env.APP_SENTRY_BASE_URL || 'https://sentry.io',
  sentryOrg: process.env.APP_SENTRY_ORG || process.env.SENTRY_ORG || null,
  sentryProject: process.env.APP_SENTRY_PROJECT || process.env.SENTRY_PROJECT || null,
  sentryAuthToken: process.env.APP_SENTRY_AUTH_TOKEN || process.env.SENTRY_AUTH_TOKEN || null,
  sentryEventId: process.env.APP_NATIVE_CRASH_SENTRY_EVENT_ID || process.env.SENTRY_EVENT_ID || null,
  expectedRelease: process.env.APP_NATIVE_CRASH_EXPECTED_RELEASE || null,
  expectedEnvironment: process.env.APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT || process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || process.env.APP_ENV || null,
  timeoutMs: Number(process.env.APP_NATIVE_CRASH_RUNTIME_TIMEOUT_MS || 30000),
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--run') {
    options.run = true;
  } else if (arg === '--dry-run') {
    options.run = false;
  } else if (arg.startsWith('--sentry-base-url=')) {
    options.sentryBaseUrl = arg.slice('--sentry-base-url='.length);
  } else if (arg.startsWith('--sentry-org=')) {
    options.sentryOrg = arg.slice('--sentry-org='.length);
  } else if (arg.startsWith('--sentry-project=')) {
    options.sentryProject = arg.slice('--sentry-project='.length);
  } else if (arg.startsWith('--sentry-auth-token=')) {
    options.sentryAuthToken = arg.slice('--sentry-auth-token='.length);
  } else if (arg.startsWith('--sentry-event-id=')) {
    options.sentryEventId = arg.slice('--sentry-event-id='.length);
  } else if (arg.startsWith('--expected-release=')) {
    options.expectedRelease = arg.slice('--expected-release='.length);
  } else if (arg.startsWith('--expected-environment=')) {
    options.expectedEnvironment = arg.slice('--expected-environment='.length);
  } else if (arg.startsWith('--timeout-ms=')) {
    options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else {
    console.error(`[native-crash-runtime-smoke] unknown argument: ${arg}`);
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

function readRecord(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function readArray(input) {
  return Array.isArray(input) ? input : [];
}

function readString(input) {
  return typeof input === 'string' && input.trim() ? input.trim() : null;
}

function redactSensitive(input) {
  return String(input || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .replace(/SENTRY_AUTH_TOKEN=[^\s]+/g, 'SENTRY_AUTH_TOKEN=[redacted]');
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-Native-Crash-Runtime-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function buildRelease(app) {
  const appVersion = app.version || '0.0.0';
  const buildNumber = app.ios?.buildNumber || (typeof app.android?.versionCode === 'number' ? String(app.android.versionCode) : 'dev');
  return `emorapy-mobile@${appVersion}+${buildNumber}`;
}

function buildBaseEvidence(app, startedAt) {
  return {
    type: 'app-native-crash-runtime-evidence',
    provider: 'sentry',
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    working_directory: mobileRoot,
    node_version: process.version,
    app_android_package: app.android?.package,
    app_ios_bundle_identifier: app.ios?.bundleIdentifier,
    expected: {
      release: options.expectedRelease || buildRelease(app),
      environment: options.expectedEnvironment || releaseNativeCrashEnvironment,
    },
    sentry: {
      base_host: new URL(options.sentryBaseUrl).host,
      org_slug_present: Boolean(options.sentryOrg),
      project_slug_present: Boolean(options.sentryProject),
      auth_token_present: Boolean(options.sentryAuthToken),
      event_id_sha256: options.sentryEventId ? hashValue(options.sentryEventId) : null,
    },
  };
}

function printDryRun(app) {
  console.log('[native-crash-runtime-smoke] dry-run');
  console.log('- Requires --run or APP_NATIVE_CRASH_RUNTIME_SMOKE_RUN=true before querying Sentry.');
  console.log('- Requires APP_SENTRY_ORG / SENTRY_ORG, APP_SENTRY_PROJECT / SENTRY_PROJECT, APP_SENTRY_AUTH_TOKEN / SENTRY_AUTH_TOKEN.');
  console.log('- Requires APP_NATIVE_CRASH_SENTRY_EVENT_ID / SENTRY_EVENT_ID from a controlled native runtime crash event.');
  console.log(`- Expected release: ${options.expectedRelease || buildRelease(app)}`);
  console.log(`- Expected environment: ${options.expectedEnvironment || releaseNativeCrashEnvironment}`);
  console.log('- Evidence stores event id hash and release/environment summary only; it never stores Sentry auth token.');
}

function extractTagValue(event, tagName) {
  const tags = event.tags;
  if (Array.isArray(tags)) {
    const entry = tags.find((tag) => {
      if (Array.isArray(tag)) return tag[0] === tagName;
      return readRecord(tag).key === tagName || readRecord(tag).name === tagName;
    });
    if (Array.isArray(entry)) return readString(entry[1]);
    if (entry) return readString(readRecord(entry).value);
  }
  const tagRecord = readRecord(tags);
  return readString(tagRecord[tagName]);
}

function extractPlatform(event) {
  return readString(event.platform)
    || extractTagValue(event, 'platform')
    || extractTagValue(event, 'sdk.name')
    || null;
}

function extractRelease(event) {
  return readString(event.release)
    || extractTagValue(event, 'release')
    || readString(readRecord(readRecord(event.contexts).app).release)
    || null;
}

function extractEnvironment(event) {
  return readString(event.environment)
    || extractTagValue(event, 'environment')
    || null;
}

function extractCrashSignal(event) {
  const type = readString(event.type);
  const entries = readArray(event.entries);
  const hasException =
    entries.some((entry) => readRecord(entry).type === 'exception') ||
    readArray(readRecord(event.exception).values).length > 0;
  const level = readString(event.level);
  return {
    type,
    level,
    has_exception: hasException,
    is_crash_like: hasException || level === 'fatal' || type === 'error',
  };
}

function extractSdkName(event) {
  const sdk = readRecord(event.sdk);
  return readString(sdk.name)
    || readString(sdk.package)
    || extractTagValue(event, 'sdk.name')
    || null;
}

function extractExceptionMechanisms(event) {
  const directValues = readArray(readRecord(event.exception).values);
  const entryValues = readArray(event.entries).flatMap((entry) => {
    const entryRecord = readRecord(entry);
    if (entryRecord.type !== 'exception') return [];
    return readArray(readRecord(entryRecord.data).values);
  });
  return [...directValues, ...entryValues]
    .map((value) => {
      const mechanism = readRecord(readRecord(value).mechanism);
      return readString(mechanism.type);
    })
    .filter(Boolean);
}

function extractNativeRuntimeSignal(event) {
  const platform = extractPlatform(event);
  const sdkName = extractSdkName(event);
  const mechanisms = extractExceptionMechanisms(event);
  const platformLower = String(platform || '').toLowerCase();
  const sdkLower = String(sdkName || '').toLowerCase();
  const nativeMechanism = mechanisms.some((type) => {
    const value = String(type || '').toLowerCase();
    return ['mach', 'signal', 'crashpad', 'minidump', 'objc', 'swift', 'anr', 'ndk', 'native', 'jvm', 'java']
      .some((fragment) => value.includes(fragment));
  });

  return {
    platform,
    sdk_name: sdkName,
    exception_mechanisms: mechanisms,
    observed:
      ['ios', 'android', 'cocoa', 'native', 'java'].includes(platformLower) ||
      /sentry\.(cocoa|java|android|native)/.test(sdkLower) ||
      nativeMechanism,
  };
}

async function fetchSentryEvent(app) {
  const org = encodeURIComponent(options.sentryOrg);
  const project = encodeURIComponent(options.sentryProject);
  const eventId = encodeURIComponent(options.sentryEventId);
  const url = `${options.sentryBaseUrl.replace(/\/$/, '')}/api/0/projects/${org}/${project}/events/${eventId}/`;
  const startedAt = Date.now();
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${options.sentryAuthToken}`,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    duration_ms: Date.now() - startedAt,
    body,
    body_text_tail: response.ok ? '' : redactSensitive(text).slice(-1000),
    expected_release: options.expectedRelease || buildRelease(app),
    expected_environment: options.expectedEnvironment || releaseNativeCrashEnvironment,
  };
}

function missingRunRequirements() {
  const missing = [];
  if (!options.sentryOrg) missing.push('APP_SENTRY_ORG or SENTRY_ORG');
  if (!options.sentryProject) missing.push('APP_SENTRY_PROJECT or SENTRY_PROJECT');
  if (!options.sentryAuthToken) missing.push('APP_SENTRY_AUTH_TOKEN or SENTRY_AUTH_TOKEN');
  if (!options.sentryEventId) missing.push('APP_NATIVE_CRASH_SENTRY_EVENT_ID or SENTRY_EVENT_ID');
  return missing;
}

async function run() {
  const startedAt = new Date().toISOString();
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};

  if (!options.run) {
    printDryRun(app);
    return null;
  }

  const base = buildBaseEvidence(app, startedAt);
  const missing = missingRunRequirements();
  if (missing.length > 0) {
    return {
      ...base,
      summary: {
        run_mode: 'run',
        provider_query_passed: false,
        event_found: false,
        release_matches: false,
        environment_matches: false,
        native_runtime_observed: false,
        crash_event_observed: false,
        blocked: true,
        failure: `Missing required input: ${missing.join(', ')}`,
      },
    };
  }

  const response = await fetchSentryEvent(app);
  const event = readRecord(response.body);
  const release = extractRelease(event);
  const environment = extractEnvironment(event);
  const nativeRuntime = extractNativeRuntimeSignal(event);
  const crashSignal = extractCrashSignal(event);
  const eventFound = response.ok && Boolean(readString(event.eventID) || readString(event.id) || readString(event.event_id));
  const expectedRelease = response.expected_release;
  const expectedEnvironment = response.expected_environment;
  const releaseMatches = release === expectedRelease;
  const environmentMatches = environment === expectedEnvironment;
  const nativeRuntimeObserved = nativeRuntime.observed;
  const crashEventObserved = crashSignal.is_crash_like;

  return {
    ...base,
    summary: {
      run_mode: 'run',
      provider_query_passed: response.ok,
      event_found: eventFound,
      release_matches: releaseMatches,
      environment_matches: environmentMatches,
      native_runtime_observed: nativeRuntimeObserved,
      crash_event_observed: crashEventObserved,
      blocked: !(response.ok && eventFound && releaseMatches && environmentMatches && nativeRuntimeObserved && crashEventObserved),
    },
    provider_query: {
      status: response.status,
      ok: response.ok,
      duration_ms: response.duration_ms,
      body_text_tail: response.body_text_tail,
    },
    event: {
      id_sha256: options.sentryEventId ? hashValue(options.sentryEventId) : null,
      release,
      environment,
      platform: nativeRuntime.platform,
      sdk_name: nativeRuntime.sdk_name,
      exception_mechanisms: nativeRuntime.exception_mechanisms,
      level: crashSignal.level,
      type: crashSignal.type,
      has_exception: crashSignal.has_exception,
    },
  };
}

try {
  const evidence = await run();
  if (!evidence) process.exit(0);

  const evidencePath = writeEvidence(evidence);
  console.log(`[native-crash-runtime-smoke] evidence written: ${evidencePath}`);
  if (evidence.summary.blocked) {
    console.error('[native-crash-runtime-smoke] failed: native crash runtime evidence did not pass.');
    process.exit(1);
  }
  console.log('[native-crash-runtime-smoke] ok: Sentry event proves native crash runtime capture');
} catch (error) {
  const startedAt = new Date().toISOString();
  const app = fs.existsSync(path.join(mobileRoot, 'app.json'))
    ? readJson(path.join(mobileRoot, 'app.json')).expo ?? {}
    : {};
  const evidence = {
    ...buildBaseEvidence(app, startedAt),
    summary: {
      run_mode: options.run ? 'run' : 'dry-run',
      provider_query_passed: false,
      event_found: false,
      release_matches: false,
      environment_matches: false,
      native_runtime_observed: false,
      crash_event_observed: false,
      blocked: true,
      failure: redactSensitive(error instanceof Error ? error.message : String(error)),
    },
  };
  const evidencePath = writeEvidence(evidence);
  console.error(`[native-crash-runtime-smoke] evidence written: ${evidencePath}`);
  console.error(`[native-crash-runtime-smoke] failed: ${evidence.summary.failure}`);
  process.exit(1);
}
