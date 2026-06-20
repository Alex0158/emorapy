import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseAdbDeviceRows, parseXctraceListDevices } from './lib/release-device-discovery.mjs';
import { getExpoProjectIdentityStatus } from './lib/release-app-config.mjs';
import {
  buildReleaseEvidencePolicies,
  summarizeEvidenceCandidate,
} from './lib/release-evidence-policy.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const evidenceRoot = path.join(
  repoRoot,
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證'
);
const json = process.argv.includes('--json');
const reportDirArg = process.argv.find((arg) => arg.startsWith('--report-dir='));
const reportDir = reportDirArg ? path.resolve(process.cwd(), reportDirArg.slice('--report-dir='.length)) : null;
const loadedEnvFiles = [];

const allowedReleaseEnvFileKeys = new Set([
  'DEVELOPER_DIR',
  'ANDROID_HOME',
  'ANDROID_SDK_ROOT',
  'APP_RELEASE_EXTERNAL_SIGNOFF_RUN',
  'APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR',
  'APP_PHYSICAL_DEVICE_PLATFORM',
  'APP_EAS_IOS_REQUIRE_TESTFLIGHT',
  'APP_EAS_PROJECT_FULL_NAME',
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
  if (message) console.error(`[release-external-evidence-status] ${message}`);
  console.error('usage: npm --prefix mobile run release:external-evidence:status -- [--json] [--report-dir=<path>] [--release-env-file=<path>]');
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
    file: path.relative(repoRoot, resolvedPath),
    loaded_keys: loadedKeys.length,
    kept_existing_keys: keptExistingKeys.length,
  });
}

