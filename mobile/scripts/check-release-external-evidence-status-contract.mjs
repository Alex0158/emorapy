import process from 'node:process';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { getReleaseBlockingMigrationCount } from './lib/release-evidence-policy.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const statusScript = path.join(scriptDir, 'check-release-external-evidence-status.mjs');
const releaseBlockingMigrationCount = getReleaseBlockingMigrationCount();

const evidenceKeys = [
  'eas_ios_release',
  'testflight',
  'eas_android_release',
  'physical_device',
  'push_delivery',
  'native_crash_runtime',
  'telemetry_runtime',
  'release_db_parity',
];

const requiredCurrentBlockerIds = [
  'eas_project_id',
  'expo_token',
  'apple_submission_credentials',
  'app_store_connect_api_credentials',
  'sentry_runtime_query_credentials',
  'native_crash_event_id',
  'eas_ios_release_evidence',
  'testflight_evidence',
  'eas_android_release_evidence',
  'physical_device_evidence',
  'push_delivery_evidence',
  'native_crash_runtime_evidence',
  'telemetry_runtime_evidence',
  'release_db_parity_evidence',
];

const controlledSecrets = [
  'controlled-expo-token-secret',
  'controlled-asc-apple-id@example.com',
  'controlled-apple-password-secret',
  'controlled-asc-issuer-secret',
  'controlled-asc-key-id-secret',
  'controlled-asc-private-key-secret',
  'ExpoPushToken[controlled-push-token-secret]',
  'controlled-sentry-org-secret',
  'controlled-sentry-project-secret',
  'controlled-sentry-auth-token-secret',
  'controlled-native-crash-event-secret',
  'https://telemetry-runtime.example.com/api/v1',
  'postgresql://controlled-user:controlled-pass@release-db.example.com:5432/cj',
];

function fail(message) {
  console.error(`[release-external-evidence-status-contract] ${message}`);
  process.exit(1);
}

