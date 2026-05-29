import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getExpoProjectIdStatus } from './lib/release-app-config.mjs';
import { parseAdbDeviceRows, parseXctraceListDevices } from './lib/release-device-discovery.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const evidenceDir = path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證');
const prerequisiteDocs = {
  runbook: 'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-External-Release-Signoff-Runbook-2026-05-08.md',
  releaseHardening: 'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md',
  testBaseline: 'docs/核心開發文件/08-測試規範與驗收/03-App測試與證據接入基線.md',
};

const knownStepIds = new Set([
  'eas_ios_testflight',
  'eas_android',
  'physical_device',
  'push_delivery',
  'native_crash_runtime',
  'telemetry_runtime',
  'release_db_parity',
  'release_completion_audit',
  'goal_completion_audit',
]);

const allowedReleaseEnvFileKeys = new Set([
  'DEVELOPER_DIR',
  'ANDROID_HOME',
  'ANDROID_SDK_ROOT',
  'APP_RELEASE_EXTERNAL_SIGNOFF_RUN',
  'APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR',
  'APP_PHYSICAL_DEVICE_PLATFORM',
  'APP_EAS_IOS_REQUIRE_TESTFLIGHT',
  'APP_EAS_IOS_RELEASE_SMOKE_RUN',
  'APP_EAS_IOS_BUILD_ID',
  'APP_EAS_IOS_SKIP_ARTIFACT_HEAD',
  'APP_EAS_IOS_RELEASE_TIMEOUT_MS',
  'APP_EAS_ANDROID_RELEASE_SMOKE_RUN',
  'APP_EAS_ANDROID_BUILD_ID',
  'APP_EAS_ANDROID_SKIP_ARTIFACT_HEAD',
  'APP_EAS_ANDROID_RELEASE_TIMEOUT_MS',
  'EXPO_TOKEN',
  'ASC_APPLE_ID',
  'EXPO_APPLE_APP_SPECIFIC_PASSWORD',
  'APP_STORE_CONNECT_ISSUER_ID',
  'ASC_ISSUER_ID',
  'APP_STORE_CONNECT_KEY_ID',
  'ASC_KEY_ID',
  'APP_STORE_CONNECT_PRIVATE_KEY',
  'ASC_PRIVATE_KEY',
  'APP_STORE_CONNECT_PRIVATE_KEY_PATH',
  'ASC_PRIVATE_KEY_PATH',
  'APP_STORE_CONNECT_APP_ID',
  'ASC_APP_ID',
  'APP_PHYSICAL_DEVICE_ID',
  'APP_IOS_DEVICE_UDID',
  'APP_IOS_DEVICE_APP_PATH',
  'APP_ANDROID_DEVICE_SERIAL',
  'APP_PUSH_DELIVERY_SMOKE_RUN',
  'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN',
  'APP_PUSH_DELIVERY_ACCESS_TOKEN',
  'EXPO_PUSH_ACCESS_TOKEN',
  'APP_PUSH_DELIVERY_SEND_ENDPOINT',
  'APP_PUSH_DELIVERY_RECEIPTS_ENDPOINT',
  'APP_PUSH_DELIVERY_RECEIPT_ATTEMPTS',
  'APP_PUSH_DELIVERY_RECEIPT_INTERVAL_MS',
  'APP_PUSH_DELIVERY_TIMEOUT_MS',
  'APP_NATIVE_CRASH_RUNTIME_SMOKE_RUN',
  'APP_SENTRY_BASE_URL',
  'APP_SENTRY_ORG',
  'SENTRY_ORG',
  'APP_SENTRY_PROJECT',
  'SENTRY_PROJECT',
  'APP_SENTRY_AUTH_TOKEN',
  'SENTRY_AUTH_TOKEN',
  'APP_NATIVE_CRASH_SENTRY_EVENT_ID',
  'SENTRY_EVENT_ID',
  'APP_NATIVE_CRASH_EXPECTED_RELEASE',
  'APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT',
  'EXPO_PUBLIC_SENTRY_ENVIRONMENT',
  'APP_ENV',
  'APP_NATIVE_CRASH_RUNTIME_TIMEOUT_MS',
  'APP_TELEMETRY_RUNTIME_SMOKE_RUN',
  'APP_TELEMETRY_RUNTIME_API_BASE_URL',
  'APP_TELEMETRY_RUNTIME_TIMEOUT_MS',
  'DATABASE_URL',
]);