for (const arg of process.argv.slice(2)) {
  if (arg === '--json') {
    continue;
  } else if (arg.startsWith('--report-dir=')) {
    continue;
  } else if (arg.startsWith('--env-file=')) {
    printUsageAndExit('--env-file is reserved by Node/npm; use --release-env-file=<path>');
  } else if (arg.startsWith('--release-env-file=')) {
    const rawPath = arg.slice('--release-env-file='.length);
    if (!rawPath) printUsageAndExit('--release-env-file requires a path');
    loadEnvFile(rawPath);
  } else {
    printUsageAndExit(`unknown argument: ${arg}`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hasEnv(name) {
  return !isPlaceholderValue(process.env[name]);
}

function hasAppleSubmissionCredentials() {
  return hasEnv('ASC_APPLE_ID') && hasEnv('EXPO_APPLE_APP_SPECIFIC_PASSWORD');
}

function existingPathFromEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) return null;
  const filePath = path.resolve(repoRoot, value);
  return fs.existsSync(filePath) ? filePath : null;
}

function findLatestEvidence(prefix, extensions = ['.json']) {
  if (!fs.existsSync(evidenceRoot)) return null;
  const matches = fs
    .readdirSync(evidenceRoot)
    .filter((entry) => entry.startsWith(prefix) && extensions.some((extension) => entry.endsWith(extension)))
    .sort()
    .reverse();
  return matches[0] ? path.join(evidenceRoot, matches[0]) : null;
}

function firstExistingPath(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

function runCommand(command, args = [], options = {}) {
  return spawnSync(command, args, {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeStatusReport(status) {
  if (!reportDir) return null;
  fs.mkdirSync(reportDir, { recursive: true });
  const filePath = path.join(reportDir, `App-External-Evidence-Status-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(status, null, 2)}\n`);
  return filePath;
}

function probeIosDevices() {
  const xcodeDeveloperDir = '/Applications/Xcode.app/Contents/Developer';
  const env = {
    ...process.env,
    DEVELOPER_DIR: process.env.DEVELOPER_DIR || xcodeDeveloperDir,
  };
  const result = runCommand('xcrun', ['xctrace', 'list', 'devices'], { env });
  if (result.status !== 0) {
    return {
      ok: false,
      physical_connected: 0,
      physical_offline: 0,
      simulators: 0,
      error: (result.stderr || result.stdout).trim().slice(-500),
    };
  }

  const devices = parseXctraceListDevices(result.stdout);
  return {
    ok: true,
    physical_connected: devices.filter((device) => device.isPhysical && device.isAvailable).length,
    physical_offline: devices.filter((device) => device.isPhysical && device.section === 'devices_offline').length,
    simulators: devices.filter((device) => device.isSimulator).length,
  };
}

function probeAndroidDevices() {
  const sdkRoot = firstExistingPath([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  ]);
  const adb = sdkRoot ? path.join(sdkRoot, 'platform-tools', 'adb') : 'adb';
  const result = runCommand(adb, ['devices', '-l']);
  if (result.status !== 0) {
    return {
      ok: false,
      physical_connected: 0,
      emulator_connected: 0,
      unauthorized_or_offline: 0,
      error: (result.stderr || result.stdout).trim().slice(-500),
    };
  }

  const devices = parseAdbDeviceRows(result.stdout);
  return {
    ok: true,
    physical_connected: devices.filter((device) => device.state === 'device' && !device.isEmulator).length,
    emulator_connected: devices.filter((device) => device.state === 'device' && device.isEmulator).length,
    unauthorized_or_offline: devices.filter((device) => device.state !== 'device').length,
  };
}

function probeEasCli() {
  const result = runCommand('eas', ['whoami', '--non-interactive']);
  if (result.error?.code === 'ENOENT') {
    return {
      available: false,
      authenticated: false,
    };
  }

  return {
    available: true,
    authenticated: result.status === 0,
  };
}

function buildBlockers(status) {
  const blockers = [];
  const add = (id, message) => blockers.push({ id, message });

  if (!status.app.eas_project_binding_valid) {
    add(
      'eas_project_id',
      `mobile/app.json must include a real UUID-shaped extra.eas.projectId and APP_EAS_PROJECT_FULL_NAME must match ${status.app.eas_project_full_name_expected ?? 'the Expo owner/slug'}.`
    );
  }
  if (!status.credentials.expo_token_present) {
    add('expo_token', 'EXPO_TOKEN is required for non-interactive EAS release metadata checks.');
  }
  if (!status.credentials.apple_submission_credentials_present) {
    add('apple_submission_credentials', 'ASC_APPLE_ID and EXPO_APPLE_APP_SPECIFIC_PASSWORD must both be present.');
  }
  if (!status.credentials.app_store_connect_api_credentials_present) {
    add('app_store_connect_api_credentials', 'App Store Connect API credentials are required for TestFlight evidence.');
  }
  if (!status.credentials.sentry_runtime_query_credentials_present) {
    add('sentry_runtime_query_credentials', 'Sentry org, project, and auth token are required to query controlled native crash runtime evidence.');
  }
  if (!status.credentials.native_crash_event_id_present) {
    add('native_crash_event_id', 'APP_NATIVE_CRASH_SENTRY_EVENT_ID or SENTRY_EVENT_ID is required to query controlled native crash runtime evidence.');
  }
  if (status.evidence.eas_ios_release.state !== 'candidate_pass') {
    add('eas_ios_release_evidence', 'Pass-state App-EAS-iOS-Release-* evidence is missing.');
  }
  if (status.evidence.testflight.state !== 'candidate_pass') {
    add('testflight_evidence', 'Pass-state TestFlight evidence is missing.');
  }
  if (status.evidence.eas_android_release.state !== 'candidate_pass') {
    add('eas_android_release_evidence', 'Pass-state App-EAS-Android-Release-* evidence is missing.');
  }
  if (status.evidence.physical_device.state !== 'candidate_pass') {
    add('physical_device_evidence', 'Pass-state App-Physical-Device-* evidence is missing.');
  }
  if (status.evidence.push_delivery.state !== 'candidate_pass') {
    add('push_delivery_evidence', 'Pass-state App-Push-Delivery-* evidence is missing.');
  }
  if (status.evidence.native_crash_runtime.state !== 'candidate_pass') {
    add('native_crash_runtime_evidence', 'Pass-state App-Native-Crash-Runtime-* evidence is missing.');
  }
  if (status.evidence.telemetry_runtime.state !== 'candidate_pass') {
    add('telemetry_runtime_evidence', 'Pass-state App-Telemetry-Runtime-* evidence is missing.');
  }
  if (status.evidence.release_db_parity.state !== 'candidate_pass') {
    add('release_db_parity_evidence', 'Pass-state App-Release-DB-Parity-* evidence is missing.');
  }
  if (status.devices.ios.ok && status.devices.ios.physical_connected === 0) {
    add('ios_physical_device_visible', 'No connected iOS physical device is visible to xctrace.');
  }
  if (status.devices.android.ok && status.devices.android.physical_connected === 0) {
    add('android_physical_device_visible', 'No connected Android physical device is visible to adb.');
  }

  return blockers;
}

function buildStatus() {
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  const evidencePolicies = buildReleaseEvidencePolicies(app);
  const easProjectIdentity = getExpoProjectIdentityStatus(app, process.env.APP_EAS_PROJECT_FULL_NAME);
  const easCli = probeEasCli();
  const easIos = existingPathFromEnv('APP_EAS_IOS_RELEASE_EVIDENCE_FILE') ||
    findLatestEvidence('App-EAS-iOS-Release-');
  const testflight = existingPathFromEnv('APP_TESTFLIGHT_EVIDENCE_FILE') ||
    existingPathFromEnv('APP_EAS_IOS_RELEASE_EVIDENCE_FILE') ||
    findLatestEvidence('App-EAS-iOS-Release-');

  const nextCommands = [
    'EXPO_TOKEN=<token> npm --prefix mobile run eas-ios-release:smoke -- --run',
    'EXPO_TOKEN=<token> APP_STORE_CONNECT_ISSUER_ID=<issuer> APP_STORE_CONNECT_KEY_ID=<key-id> APP_STORE_CONNECT_PRIVATE_KEY_PATH=<p8-path> npm --prefix mobile run eas-ios-release:smoke -- --run --require-testflight',
    'EXPO_TOKEN=<token> npm --prefix mobile run eas-android-release:smoke -- --run',
    'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer APP_IOS_DEVICE_UDID=<trusted-device-udid> APP_IOS_DEVICE_APP_PATH=<signed-app-path> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=ios --report-dir=<report-dir>',
    'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer APP_IOS_DEVICE_UDID=<trusted-device-udid> APP_IOS_DEVICE_APP_PATH=<signed-app-path> npm --prefix mobile run release:external-evidence:run -- --physical-platform=ios --report-dir=<report-dir>',
    'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer APP_IOS_DEVICE_UDID=<trusted-device-udid> npm --prefix mobile run physical-device:smoke -- --platform=ios --app-path=<signed-app-path>',
    'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=android --report-dir=<report-dir>',
    'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial> npm --prefix mobile run release:external-evidence:run -- --physical-platform=android --report-dir=<report-dir>',
    'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial> npm --prefix mobile run physical-device:smoke -- --platform=android --run',
    'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN=<ExpoPushToken> npm --prefix mobile run push-delivery:smoke -- --run',
    'APP_SENTRY_ORG=<org> APP_SENTRY_PROJECT=<project> APP_SENTRY_AUTH_TOKEN=<token> APP_NATIVE_CRASH_SENTRY_EVENT_ID=<event-id> npm --prefix mobile run native-crash:runtime:smoke -- --run',
    'npm --prefix mobile run telemetry:runtime:smoke -- --run --release-env-file=release.env.local',
    'DATABASE_URL=<release-or-production-postgresql-url> npm --prefix backend run ops:release-db:evidence',
    'npm --prefix mobile run release:completion:audit:strict',
  ];
  if (!easProjectIdentity.valid) {
    nextCommands.unshift(
      '在 EAS dashboard 將 project 對齊為 @alexdev518/emorapy-mobile，或新建該 project 後更新 mobile/app.json extra.eas.projectId；不要用 eas project:init --force 作 rename，該命令已實測會把本地 slug 改回 cj-mobile；再於 release env 設定 APP_EAS_PROJECT_FULL_NAME=@alexdev518/emorapy-mobile'
    );
  }

  const status = {
    type: 'app-external-evidence-status',
    generated_at: new Date().toISOString(),
    app: {
      ios_bundle_identifier: app.ios?.bundleIdentifier ?? null,
      android_package: app.android?.package ?? null,
      version: app.version ?? null,
      ios_build_number: app.ios?.buildNumber ?? null,
      android_version_code: app.android?.versionCode ?? null,
      eas_project_id_present: easProjectIdentity.project_id_present,
      eas_project_id_valid: easProjectIdentity.project_id_valid,
      eas_project_id_format: easProjectIdentity.project_id_format,
      eas_project_full_name_expected: easProjectIdentity.expected_full_name,
      eas_project_full_name_present: easProjectIdentity.configured_full_name_present,
      eas_project_full_name_matches_expected: easProjectIdentity.full_name_matches_expected,
      eas_project_binding_valid: easProjectIdentity.valid,
    },
    credentials: {
      expo_token_present: hasEnv('EXPO_TOKEN'),
      apple_submission_credentials_present: hasAppleSubmissionCredentials(),
      app_store_connect_api_credentials_present:
        (hasEnv('APP_STORE_CONNECT_ISSUER_ID') || hasEnv('ASC_ISSUER_ID')) &&
        (hasEnv('APP_STORE_CONNECT_KEY_ID') || hasEnv('ASC_KEY_ID')) &&
        (hasEnv('APP_STORE_CONNECT_PRIVATE_KEY') ||
          hasEnv('ASC_PRIVATE_KEY') ||
          hasEnv('APP_STORE_CONNECT_PRIVATE_KEY_PATH') ||
          hasEnv('ASC_PRIVATE_KEY_PATH')),
      push_delivery_token_present: hasEnv('APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN'),
      sentry_runtime_query_credentials_present:
        (hasEnv('APP_SENTRY_ORG') || hasEnv('SENTRY_ORG')) &&
        (hasEnv('APP_SENTRY_PROJECT') || hasEnv('SENTRY_PROJECT')) &&
        (hasEnv('APP_SENTRY_AUTH_TOKEN') || hasEnv('SENTRY_AUTH_TOKEN')),
      native_crash_event_id_present: hasEnv('APP_NATIVE_CRASH_SENTRY_EVENT_ID') || hasEnv('SENTRY_EVENT_ID'),
      telemetry_runtime_api_base_url_present: hasEnv('APP_TELEMETRY_RUNTIME_API_BASE_URL'),
      release_database_url_present: hasEnv('DATABASE_URL'),
    },
    env_files: {
      values_redacted: true,
      loaded: loadedEnvFiles,
    },
    tools: {
      eas_cli_available: easCli.available,
      eas_cli_authenticated: easCli.authenticated,
    },
    devices: {
      ios: probeIosDevices(),
      android: probeAndroidDevices(),
    },
    evidence: {
      eas_ios_release: summarizeEvidenceCandidate(easIos, evidencePolicies.eas_ios_release, repoRoot),
      testflight: summarizeEvidenceCandidate(testflight, evidencePolicies.testflight, repoRoot),
      eas_android_release: summarizeEvidenceCandidate(
        existingPathFromEnv('APP_EAS_ANDROID_RELEASE_EVIDENCE_FILE') ||
          findLatestEvidence('App-EAS-Android-Release-'),
        evidencePolicies.eas_android_release,
        repoRoot
      ),
      physical_device: summarizeEvidenceCandidate(
        existingPathFromEnv('APP_PHYSICAL_DEVICE_EVIDENCE_FILE') ||
          findLatestEvidence('App-Physical-Device-'),
        evidencePolicies.physical_device,
        repoRoot
      ),
      push_delivery: summarizeEvidenceCandidate(
        existingPathFromEnv('APP_PUSH_DELIVERY_EVIDENCE_FILE') ||
          findLatestEvidence('App-Push-Delivery-'),
        evidencePolicies.push_delivery,
        repoRoot
      ),
      native_crash_runtime: summarizeEvidenceCandidate(
        existingPathFromEnv('APP_NATIVE_CRASH_EVIDENCE_FILE') ||
          findLatestEvidence('App-Native-Crash-Runtime-'),
        evidencePolicies.native_crash_runtime,
        repoRoot
      ),
      telemetry_runtime: summarizeEvidenceCandidate(
        existingPathFromEnv('APP_TELEMETRY_RUNTIME_EVIDENCE_FILE') ||
          findLatestEvidence('App-Telemetry-Runtime-'),
        evidencePolicies.telemetry_runtime,
        repoRoot
      ),
      release_db_parity: summarizeEvidenceCandidate(
        existingPathFromEnv('APP_RELEASE_DB_PARITY_EVIDENCE_FILE') ||
          findLatestEvidence('App-Release-DB-Parity-'),
        evidencePolicies.release_db_parity,
        repoRoot
      ),
    },
    next_commands: nextCommands,
  };
  return {
    ...status,
    blockers: buildBlockers(status),
  };
}

function printStatus(status) {
  console.log('[release-external-evidence-status] app');
  console.log(`- iOS: ${status.app.ios_bundle_identifier} ${status.app.version}/${status.app.ios_build_number}`);
  console.log(`- Android: ${status.app.android_package} ${status.app.version}/${status.app.android_version_code}`);
  console.log(`- EAS project id valid UUID: ${status.app.eas_project_id_valid ? 'yes' : 'no'}`);
  console.log(`- EAS project binding valid: ${status.app.eas_project_binding_valid ? 'yes' : 'no'} (${status.app.eas_project_full_name_expected ?? 'missing expected full name'})`);

  console.log('[release-external-evidence-status] credentials present');
  console.log(`- EXPO_TOKEN: ${status.credentials.expo_token_present ? 'yes' : 'no'}`);
  console.log(`- Apple submission credentials: ${status.credentials.apple_submission_credentials_present ? 'yes' : 'no'}`);
  console.log(`- App Store Connect API credentials: ${status.credentials.app_store_connect_api_credentials_present ? 'yes' : 'no'}`);
  console.log(`- Push delivery token: ${status.credentials.push_delivery_token_present ? 'yes' : 'no'}`);
  console.log(`- Sentry runtime query credentials: ${status.credentials.sentry_runtime_query_credentials_present ? 'yes' : 'no'}`);
  console.log(`- Native crash event id: ${status.credentials.native_crash_event_id_present ? 'yes' : 'no'}`);
  console.log(`- Telemetry runtime API base URL: ${status.credentials.telemetry_runtime_api_base_url_present ? 'yes' : 'no'}`);
  console.log(`- DATABASE_URL present: ${status.credentials.release_database_url_present ? 'yes' : 'no'}`);

  if (status.env_files.loaded.length > 0) {
    console.log('[release-external-evidence-status] env files');
    for (const envFile of status.env_files.loaded) {
      console.log(`- ${envFile.file}: loaded_keys=${envFile.loaded_keys} kept_existing_keys=${envFile.kept_existing_keys}`);
    }
  }

  console.log('[release-external-evidence-status] tools');
  console.log(`- EAS CLI available: ${status.tools.eas_cli_available ? 'yes' : 'no'}`);
  console.log(`- EAS CLI authenticated: ${status.tools.eas_cli_authenticated ? 'yes' : 'no'}`);

  console.log('[release-external-evidence-status] devices');
  console.log(`- iOS physical connected/offline/simulators: ${status.devices.ios.physical_connected}/${status.devices.ios.physical_offline}/${status.devices.ios.simulators}`);
  console.log(`- Android physical/emulator/unauthorized-or-offline: ${status.devices.android.physical_connected}/${status.devices.android.emulator_connected}/${status.devices.android.unauthorized_or_offline}`);

  console.log('[release-external-evidence-status] structured evidence candidates');
  for (const [name, evidence] of Object.entries(status.evidence)) {
    console.log(`- ${name}: ${evidence.state}${evidence.file ? ` (${evidence.file})` : ''}`);
  }

  console.log('[release-external-evidence-status] normalized blockers');
  if (status.blockers.length === 0) {
    console.log('- none');
  } else {
    for (const blocker of status.blockers) {
      console.log(`- ${blocker.id}: ${blocker.message}`);
    }
  }

  console.log('[release-external-evidence-status] next commands');
  for (const command of status.next_commands) {
    console.log(`- ${command}`);
  }
  console.log('[release-external-evidence-status] note: use release:completion:audit:strict as the release sign-off gate.');
}

const status = buildStatus();
const reportPath = writeStatusReport(status);
if (json) {
  console.log(JSON.stringify(status, null, 2));
} else {
  printStatus(status);
  if (reportPath) {
    console.log(`[release-external-evidence-status] report: ${path.relative(repoRoot, reportPath)}`);
  }
}