function runStatus(extraEnv = {}, extraArgs = []) {
  return spawnSync(process.execPath, [statusScript, '--json', ...extraArgs], {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

function parseJsonResult(label, result) {
  if (result.status !== 0) {
    fail(`${label} must exit 0, got ${result.status}; stderr=${result.stderr.trim()}`);
  }
  if (result.stderr.trim()) {
    fail(`${label} must not write stderr: ${result.stderr.trim()}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`${label} did not produce valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    fail(`${label} must be boolean`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    fail(`${label} must be a number`);
  }
}

function validateEvidenceSummary(summary, label) {
  if (!summary || typeof summary !== 'object') {
    fail(`${label} must be an object`);
  }
  if (!['missing', 'candidate_pass', 'blocked_candidate', 'invalid_candidate', 'unreadable_candidate'].includes(summary.state)) {
    fail(`${label}.state has invalid value: ${summary.state}`);
  }
  if (summary.file !== null && typeof summary.file !== 'string') {
    fail(`${label}.file must be null or string`);
  }
  if (summary.evidence_type !== null && typeof summary.evidence_type !== 'string') {
    fail(`${label}.evidence_type must be null or string`);
  }
  if (summary.blocked !== null && typeof summary.blocked !== 'boolean') {
    fail(`${label}.blocked must be null or boolean`);
  }
  if (summary.run_mode !== null && typeof summary.run_mode !== 'string') {
    fail(`${label}.run_mode must be null or string`);
  }
  if (!Array.isArray(summary.validation_errors)) {
    fail(`${label}.validation_errors must be an array`);
  }
  if (!summary.validation_errors.every((entry) => typeof entry === 'string')) {
    fail(`${label}.validation_errors entries must be strings`);
  }
}

function validateBlockers(blockers, label) {
  if (!Array.isArray(blockers)) {
    fail(`${label}.blockers must be an array`);
  }
  const ids = new Set();
  for (const [index, blocker] of blockers.entries()) {
    if (!blocker || typeof blocker !== 'object') {
      fail(`${label}.blockers[${index}] must be an object`);
    }
    if (typeof blocker.id !== 'string' || blocker.id.length === 0) {
      fail(`${label}.blockers[${index}].id must be a non-empty string`);
    }
    if (ids.has(blocker.id)) {
      fail(`${label}.blockers includes duplicate id: ${blocker.id}`);
    }
    ids.add(blocker.id);
    if (typeof blocker.message !== 'string' || blocker.message.length === 0) {
      fail(`${label}.blockers[${index}].message must be a non-empty string`);
    }
    for (const secret of controlledSecrets) {
      if (blocker.message.includes(secret)) {
        fail(`${label}.blockers[${index}].message leaked controlled secret: ${secret}`);
      }
    }
  }
  return ids;
}

function writeJson(filePath, record) {
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateEvidenceFixturePair({ label, key, envKey, record, mutate, expectedErrorFragment }) {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), `emorapy-release-status-${key}-fixture-`));
  try {
    const validPath = writeJson(path.join(fixtureDir, `${label}-Valid.json`), record);
    const validResult = runStatus({ [envKey]: validPath });
    const validStatus = parseJsonResult(`${label} valid status JSON`, validResult);
    validateStatus(validStatus, `${label} valid status JSON`);
    const validSummary = validStatus.evidence?.[key];
    if (validSummary?.state !== 'candidate_pass') {
      fail(`${label} valid evidence must be reported as candidate_pass, got ${validSummary?.state}.`);
    }

    const invalidRecord = clone(record);
    mutate(invalidRecord);
    const invalidPath = writeJson(path.join(fixtureDir, `${label}-Invalid.json`), invalidRecord);
    const invalidResult = runStatus({ [envKey]: invalidPath });
    const invalidStatus = parseJsonResult(`${label} invalid status JSON`, invalidResult);
    validateStatus(invalidStatus, `${label} invalid status JSON`);
    const invalidSummary = invalidStatus.evidence?.[key];
    if (invalidSummary?.state !== 'invalid_candidate') {
      fail(`${label} invalid evidence must be reported as invalid_candidate, got ${invalidSummary?.state}.`);
    }
    if (!invalidSummary.validation_errors.some((entry) => entry.includes(expectedErrorFragment))) {
      fail(`${label} invalid evidence must explain ${expectedErrorFragment} validation failure.`);
    }
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

function validateStatus(status, label) {
  if (!status || typeof status !== 'object') {
    fail(`${label} root must be an object`);
  }
  if (status.type !== 'app-external-evidence-status') {
    fail(`${label}.type must be app-external-evidence-status`);
  }
  if (Number.isNaN(Date.parse(status.generated_at))) {
    fail(`${label}.generated_at must be an ISO-like timestamp`);
  }

  const app = status.app ?? {};
  for (const key of ['ios_bundle_identifier', 'android_package', 'version', 'ios_build_number']) {
    if (app[key] !== null && typeof app[key] !== 'string') {
      fail(`${label}.app.${key} must be null or string`);
    }
  }
  if (app.android_version_code !== null && typeof app.android_version_code !== 'number') {
    fail(`${label}.app.android_version_code must be null or number`);
  }
  assertBoolean(app.eas_project_id_present, `${label}.app.eas_project_id_present`);
  assertBoolean(app.eas_project_id_valid, `${label}.app.eas_project_id_valid`);
  assertBoolean(app.eas_project_full_name_present, `${label}.app.eas_project_full_name_present`);
  assertBoolean(
    app.eas_project_full_name_matches_expected,
    `${label}.app.eas_project_full_name_matches_expected`
  );
  assertBoolean(app.eas_project_binding_valid, `${label}.app.eas_project_binding_valid`);
  if (app.eas_project_full_name_expected !== null && typeof app.eas_project_full_name_expected !== 'string') {
    fail(`${label}.app.eas_project_full_name_expected must be null or string`);
  }
  if (typeof app.eas_project_id_format !== 'string') {
    fail(`${label}.app.eas_project_id_format must be string`);
  }

  const credentials = status.credentials ?? {};
  for (const key of [
    'expo_token_present',
    'apple_submission_credentials_present',
    'app_store_connect_api_credentials_present',
    'push_delivery_token_present',
    'sentry_runtime_query_credentials_present',
    'native_crash_event_id_present',
    'telemetry_runtime_api_base_url_present',
    'release_database_url_present',
  ]) {
    assertBoolean(credentials[key], `${label}.credentials.${key}`);
  }

  const envFiles = status.env_files ?? {};
  assertBoolean(envFiles.values_redacted, `${label}.env_files.values_redacted`);
  if (!Array.isArray(envFiles.loaded)) {
    fail(`${label}.env_files.loaded must be an array`);
  }
  for (const [index, entry] of envFiles.loaded.entries()) {
    if (!entry || typeof entry !== 'object') {
      fail(`${label}.env_files.loaded[${index}] must be an object`);
    }
    if (typeof entry.file !== 'string' || entry.file.length === 0) {
      fail(`${label}.env_files.loaded[${index}].file must be a non-empty string`);
    }
    assertNumber(entry.loaded_keys, `${label}.env_files.loaded[${index}].loaded_keys`);
    assertNumber(entry.kept_existing_keys, `${label}.env_files.loaded[${index}].kept_existing_keys`);
  }

  const tools = status.tools ?? {};
  for (const key of ['eas_cli_available', 'eas_cli_authenticated']) {
    assertBoolean(tools[key], `${label}.tools.${key}`);
  }

  const ios = status.devices?.ios ?? {};
  assertBoolean(ios.ok, `${label}.devices.ios.ok`);
  assertNumber(ios.physical_connected, `${label}.devices.ios.physical_connected`);
  assertNumber(ios.physical_offline, `${label}.devices.ios.physical_offline`);
  assertNumber(ios.simulators, `${label}.devices.ios.simulators`);

  const android = status.devices?.android ?? {};
  assertBoolean(android.ok, `${label}.devices.android.ok`);
  assertNumber(android.physical_connected, `${label}.devices.android.physical_connected`);
  assertNumber(android.emulator_connected, `${label}.devices.android.emulator_connected`);
  assertNumber(android.unauthorized_or_offline, `${label}.devices.android.unauthorized_or_offline`);

  for (const key of evidenceKeys) {
    validateEvidenceSummary(status.evidence?.[key], `${label}.evidence.${key}`);
  }
  validateBlockers(status.blockers, label);
  if (!Array.isArray(status.next_commands) || status.next_commands.length === 0) {
    fail(`${label}.next_commands must be a non-empty array`);
  }
  if (!status.next_commands.every((command) => typeof command === 'string' && command.length > 0)) {
    fail(`${label}.next_commands entries must be non-empty strings`);
  }
  const nextCommandsText = status.next_commands.join('\n');
  for (const needle of [
    'release:external-evidence:validate -- --physical-platform=ios',
    'release:external-evidence:run -- --physical-platform=ios',
    'physical-device:smoke -- --platform=ios',
    'APP_IOS_DEVICE_APP_PATH=<signed-app-path>',
    'release:external-evidence:validate -- --physical-platform=android',
    'release:external-evidence:run -- --physical-platform=android',
    'physical-device:smoke -- --platform=android',
    'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial>',
    'telemetry:runtime:smoke -- --run',
    'release:completion:audit:strict',
  ]) {
    if (!nextCommandsText.includes(needle)) {
      fail(`${label}.next_commands must include ${needle}`);
    }
  }
}

const baselineResult = runStatus();
const baseline = parseJsonResult('baseline status JSON', baselineResult);
validateStatus(baseline, 'baseline status JSON');
const baselineBlockerIds = validateBlockers(baseline.blockers, 'baseline status JSON');
const baselineResolvedBlockerIds = new Set();
if (baseline.app?.eas_project_binding_valid) {
  baselineResolvedBlockerIds.add('eas_project_id');
}
if (baseline.credentials?.expo_token_present) {
  baselineResolvedBlockerIds.add('expo_token');
}
if (baseline.credentials?.apple_submission_credentials_present) {
  baselineResolvedBlockerIds.add('apple_submission_credentials');
}
if (baseline.credentials?.app_store_connect_api_credentials_present) {
  baselineResolvedBlockerIds.add('app_store_connect_api_credentials');
}
if (baseline.credentials?.sentry_runtime_query_credentials_present) {
  baselineResolvedBlockerIds.add('sentry_runtime_query_credentials');
}
if (baseline.credentials?.native_crash_event_id_present) {
  baselineResolvedBlockerIds.add('native_crash_event_id');
}
if (baseline.evidence?.release_db_parity?.state === 'candidate_pass') {
  baselineResolvedBlockerIds.add('release_db_parity_evidence');
}
if (baseline.evidence?.telemetry_runtime?.state === 'candidate_pass') {
  baselineResolvedBlockerIds.add('telemetry_runtime_evidence');
}
if (baseline.evidence?.eas_android_release?.state === 'candidate_pass') {
  baselineResolvedBlockerIds.add('eas_android_release_evidence');
}
const requiredBaselineBlockerIds = requiredCurrentBlockerIds.filter(
  (id) => !baselineResolvedBlockerIds.has(id)
);
for (const id of requiredBaselineBlockerIds) {
  if (!baselineBlockerIds.has(id)) {
    fail(`baseline status JSON blockers must include ${id} while external release evidence is absent`);
  }
}

const controlledResult = runStatus({
  EXPO_TOKEN: controlledSecrets[0],
  ASC_APPLE_ID: controlledSecrets[1],
  EXPO_APPLE_APP_SPECIFIC_PASSWORD: controlledSecrets[2],
  APP_STORE_CONNECT_ISSUER_ID: controlledSecrets[3],
  APP_STORE_CONNECT_KEY_ID: controlledSecrets[4],
  APP_STORE_CONNECT_PRIVATE_KEY: controlledSecrets[5],
  APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN: controlledSecrets[6],
  APP_SENTRY_ORG: controlledSecrets[7],
  APP_SENTRY_PROJECT: controlledSecrets[8],
  APP_SENTRY_AUTH_TOKEN: controlledSecrets[9],
  APP_NATIVE_CRASH_SENTRY_EVENT_ID: controlledSecrets[10],
  APP_TELEMETRY_RUNTIME_API_BASE_URL: controlledSecrets[11],
  DATABASE_URL: controlledSecrets[12],
});
const controlledRaw = controlledResult.stdout + controlledResult.stderr;
for (const secret of controlledSecrets) {
  if (controlledRaw.includes(secret)) {
    fail(`controlled secret leaked into status output: ${secret}`);
  }
}
const controlled = parseJsonResult('controlled-secret status JSON', controlledResult);
validateStatus(controlled, 'controlled-secret status JSON');
for (const key of [
  'expo_token_present',
  'apple_submission_credentials_present',
  'app_store_connect_api_credentials_present',
  'push_delivery_token_present',
  'sentry_runtime_query_credentials_present',
  'native_crash_event_id_present',
  'telemetry_runtime_api_base_url_present',
  'release_database_url_present',
]) {
  if (controlled.credentials[key] !== true) {
    fail(`controlled-secret status JSON credentials.${key} must be true when controlled env is set`);
  }
}
const controlledBlockerIds = validateBlockers(controlled.blockers, 'controlled-secret status JSON');
for (const id of ['expo_token', 'apple_submission_credentials', 'app_store_connect_api_credentials', 'sentry_runtime_query_credentials', 'native_crash_event_id']) {
  if (controlledBlockerIds.has(id)) {
    fail(`controlled-secret status JSON blockers must not include ${id} when controlled env is set`);
  }
}

const controlledEnvFileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emorapy-release-status-env-file-'));
try {
  const controlledEnvFilePath = path.join(controlledEnvFileDir, 'release.env.local');
  fs.writeFileSync(
    controlledEnvFilePath,
    [
      `EXPO_TOKEN=${controlledSecrets[0]}`,
      'APP_EAS_PROJECT_FULL_NAME=@alexdev518/emorapy-mobile',
      `ASC_APPLE_ID=${controlledSecrets[1]}`,
      `EXPO_APPLE_APP_SPECIFIC_PASSWORD=${controlledSecrets[2]}`,
      `APP_STORE_CONNECT_ISSUER_ID=${controlledSecrets[3]}`,
      `APP_STORE_CONNECT_KEY_ID=${controlledSecrets[4]}`,
      `APP_STORE_CONNECT_PRIVATE_KEY=${controlledSecrets[5]}`,
      `APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN=${controlledSecrets[6]}`,
      `APP_SENTRY_ORG=${controlledSecrets[7]}`,
      `APP_SENTRY_PROJECT=${controlledSecrets[8]}`,
      `APP_SENTRY_AUTH_TOKEN=${controlledSecrets[9]}`,
      `APP_NATIVE_CRASH_SENTRY_EVENT_ID=${controlledSecrets[10]}`,
      `APP_TELEMETRY_RUNTIME_API_BASE_URL=${controlledSecrets[11]}`,
      `DATABASE_URL=${controlledSecrets[12]}`,
      'APP_ANDROID_DEVICE_SERIAL=REPLACE_WITH_DEVICE_SERIAL',
      '',
    ].join('\n')
  );
  const envFileResult = runStatus({}, [`--release-env-file=${controlledEnvFilePath}`]);
  const envFileRaw = envFileResult.stdout + envFileResult.stderr;
  for (const secret of controlledSecrets) {
    if (envFileRaw.includes(secret)) {
      fail(`controlled release env file secret leaked into status output: ${secret}`);
    }
  }
  const envFileStatus = parseJsonResult('controlled env-file status JSON', envFileResult);
  validateStatus(envFileStatus, 'controlled env-file status JSON');
  if (envFileStatus.env_files.loaded.length !== 1) {
    fail('controlled env-file status JSON must record one loaded env file');
  }
  if (envFileStatus.env_files.loaded[0].loaded_keys !== 15) {
    fail(`controlled env-file status JSON loaded_keys must be 15, got ${envFileStatus.env_files.loaded[0].loaded_keys}`);
  }
  if (envFileStatus.app.eas_project_binding_valid !== true) {
    fail('controlled env-file status JSON must mark EAS project binding valid when APP_EAS_PROJECT_FULL_NAME matches owner/slug.');
  }
  for (const key of [
    'expo_token_present',
    'apple_submission_credentials_present',
    'app_store_connect_api_credentials_present',
    'push_delivery_token_present',
    'sentry_runtime_query_credentials_present',
    'native_crash_event_id_present',
    'telemetry_runtime_api_base_url_present',
    'release_database_url_present',
  ]) {
    if (envFileStatus.credentials[key] !== true) {
      fail(`controlled env-file status JSON credentials.${key} must be true when release env file is loaded`);
    }
  }
  const envFileBlockerIds = validateBlockers(envFileStatus.blockers, 'controlled env-file status JSON');
  for (const id of ['expo_token', 'apple_submission_credentials', 'app_store_connect_api_credentials', 'sentry_runtime_query_credentials', 'native_crash_event_id']) {
    if (envFileBlockerIds.has(id)) {
      fail(`controlled env-file status JSON blockers must not include ${id} when controlled env file is loaded`);
    }
  }
} finally {
  fs.rmSync(controlledEnvFileDir, { recursive: true, force: true });
}

const invalidEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emorapy-release-status-invalid-evidence-'));
try {
  const invalidEasEvidencePath = path.join(invalidEvidenceDir, 'App-EAS-iOS-Release-Invalid.json');
  fs.writeFileSync(
    invalidEasEvidencePath,
    `${JSON.stringify(
      {
        type: 'app-eas-ios-release-evidence',
        app_ios_bundle_identifier: baseline.app.ios_bundle_identifier,
        app_version: baseline.app.version,
        app_build_number: baseline.app.ios_build_number,
        summary: {
          blocked: false,
          run_mode: 'dry-run',
        },
      },
      null,
      2
    )}\n`
  );
  const invalidResult = runStatus({
    APP_EAS_IOS_RELEASE_EVIDENCE_FILE: invalidEasEvidencePath,
  });
  const invalidStatus = parseJsonResult('invalid EAS evidence status JSON', invalidResult);
  validateStatus(invalidStatus, 'invalid EAS evidence status JSON');
  const invalidSummary = invalidStatus.evidence?.eas_ios_release;
  if (invalidSummary?.state !== 'invalid_candidate') {
    fail('invalid EAS evidence must be reported as invalid_candidate, not candidate_pass.');
  }
  if (!invalidSummary.validation_errors.some((entry) => entry.includes('summary.run_mode'))) {
    fail('invalid EAS evidence must explain the run_mode validation failure.');
  }
  const invalidBlockerIds = validateBlockers(invalidStatus.blockers, 'invalid EAS evidence status JSON');
  if (!invalidBlockerIds.has('eas_ios_release_evidence')) {
    fail('invalid EAS evidence must keep eas_ios_release_evidence blocker.');
  }
} finally {
  fs.rmSync(invalidEvidenceDir, { recursive: true, force: true });
}

const hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const appIdentity = {
  app_android_package: baseline.app.android_package,
  app_ios_bundle_identifier: baseline.app.ios_bundle_identifier,
};
const appConfig = JSON.parse(fs.readFileSync(path.join(mobileRoot, 'app.json'), 'utf8')).expo ?? {};
const expectedNativeCrashRelease = `emorapy-mobile@${appConfig.version}+${appConfig.ios?.buildNumber}`;
const gitHeadResult = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: path.resolve(mobileRoot, '..'),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const currentGitHead = gitHeadResult.status === 0 ? gitHeadResult.stdout.trim().toLowerCase() : null;
if (!/^[0-9a-f]{40}$/.test(currentGitHead ?? '')) {
  fail('status contract must resolve current git HEAD for telemetry runtime fixture.');
}
const easIosReleaseRecord = {
  type: 'app-eas-ios-release-evidence',
  app_ios_bundle_identifier: baseline.app.ios_bundle_identifier,
  app_version: baseline.app.version,
  app_build_number: baseline.app.ios_build_number,
  eas_build: {
    id_sha256: hash,
    artifact: {
      url_sha256: hash,
    },
  },
  testflight: {
    build_id_sha256: hash,
  },
  summary: {
    run_mode: 'run',
    eas_query_passed: true,
    build_found: true,
    platform_ios: true,
    status_finished: true,
    distribution_store: true,
    profile_production: true,
    app_identifier_matches: true,
    app_version_matches: true,
    build_number_matches: true,
    artifact_url_present: true,
    artifact_head_passed: true,
    testflight_query_required: true,
    testflight_query_passed: true,
    testflight_build_found: true,
    testflight_version_matches: true,
    testflight_build_number_matches: true,
    testflight_processing_valid: true,
    testflight_not_expired: true,
    blocked: false,
  },
};

const evidenceFixturePairs = [
  {
    label: 'EAS iOS release',
    key: 'eas_ios_release',
    envKey: 'APP_EAS_IOS_RELEASE_EVIDENCE_FILE',
    record: easIosReleaseRecord,
    mutate: (record) => {
      record.summary.artifact_head_passed = false;
    },
    expectedErrorFragment: 'summary.artifact_head_passed',
  },
  {
    label: 'TestFlight',
    key: 'testflight',
    envKey: 'APP_TESTFLIGHT_EVIDENCE_FILE',
    record: easIosReleaseRecord,
    mutate: (record) => {
      record.summary.testflight_processing_valid = false;
    },
    expectedErrorFragment: 'summary.testflight_processing_valid',
  },
  {
    label: 'EAS Android release',
    key: 'eas_android_release',
    envKey: 'APP_EAS_ANDROID_RELEASE_EVIDENCE_FILE',
    record: {
      type: 'app-eas-android-release-evidence',
      app_android_package: baseline.app.android_package,
      app_version: baseline.app.version,
      app_version_code: String(baseline.app.android_version_code),
      eas_build: {
        id_sha256: hash,
        artifact: {
          url_sha256: hash,
        },
      },
      summary: {
        run_mode: 'run',
        eas_query_passed: true,
        build_found: true,
        platform_android: true,
        status_finished: true,
        distribution_store: true,
        profile_production: true,
        app_identifier_matches: true,
        app_version_matches: true,
        version_code_matches: true,
        artifact_url_present: true,
        artifact_head_passed: true,
        blocked: false,
      },
    },
    mutate: (record) => {
      record.summary.version_code_matches = false;
    },
    expectedErrorFragment: 'summary.version_code_matches',
  },
  {
    label: 'physical device',
    key: 'physical_device',
    envKey: 'APP_PHYSICAL_DEVICE_EVIDENCE_FILE',
    record: {
      type: 'app-physical-device-smoke',
      platform: 'ios',
      ...appIdentity,
      device: {
        is_physical: true,
        identifier_sha256: hash,
      },
      summary: {
        device_connected: true,
        device_is_physical: true,
        static_gate_passed: true,
        platform_readiness_passed: true,
        app_runtime_passed: true,
        maestro_smoke_passed: true,
        blocked: false,
      },
    },
    mutate: (record) => {
      record.app_ios_bundle_identifier = 'com.invalid.app';
    },
    expectedErrorFragment: 'app_ios_bundle_identifier',
  },
  {
    label: 'push delivery',
    key: 'push_delivery',
    envKey: 'APP_PUSH_DELIVERY_EVIDENCE_FILE',
    record: {
      type: 'app-push-provider-delivery-smoke',
      provider: 'expo',
      ...appIdentity,
      push_token: {
        sha256: hash,
        redacted: true,
      },
      payload: {
        source_path: '/notifications',
      },
      summary: {
        run_mode: 'run',
        provider_send_passed: true,
        ticket_accepted: true,
        receipt_checked: true,
        receipt_ok: true,
        blocked: false,
      },
    },
    mutate: (record) => {
      record.push_token.redacted = false;
    },
    expectedErrorFragment: 'push_token.redacted',
  },
  {
    label: 'native crash runtime',
    key: 'native_crash_runtime',
    envKey: 'APP_NATIVE_CRASH_EVIDENCE_FILE',
    record: {
      type: 'app-native-crash-runtime-evidence',
      provider: 'sentry',
      ...appIdentity,
      sentry: {
        event_id_sha256: hash,
      },
      expected: {
        release: expectedNativeCrashRelease,
        environment: 'production',
      },
      event: {
        release: expectedNativeCrashRelease,
        environment: 'production',
      },
      summary: {
        run_mode: 'run',
        provider_query_passed: true,
        event_found: true,
        release_matches: true,
        environment_matches: true,
        native_runtime_observed: true,
        crash_event_observed: true,
        blocked: false,
      },
    },
    mutate: (record) => {
      record.app_android_package = 'com.invalid.app';
    },
    expectedErrorFragment: 'app_android_package',
  },
  {
    label: 'telemetry runtime',
    key: 'telemetry_runtime',
    envKey: 'APP_TELEMETRY_RUNTIME_EVIDENCE_FILE',
    record: {
      type: 'app-telemetry-runtime-evidence',
      provider: 'backend',
      ...appIdentity,
      app_version: baseline.app.version,
      app_build_number: baseline.app.ios_build_number,
      app_version_code: String(baseline.app.android_version_code),
      api: {
        protocol: 'https',
        host_sha256: hash,
        base_path: '/api/v1',
        non_local: true,
        raw_url_redacted: true,
      },
      backend_version: {
        endpoint_path: '/version',
        host_sha256: hash,
        raw_url_redacted: true,
        response_status: 200,
        response_ok: true,
        service: 'backend',
        version: '1.3.4',
        commit_sha: currentGitHead,
        commit_short_sha: currentGitHead.slice(0, 7),
        expected_commit_sha: currentGitHead,
        expected_commit_short_sha: currentGitHead.slice(0, 7),
        expected_commit_source: 'git_rev_parse_head',
        commit_matches_expected: true,
      },
      request: {
        request_id_sha256: hash,
        session_id_sha256: hash,
        locale: 'zh-TW',
        authorization_present: false,
      },
      event: {
        request_id_sha256: hash,
      },
      otlp: {
        trace_id_sha256: hash,
        span_id_sha256: hash,
      },
      summary: {
        run_mode: 'run',
        api_non_local: true,
        backend_version_passed: true,
        event_ingest_passed: true,
        otlp_ingest_passed: true,
        event_accepted_count: 1,
        otlp_accepted_spans: 1,
        safe_payload: true,
        blocked: false,
      },
    },
    mutate: (record) => {
      record.summary.api_non_local = false;
    },
    expectedErrorFragment: 'summary.api_non_local',
  },
  {
    label: 'release DB parity',
    key: 'release_db_parity',
    envKey: 'APP_RELEASE_DB_PARITY_EVIDENCE_FILE',
    record: {
      type: 'app-release-db-parity-evidence',
      check: 'release-db-parity',
      ok: true,
      report: {
        check: 'release-db-parity',
        ok: true,
        requiredMigrationCount: releaseBlockingMigrationCount,
        appliedRequiredMigrationCount: releaseBlockingMigrationCount,
        missingRequiredMigrations: [],
        incompleteRequiredMigrations: [],
        failedMigrations: [],
      },
      target: {
        classification: 'release',
        database: {
          local: false,
          provider: 'postgresql',
        },
      },
    },
    mutate: (record) => {
      record.report.requiredMigrationCount = releaseBlockingMigrationCount - 1;
      record.report.appliedRequiredMigrationCount = releaseBlockingMigrationCount - 1;
    },
    expectedErrorFragment: 'report.requiredMigrationCount',
  },
];
for (const fixturePair of evidenceFixturePairs) {
  validateEvidenceFixturePair(fixturePair);
}

const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emorapy-release-status-report-'));
try {
  const reportResult = runStatus({}, [`--report-dir=${reportDir}`]);
  const reportStatus = parseJsonResult('status JSON with report dir', reportResult);
  validateStatus(reportStatus, 'status JSON with report dir');
  const reportFiles = fs
    .readdirSync(reportDir)
    .filter((entry) => entry.startsWith('App-External-Evidence-Status-') && entry.endsWith('.json'));
  if (reportFiles.length !== 1) {
    fail(`status report dir must contain exactly one App-External-Evidence-Status JSON, found ${reportFiles.length}`);
  }
  const reportRaw = fs.readFileSync(path.join(reportDir, reportFiles[0]), 'utf8');
  const reportJson = JSON.parse(reportRaw);
  validateStatus(reportJson, 'status report JSON');
  for (const secret of controlledSecrets) {
    if (reportRaw.includes(secret)) {
      fail(`status report leaked controlled secret: ${secret}`);
    }
  }
} finally {
  fs.rmSync(reportDir, { recursive: true, force: true });
}

console.log('[release-external-evidence-status-contract] ok: JSON schema valid, evidence candidates are type-aware and identity-bound, blockers are normalized, and controlled secrets are reduced to presence booleans');