function printUsageAndExit(message) {
  if (message) console.error(`[release-external-signoff] ${message}`);
  console.error('usage: npm --prefix mobile run release:external-evidence:signoff -- [--release-env-file=<path>] [--dry-run|--run] [--validate-only] [--continue-on-error] [--skip=<step>] [--physical-platform=ios|android] [--no-testflight] [--report-dir=<path>]');
  console.error(`known steps: ${Array.from(knownStepIds).join(', ')}`);
  process.exit(1);
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

const loadedEnvFiles = [];

function loadEnvFile(rawPath) {
  const resolvedPath = resolveExistingFilePath(rawPath);
  if (!resolvedPath) {
    printUsageAndExit(`--release-env-file path does not exist: ${rawPath}`);
  }
  const text = fs.readFileSync(resolvedPath, 'utf8');
  const loadedKeys = [];
  const keptExistingKeys = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(normalized);
    if (!match) {
      printUsageAndExit(`invalid --release-env-file line ${index + 1}; expected KEY=value without shell expansion`);
    }
    const [, key, rawValue] = match;
    if (!allowedReleaseEnvFileKeys.has(key)) {
      printUsageAndExit(`unsupported --release-env-file key: ${key}`);
    }
    if (Object.prototype.hasOwnProperty.call(process.env, key) && process.env[key] !== '') {
      keptExistingKeys.push(key);
      continue;
    }
    process.env[key] = parseEnvValue(rawValue);
    loadedKeys.push(key);
  }
  loadedEnvFiles.push({
    filePath: resolvedPath,
    loadedKeys: loadedKeys.length,
    keptExistingKeys: keptExistingKeys.length,
  });
}

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--env-file=')) {
    printUsageAndExit('--env-file is reserved by Node/npm; use --release-env-file=<path>');
  }
  if (arg.startsWith('--release-env-file=')) {
    const rawPath = arg.slice('--release-env-file='.length);
    if (!rawPath) printUsageAndExit('--release-env-file requires a path');
    loadEnvFile(rawPath);
  }
}

const options = {
  run: process.env.APP_RELEASE_EXTERNAL_SIGNOFF_RUN === 'true',
  continueOnError: false,
  requireTestflight: process.env.APP_EAS_IOS_REQUIRE_TESTFLIGHT !== 'false',
  physicalPlatform: process.env.APP_PHYSICAL_DEVICE_PLATFORM || 'ios',
  validateOnly: false,
  reportDir: process.env.APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR || null,
  skip: new Set(),
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--run') {
    options.run = true;
  } else if (arg === '--dry-run') {
    options.run = false;
  } else if (arg === '--validate-only') {
    options.run = true;
    options.validateOnly = true;
  } else if (arg === '--continue-on-error') {
    options.continueOnError = true;
  } else if (arg === '--no-testflight') {
    options.requireTestflight = false;
  } else if (arg.startsWith('--physical-platform=')) {
    options.physicalPlatform = arg.slice('--physical-platform='.length);
  } else if (arg.startsWith('--report-dir=')) {
    options.reportDir = path.resolve(process.cwd(), arg.slice('--report-dir='.length));
  } else if (arg.startsWith('--env-file=')) {
    printUsageAndExit('--env-file is reserved by Node/npm; use --release-env-file=<path>');
  } else if (arg.startsWith('--release-env-file=')) {
    // Loaded in a first pass before environment-derived defaults are read.
  } else if (arg.startsWith('--skip=')) {
    const stepId = arg.slice('--skip='.length);
    if (!knownStepIds.has(stepId)) printUsageAndExit(`unknown step for --skip: ${stepId}`);
    options.skip.add(stepId);
  } else {
    printUsageAndExit(`unknown argument: ${arg}`);
  }
}

if (!['ios', 'android'].includes(options.physicalPlatform)) {
  printUsageAndExit('--physical-platform must be ios or android');
}
if (options.run && !options.validateOnly && options.skip.size > 0) {
  printUsageAndExit(
    '--skip is only allowed for dry-run or validate-only; release:external-evidence:run must execute every evidence step and strict audit.'
  );
}

function redactSensitive(input) {
  return String(input || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .replace(/EXPO_TOKEN=[^\s]+/g, 'EXPO_TOKEN=[redacted]')
    .replace(/APP_STORE_CONNECT_PRIVATE_KEY=[^\s]+/g, 'APP_STORE_CONNECT_PRIVATE_KEY=[redacted]')
    .replace(/ASC_PRIVATE_KEY=[^\s]+/g, 'ASC_PRIVATE_KEY=[redacted]')
    .replace(/APP_SENTRY_AUTH_TOKEN=[^\s]+/g, 'APP_SENTRY_AUTH_TOKEN=[redacted]')
    .replace(/SENTRY_AUTH_TOKEN=[^\s]+/g, 'SENTRY_AUTH_TOKEN=[redacted]')
    .replace(/APP_TELEMETRY_RUNTIME_API_BASE_URL=[^\s]+/g, 'APP_TELEMETRY_RUNTIME_API_BASE_URL=[redacted]')
    .replace(/DATABASE_URL=[^\s]+/g, 'DATABASE_URL=[redacted]')
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/g, 'postgresql://[redacted]')
    .replace(/\b(?:Expo|Exponent)PushToken\[[^\]]+\]/g, '[push-token]')
    .replace(/https:\/\/[^"'`\s]+/g, '[redacted-url]');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hasEnv(name) {
  return !isPlaceholderValue(process.env[name]);
}

function hasAnyEnv(names) {
  return names.some((name) => hasEnv(name));
}

function hasAppleSubmissionCredentials() {
  return hasEnv('ASC_APPLE_ID') && hasEnv('EXPO_APPLE_APP_SPECIFIC_PASSWORD');
}

function hasAppStoreConnectApiCredentials() {
  return (
    hasAnyEnv(['APP_STORE_CONNECT_ISSUER_ID', 'ASC_ISSUER_ID']) &&
    hasAnyEnv(['APP_STORE_CONNECT_KEY_ID', 'ASC_KEY_ID']) &&
    hasAnyEnv([
      'APP_STORE_CONNECT_PRIVATE_KEY',
      'ASC_PRIVATE_KEY',
      'APP_STORE_CONNECT_PRIVATE_KEY_PATH',
      'ASC_PRIVATE_KEY_PATH',
    ])
  );
}

function hasPhysicalDeviceInput() {
  return options.physicalPlatform === 'ios'
    ? hasAnyEnv(['APP_PHYSICAL_DEVICE_ID', 'APP_IOS_DEVICE_UDID'])
    : hasAnyEnv(['APP_PHYSICAL_DEVICE_ID', 'APP_ANDROID_DEVICE_SERIAL']);
}

function hasSignedAppInput() {
  return options.physicalPlatform === 'ios' ? hasEnv('APP_IOS_DEVICE_APP_PATH') : true;
}

function hasSentryRuntimeQueryCredentials() {
  return (
    hasAnyEnv(['APP_SENTRY_ORG', 'SENTRY_ORG']) &&
    hasAnyEnv(['APP_SENTRY_PROJECT', 'SENTRY_PROJECT']) &&
    hasAnyEnv(['APP_SENTRY_AUTH_TOKEN', 'SENTRY_AUTH_TOKEN'])
  );
}

const prerequisiteActionCatalog = {
  eas_project_id: {
    owner_surface: 'Expo / EAS project setup',
    required_env_keys: [],
    action: 'Bind mobile/app.json to the real Expo project id before external release sign-off.',
    commands: [
      'cd mobile && npx eas init',
      'npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook, prerequisiteDocs.releaseHardening],
  },
  expo_token: {
    owner_surface: 'Expo / EAS credentials',
    required_env_keys: ['EXPO_TOKEN'],
    action: 'Provide a non-interactive Expo access token for EAS release metadata checks.',
    commands: [
      'EXPO_TOKEN=<expo-access-token> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook, prerequisiteDocs.testBaseline],
  },
  apple_submission_credentials: {
    owner_surface: 'Apple submission credentials',
    required_env_keys: ['ASC_APPLE_ID', 'EXPO_APPLE_APP_SPECIFIC_PASSWORD'],
    action: 'Provide Apple account and app-specific password for non-interactive submit readiness.',
    commands: [
      'ASC_APPLE_ID=<apple-id> EXPO_APPLE_APP_SPECIFIC_PASSWORD=<app-specific-password> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  eas_cli: {
    owner_surface: 'Runner toolchain',
    required_env_keys: [],
    action: 'Install EAS CLI on PATH for the release runner.',
    commands: [
      'npm --prefix mobile exec eas -- --version',
      'npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook, prerequisiteDocs.releaseHardening],
  },
  asc_issuer_id: {
    owner_surface: 'App Store Connect API',
    required_env_keys: ['APP_STORE_CONNECT_ISSUER_ID or ASC_ISSUER_ID'],
    action: 'Provide the App Store Connect API issuer id for TestFlight evidence.',
    commands: [
      'APP_STORE_CONNECT_ISSUER_ID=<issuer-id> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  asc_key_id: {
    owner_surface: 'App Store Connect API',
    required_env_keys: ['APP_STORE_CONNECT_KEY_ID or ASC_KEY_ID'],
    action: 'Provide the App Store Connect API key id for TestFlight evidence.',
    commands: [
      'APP_STORE_CONNECT_KEY_ID=<key-id> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  asc_private_key: {
    owner_surface: 'App Store Connect API',
    required_env_keys: ['APP_STORE_CONNECT_PRIVATE_KEY or APP_STORE_CONNECT_PRIVATE_KEY_PATH'],
    action: 'Provide an App Store Connect API private key value or a path to the key file.',
    commands: [
      'APP_STORE_CONNECT_PRIVATE_KEY_PATH=<absolute-p8-path> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  app_store_connect_private_key_path: {
    owner_surface: 'App Store Connect API',
    required_env_keys: ['APP_STORE_CONNECT_PRIVATE_KEY_PATH'],
    action: 'Point APP_STORE_CONNECT_PRIVATE_KEY_PATH at an existing private key file on the release runner.',
    commands: [
      'APP_STORE_CONNECT_PRIVATE_KEY_PATH=<absolute-p8-path> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  asc_private_key_path: {
    owner_surface: 'App Store Connect API',
    required_env_keys: ['ASC_PRIVATE_KEY_PATH'],
    action: 'Point ASC_PRIVATE_KEY_PATH at an existing private key file on the release runner.',
    commands: [
      'ASC_PRIVATE_KEY_PATH=<absolute-p8-path> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  ios_physical_device_id: {
    owner_surface: 'Trusted iOS device runner',
    required_env_keys: ['APP_PHYSICAL_DEVICE_ID or APP_IOS_DEVICE_UDID'],
    action: 'Provide the trusted connected iOS physical device identifier.',
    commands: [
      'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun xctrace list devices',
      'APP_IOS_DEVICE_UDID=<trusted-device-udid> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=ios --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  ios_physical_device_discovery: {
    owner_surface: 'Trusted iOS device runner',
    required_env_keys: ['DEVELOPER_DIR'],
    action: 'Make the full Xcode developer tools available so the release runner can inspect trusted iOS devices before external sign-off starts.',
    commands: [
      'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun xctrace list devices',
      'npm --prefix mobile run release:external-evidence:validate -- --physical-platform=ios --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook, prerequisiteDocs.releaseHardening],
  },
  ios_physical_device_visible: {
    owner_surface: 'Trusted iOS device runner',
    required_env_keys: ['APP_PHYSICAL_DEVICE_ID or APP_IOS_DEVICE_UDID'],
    action: 'Connect, unlock, and trust the target iPhone before starting release sign-off run mode.',
    commands: [
      'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun xctrace list devices',
      'APP_IOS_DEVICE_UDID=<trusted-device-udid> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=ios --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  ios_physical_device_match: {
    owner_surface: 'Trusted iOS device runner',
    required_env_keys: ['APP_PHYSICAL_DEVICE_ID or APP_IOS_DEVICE_UDID'],
    action: 'Point the release runner at a connected, trusted iOS physical device rather than an offline or stale identifier.',
    commands: [
      'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun xctrace list devices',
      'APP_IOS_DEVICE_UDID=<connected-trusted-device-udid> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=ios --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  ios_signed_app_path: {
    owner_surface: 'Trusted iOS device runner',
    required_env_keys: ['APP_IOS_DEVICE_APP_PATH'],
    action: 'Provide an existing signed .app path for the iOS physical-device smoke.',
    commands: [
      'APP_IOS_DEVICE_APP_PATH=<signed-app-path> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=ios --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  android_physical_device_discovery: {
    owner_surface: 'Trusted Android device runner',
    required_env_keys: ['ANDROID_HOME or ANDROID_SDK_ROOT'],
    action: 'Make adb available so the release runner can inspect authorized Android physical devices before external sign-off starts.',
    commands: [
      'adb devices -l',
      'npm --prefix mobile run release:external-evidence:validate -- --physical-platform=android --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook, prerequisiteDocs.releaseHardening],
  },
  android_physical_device_id: {
    owner_surface: 'Trusted Android device runner',
    required_env_keys: ['APP_PHYSICAL_DEVICE_ID or APP_ANDROID_DEVICE_SERIAL'],
    action: 'Provide the authorized Android physical device serial.',
    commands: [
      'adb devices -l',
      'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=android --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  android_physical_device_visible: {
    owner_surface: 'Trusted Android device runner',
    required_env_keys: ['APP_PHYSICAL_DEVICE_ID or APP_ANDROID_DEVICE_SERIAL'],
    action: 'Connect and authorize a physical Android device before starting release sign-off run mode.',
    commands: [
      'adb devices -l',
      'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=android --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  android_physical_device_match: {
    owner_surface: 'Trusted Android device runner',
    required_env_keys: ['APP_PHYSICAL_DEVICE_ID or APP_ANDROID_DEVICE_SERIAL'],
    action: 'Point the release runner at an authorized connected Android physical device rather than an emulator, offline, or stale serial.',
    commands: [
      'adb devices -l',
      'APP_ANDROID_DEVICE_SERIAL=<authorized-physical-device-serial> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=android --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  push_delivery_token: {
    owner_surface: 'Expo push provider',
    required_env_keys: ['APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN'],
    action: 'Provide a real Expo push token from an installed release candidate app.',
    commands: [
      'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN=<expo-push-token> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook, prerequisiteDocs.testBaseline],
  },
  sentry_org: {
    owner_surface: 'Sentry native crash runtime',
    required_env_keys: ['APP_SENTRY_ORG or SENTRY_ORG'],
    action: 'Provide the Sentry organization slug used for native crash runtime evidence.',
    commands: [
      'APP_SENTRY_ORG=<sentry-org> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  sentry_project: {
    owner_surface: 'Sentry native crash runtime',
    required_env_keys: ['APP_SENTRY_PROJECT or SENTRY_PROJECT'],
    action: 'Provide the Sentry project slug used for native crash runtime evidence.',
    commands: [
      'APP_SENTRY_PROJECT=<sentry-project> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  sentry_auth_token: {
    owner_surface: 'Sentry native crash runtime',
    required_env_keys: ['APP_SENTRY_AUTH_TOKEN or SENTRY_AUTH_TOKEN'],
    action: 'Provide a Sentry auth token that can query the controlled native crash event.',
    commands: [
      'APP_SENTRY_AUTH_TOKEN=<sentry-auth-token> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  native_crash_event_id: {
    owner_surface: 'Sentry native crash runtime',
    required_env_keys: ['APP_NATIVE_CRASH_SENTRY_EVENT_ID or SENTRY_EVENT_ID'],
    action: 'Provide the controlled native crash event id to query during runtime evidence.',
    commands: [
      'APP_NATIVE_CRASH_SENTRY_EVENT_ID=<controlled-event-id> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    docs: [prerequisiteDocs.runbook],
  },
  telemetry_runtime_api_base_url: {
    owner_surface: 'Release App telemetry ingest',
    required_env_keys: ['APP_TELEMETRY_RUNTIME_API_BASE_URL'],
    action: 'Provide a non-local release API base URL so the telemetry runtime runner can post event and OTLP trace payloads.',
    commands: [
      'npm --prefix mobile run release:external-evidence:validate -- --release-env-file=release.env.local --report-dir=<report-dir>',
      'npm --prefix mobile run telemetry:runtime:smoke -- --run --release-env-file=release.env.local',
    ],
    docs: [prerequisiteDocs.runbook, prerequisiteDocs.releaseHardening, prerequisiteDocs.testBaseline],
  },
  release_database_url: {
    owner_surface: 'Release / production PostgreSQL',
    required_env_keys: ['DATABASE_URL'],
    action: 'Provide a non-local release or production PostgreSQL URL for DB parity evidence.',
    commands: [
      'DATABASE_URL=<release-or-production-postgres-url> npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
      'DATABASE_URL=<release-or-production-postgres-url> npm --prefix backend run ops:release-db:evidence',
    ],
    docs: [prerequisiteDocs.runbook, prerequisiteDocs.releaseHardening],
  },
};

function prerequisiteActionFor(id) {
  return prerequisiteActionCatalog[id] ?? {
    owner_surface: 'Release prerequisite owner',
    required_env_keys: [],
    action: 'Review the missing prerequisite message and update the release runner input before retrying validation.',
    commands: ['npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>'],
    docs: [prerequisiteDocs.runbook],
  };
}

function buildPrerequisiteResolutionHints(missingPrerequisites) {
  return missingPrerequisites.map((item) => ({
    id: item.id,
    message: item.message,
    ...prerequisiteActionFor(item.id),
  }));
}

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.error?.code !== 'ENOENT';
}

function commandResult(command, args = [], extra = {}) {
  const result = spawnSync(command, args, {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...extra,
  });
  return {
    status: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error_code: result.error?.code ?? null,
  };
}

function firstExistingPath(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

function requestedIosDeviceId() {
  return process.env.APP_IOS_DEVICE_UDID || (options.physicalPlatform === 'ios' ? process.env.APP_PHYSICAL_DEVICE_ID : null) || null;
}

function requestedAndroidDeviceId() {
  return process.env.APP_ANDROID_DEVICE_SERIAL || (options.physicalPlatform === 'android' ? process.env.APP_PHYSICAL_DEVICE_ID : null) || null;
}

function inspectIosDeviceVisibility() {
  const env = {
    ...process.env,
    DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
  };
  const result = commandResult('xcrun', ['xctrace', 'list', 'devices'], { env });
  if (result.status !== 0) {
    return {
      ok: false,
      physical_connected: 0,
      physical_offline: 0,
      simulators: 0,
      requested_device_provided: Boolean(requestedIosDeviceId()),
      requested_device_visible: false,
    };
  }

  const devices = parseXctraceListDevices(result.stdout);
  const requested = requestedIosDeviceId();
  const connected = devices.filter((device) => device.isPhysical && device.isAvailable);
  return {
    ok: true,
    physical_connected: connected.length,
    physical_offline: devices.filter((device) => device.isPhysical && device.section === 'devices_offline').length,
    simulators: devices.filter((device) => device.isSimulator).length,
    requested_device_provided: Boolean(requested),
    requested_device_visible: requested ? connected.some((device) => device.identifier === requested) : null,
  };
}

function resolveAndroidAdbPath() {
  const sdkRoot = firstExistingPath([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  ]);
  const sdkAdb = sdkRoot ? path.join(sdkRoot, 'platform-tools', 'adb') : null;
  return firstExistingPath([sdkAdb]) || 'adb';
}

function inspectAndroidDeviceVisibility() {
  const adb = resolveAndroidAdbPath();
  const result = commandResult(adb, ['devices', '-l']);
  if (result.status !== 0) {
    return {
      ok: false,
      physical_connected: 0,
      emulator_connected: 0,
      unauthorized_or_offline: 0,
      requested_device_provided: Boolean(requestedAndroidDeviceId()),
      requested_device_visible: false,
    };
  }

  const devices = parseAdbDeviceRows(result.stdout);
  const requested = requestedAndroidDeviceId();
  const connectedPhysical = devices.filter((device) => device.state === 'device' && !device.isEmulator);
  return {
    ok: true,
    physical_connected: connectedPhysical.length,
    emulator_connected: devices.filter((device) => device.state === 'device' && device.isEmulator).length,
    unauthorized_or_offline: devices.filter((device) => device.state !== 'device').length,
    requested_device_provided: Boolean(requested),
    requested_device_visible: requested ? connectedPhysical.some((device) => device.serial === requested) : null,
  };
}

function buildDeviceVisibilityReport() {
  return {
    ios: inspectIosDeviceVisibility(),
    android: inspectAndroidDeviceVisibility(),
  };
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeReport(record) {
  if (!options.reportDir) return null;
  fs.mkdirSync(options.reportDir, { recursive: true });
  const filePath = path.join(options.reportDir, `App-External-Signoff-Prerequisites-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function displayEnvFilePath(filePath) {
  const relative = path.relative(repoRoot, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : path.basename(filePath);
}

function buildPrerequisiteReport(missingPrerequisites) {
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  const easProjectId = getExpoProjectIdStatus(app);
  const deviceVisibility = buildDeviceVisibilityReport();
  return {
    type: 'app-external-signoff-prerequisites',
    generated_at: new Date().toISOString(),
    mode: options.validateOnly ? 'validate' : options.run ? 'run' : 'dry-run',
    ok: missingPrerequisites.length === 0,
    summary: {
      blocked: missingPrerequisites.length > 0,
      missing_count: missingPrerequisites.length,
      require_testflight: options.requireTestflight,
      physical_platform: options.physicalPlatform,
      skipped_steps: Array.from(options.skip).sort(),
      report_contains_secrets: false,
    },
    app: {
      ios_bundle_identifier: app.ios?.bundleIdentifier ?? null,
      android_package: app.android?.package ?? null,
      version: app.version ?? null,
      ios_build_number: app.ios?.buildNumber ?? null,
      android_version_code: app.android?.versionCode ?? null,
      eas_project_id_present: easProjectId.present,
      eas_project_id_valid: easProjectId.valid,
    },
    tools: {
      eas_cli_available: commandAvailable('eas'),
    },
    credentials: {
      expo_token_present: hasEnv('EXPO_TOKEN'),
      apple_submission_credentials_present: hasAppleSubmissionCredentials(),
      app_store_connect_api_credentials_present: hasAppStoreConnectApiCredentials(),
      physical_device_input_present: hasPhysicalDeviceInput(),
      signed_app_input_present: hasSignedAppInput(),
      push_delivery_token_present: hasEnv('APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN'),
      sentry_runtime_query_credentials_present: hasSentryRuntimeQueryCredentials(),
      native_crash_event_id_present: hasAnyEnv(['APP_NATIVE_CRASH_SENTRY_EVENT_ID', 'SENTRY_EVENT_ID']),
      telemetry_runtime_api_base_url_present: hasEnv('APP_TELEMETRY_RUNTIME_API_BASE_URL'),
      release_database_url_present: hasEnv('DATABASE_URL'),
    },
    device_visibility: deviceVisibility,
    missing_prerequisites: missingPrerequisites,
    resolution_hints: buildPrerequisiteResolutionHints(missingPrerequisites),
  };
}

function validateRunPrerequisites() {
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  const easProjectId = getExpoProjectIdStatus(app);
  const missing = [];
  const add = (id, message) => {
    missing.push({ id, message });
  };
  const active = (stepId) => !options.skip.has(stepId);

  if (!easProjectId.valid) {
    add('eas_project_id', 'mobile/app.json must include a real UUID-shaped extra.eas.projectId before release sign-off run mode.');
  }
  if (!hasEnv('EXPO_TOKEN')) {
    add('expo_token', 'EXPO_TOKEN must be present for non-interactive EAS release metadata checks.');
  }
  if (!hasAppleSubmissionCredentials()) {
    add(
      'apple_submission_credentials',
      'ASC_APPLE_ID and EXPO_APPLE_APP_SPECIFIC_PASSWORD must both be present for Apple submission readiness.'
    );
  }

  if ((active('eas_ios_testflight') || active('eas_android')) && !commandAvailable('eas')) {
    add('eas_cli', 'EAS CLI must be available on PATH before querying EAS release build metadata.');
  }

  if (active('eas_ios_testflight') && options.requireTestflight) {
    if (!hasAnyEnv(['APP_STORE_CONNECT_ISSUER_ID', 'ASC_ISSUER_ID'])) {
      add('asc_issuer_id', 'APP_STORE_CONNECT_ISSUER_ID or ASC_ISSUER_ID must be present when TestFlight evidence is required.');
    }
    if (!hasAnyEnv(['APP_STORE_CONNECT_KEY_ID', 'ASC_KEY_ID'])) {
      add('asc_key_id', 'APP_STORE_CONNECT_KEY_ID or ASC_KEY_ID must be present when TestFlight evidence is required.');
    }
    if (
      !hasAnyEnv([
        'APP_STORE_CONNECT_PRIVATE_KEY',
        'ASC_PRIVATE_KEY',
        'APP_STORE_CONNECT_PRIVATE_KEY_PATH',
        'ASC_PRIVATE_KEY_PATH',
      ])
    ) {
      add(
        'asc_private_key',
        'APP_STORE_CONNECT_PRIVATE_KEY / ASC_PRIVATE_KEY or a *_PRIVATE_KEY_PATH value must be present when TestFlight evidence is required.'
      );
    }
    for (const envName of ['APP_STORE_CONNECT_PRIVATE_KEY_PATH', 'ASC_PRIVATE_KEY_PATH']) {
      if (hasEnv(envName) && !fs.existsSync(process.env[envName])) {
        add(envName.toLowerCase(), `${envName} is set but the referenced private key file does not exist.`);
      }
    }
  }

  if (active('physical_device')) {
    if (options.physicalPlatform === 'ios') {
      if (!hasAnyEnv(['APP_PHYSICAL_DEVICE_ID', 'APP_IOS_DEVICE_UDID'])) {
        add('ios_physical_device_id', 'APP_PHYSICAL_DEVICE_ID or APP_IOS_DEVICE_UDID must identify the trusted iOS physical device.');
      }
      if (!hasEnv('APP_IOS_DEVICE_APP_PATH')) {
        add('ios_signed_app_path', 'APP_IOS_DEVICE_APP_PATH must point to the signed .app used for iOS physical-device smoke.');
      } else if (!fs.existsSync(process.env.APP_IOS_DEVICE_APP_PATH)) {
        add('ios_signed_app_path', 'APP_IOS_DEVICE_APP_PATH is set but the signed .app path does not exist.');
      }
      const iosVisibility = inspectIosDeviceVisibility();
      if (!iosVisibility.ok) {
        add('ios_physical_device_discovery', 'xcrun xctrace could not inspect iOS devices on this runner.');
      } else if (iosVisibility.physical_connected < 1) {
        add('ios_physical_device_visible', 'No connected iOS physical device is visible to xcrun xctrace.');
      } else if (iosVisibility.requested_device_provided && iosVisibility.requested_device_visible === false) {
        add('ios_physical_device_match', 'The requested iOS device is not visible as a connected physical device.');
      }
    } else {
      if (!hasAnyEnv(['APP_PHYSICAL_DEVICE_ID', 'APP_ANDROID_DEVICE_SERIAL'])) {
        add('android_physical_device_id', 'APP_PHYSICAL_DEVICE_ID or APP_ANDROID_DEVICE_SERIAL must identify the trusted Android physical device.');
      }
      const androidVisibility = inspectAndroidDeviceVisibility();
      if (!androidVisibility.ok) {
        add('android_physical_device_discovery', 'adb could not inspect Android devices on this runner.');
      } else if (androidVisibility.physical_connected < 1) {
        add('android_physical_device_visible', 'No authorized Android physical device is visible to adb.');
      } else if (androidVisibility.requested_device_provided && androidVisibility.requested_device_visible === false) {
        add('android_physical_device_match', 'The requested Android device is not visible as an authorized physical device.');
      }
    }
  }

  if (active('push_delivery') && !hasEnv('APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN')) {
    add('push_delivery_token', 'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN must be present before sending provider push delivery evidence.');
  }

  if (active('native_crash_runtime')) {
    if (!hasAnyEnv(['APP_SENTRY_ORG', 'SENTRY_ORG'])) {
      add('sentry_org', 'APP_SENTRY_ORG or SENTRY_ORG must be present before querying native crash runtime evidence.');
    }
    if (!hasAnyEnv(['APP_SENTRY_PROJECT', 'SENTRY_PROJECT'])) {
      add('sentry_project', 'APP_SENTRY_PROJECT or SENTRY_PROJECT must be present before querying native crash runtime evidence.');
    }
    if (!hasAnyEnv(['APP_SENTRY_AUTH_TOKEN', 'SENTRY_AUTH_TOKEN'])) {
      add('sentry_auth_token', 'APP_SENTRY_AUTH_TOKEN or SENTRY_AUTH_TOKEN must be present before querying native crash runtime evidence.');
    }
    if (!hasAnyEnv(['APP_NATIVE_CRASH_SENTRY_EVENT_ID', 'SENTRY_EVENT_ID'])) {
      add('native_crash_event_id', 'APP_NATIVE_CRASH_SENTRY_EVENT_ID or SENTRY_EVENT_ID must identify the controlled native crash event.');
    }
  }

  if (active('telemetry_runtime')) {
    if (!hasEnv('APP_TELEMETRY_RUNTIME_API_BASE_URL')) {
      add('telemetry_runtime_api_base_url', 'APP_TELEMETRY_RUNTIME_API_BASE_URL must point to the non-local release API before telemetry runtime evidence.');
    } else {
      try {
        const apiUrl = new URL(process.env.APP_TELEMETRY_RUNTIME_API_BASE_URL);
        const hostname = apiUrl.hostname.toLowerCase();
        if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname) || hostname.endsWith('.localhost')) {
          add('telemetry_runtime_api_base_url', 'APP_TELEMETRY_RUNTIME_API_BASE_URL must be non-local for release evidence.');
        }
      } catch {
        add('telemetry_runtime_api_base_url', 'APP_TELEMETRY_RUNTIME_API_BASE_URL must be a valid URL.');
      }
    }
  }

  if (active('release_db_parity') && !hasEnv('DATABASE_URL')) {
    add('release_database_url', 'DATABASE_URL must point to the release / production PostgreSQL target for DB parity evidence.');
  }

  return missing;
}

function runCommand(step) {
  const startedAt = Date.now();
  console.log(`[release-external-signoff] start ${step.id}: ${step.title}`);
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd || mobileRoot,
    env: {
      ...process.env,
      DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = redactSensitive(result.stdout);
  const stderr = redactSensitive(result.stderr);
  if (stdout.trim()) process.stdout.write(stdout.endsWith('\n') ? stdout : `${stdout}\n`);
  if (stderr.trim()) process.stderr.write(stderr.endsWith('\n') ? stderr : `${stderr}\n`);
  const status = result.status ?? 1;
  const durationMs = Date.now() - startedAt;
  console.log(
    `[release-external-signoff] ${status === 0 ? 'ok' : 'failed'} ${step.id}: exit=${status} duration_ms=${durationMs}`
  );
  return {
    id: step.id,
    title: step.title,
    exit_code: status,
    duration_ms: durationMs,
  };
}

function nodeScript(scriptName, args = []) {
  return {
    command: process.execPath,
    args: [path.join(scriptDir, scriptName), ...args],
  };
}

function npmBackend(scriptName) {
  return {
    command: 'npm',
    args: ['--prefix', path.join(repoRoot, 'backend'), 'run', scriptName],
    cwd: repoRoot,
  };
}

const modeArg = options.run ? '--run' : '--dry-run';
const evidenceArg = `--evidence-dir=${evidenceDir}`;
const steps = [
  {
    id: 'status',
    title: 'external evidence status',
    ...nodeScript('check-release-external-evidence-status.mjs', [
      ...(options.reportDir ? [`--report-dir=${options.reportDir}`] : []),
    ]),
    required: true,
  },
  {
    id: 'handoff',
    title: 'external evidence handoff',
    ...nodeScript('check-release-external-evidence-handoff.mjs', [
      ...(options.reportDir ? [`--report-dir=${options.reportDir}`] : []),
    ]),
    required: true,
  },
  {
    id: 'eas_ios_testflight',
    title: options.requireTestflight ? 'EAS iOS production build + TestFlight evidence' : 'EAS iOS production build evidence',
    ...nodeScript('run-eas-ios-release-smoke.mjs', [
      modeArg,
      ...(options.requireTestflight ? ['--require-testflight'] : []),
      evidenceArg,
    ]),
  },
  {
    id: 'eas_android',
    title: 'EAS Android production build evidence',
    ...nodeScript('run-eas-android-release-smoke.mjs', [modeArg, evidenceArg]),
  },
  {
    id: 'physical_device',
    title: `${options.physicalPlatform} physical device smoke evidence`,
    ...nodeScript('run-physical-device-smoke.mjs', [modeArg, `--platform=${options.physicalPlatform}`, evidenceArg]),
  },
  {
    id: 'push_delivery',
    title: 'Expo push provider delivery evidence',
    ...nodeScript('run-push-delivery-smoke.mjs', [modeArg, evidenceArg]),
  },
  {
    id: 'native_crash_runtime',
    title: 'Sentry native crash runtime evidence',
    ...nodeScript('run-native-crash-runtime-smoke.mjs', [modeArg, evidenceArg]),
  },
  {
    id: 'telemetry_runtime',
    title: 'App telemetry event + OTLP runtime ingest evidence',
    ...nodeScript('run-telemetry-runtime-smoke.mjs', [modeArg, evidenceArg]),
  },
  {
    id: 'release_db_parity',
    title: 'release / production DB parity evidence',
    ...(options.run ? npmBackend('ops:release-db:evidence') : npmBackend('ops:release-db:dry-run')),
  },
  {
    id: 'release_completion_audit',
    title: options.run ? 'strict release completion audit' : 'non-strict release completion audit',
    ...nodeScript('check-release-completion-audit.mjs', options.run ? ['--strict'] : []),
  },
  {
    id: 'goal_completion_audit',
    title: options.run ? 'strict /goal completion audit' : 'non-strict /goal completion audit',
    ...nodeScript('check-app-goal-completion-audit.mjs', options.run ? ['--strict'] : []),
  },
];

console.log(`[release-external-signoff] mode=${options.run ? 'run' : 'dry-run'} physical_platform=${options.physicalPlatform}`);
for (const envFile of loadedEnvFiles) {
  console.log(
    `[release-external-signoff] env-file ${displayEnvFilePath(envFile.filePath)} loaded_keys=${envFile.loadedKeys} kept_existing_keys=${envFile.keptExistingKeys}`
  );
}
if (!options.run) {
  console.log('[release-external-signoff] dry-run only. Pass --run or use release:external-evidence:run before touching EAS, provider APIs, physical devices, Sentry, telemetry backend, or release DB.');
}
if (options.run) {
  const missingPrerequisites = validateRunPrerequisites();
  const reportPath = writeReport(buildPrerequisiteReport(missingPrerequisites));
  if (reportPath) {
    console.log(`[release-external-signoff] prerequisite report: ${path.relative(repoRoot, reportPath)}`);
  }
  if (missingPrerequisites.length > 0) {
    console.error('[release-external-signoff] prerequisite validation failed before touching EAS, provider APIs, physical devices, Sentry, telemetry backend, or release DB.');
    for (const item of missingPrerequisites) {
      console.error(`- ${item.id}: ${item.message}`);
    }
    process.exit(1);
  }
  console.log('[release-external-signoff] prerequisite validation passed.');
  if (options.validateOnly) {
    console.log('[release-external-signoff] validate-only complete; no external evidence steps were run.');
    process.exit(0);
  }
}

const results = [];
for (const step of steps) {
  if (!step.required && options.skip.has(step.id)) {
    console.log(`[release-external-signoff] skipped ${step.id}: ${step.title}`);
    results.push({
      id: step.id,
      title: step.title,
      skipped: true,
      exit_code: null,
      duration_ms: 0,
    });
    continue;
  }

  const result = runCommand(step);
  results.push(result);
  if (result.exit_code !== 0 && !options.continueOnError) {
    console.error(`[release-external-signoff] stopped after ${step.id}. Use --continue-on-error to inspect later steps.`);
    break;
  }
}

const failed = results.filter((entry) => entry.exit_code !== 0 && entry.exit_code !== null);
const skipped = results.filter((entry) => entry.skipped);
console.log('[release-external-signoff] summary');
console.log(`- mode: ${options.run ? 'run' : 'dry-run'}`);
console.log(`- passed: ${results.filter((entry) => entry.exit_code === 0).length}`);
console.log(`- failed: ${failed.length}`);
console.log(`- skipped: ${skipped.length}`);
if (failed.length) {
  for (const entry of failed) {
    console.log(`  failed: ${entry.id}`);
  }
}
if (skipped.length) {
  for (const entry of skipped) {
    console.log(`  skipped: ${entry.id}`);
  }
}

if (failed.length) {
  process.exit(1);
}
