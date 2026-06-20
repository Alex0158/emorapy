import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'emorapy-release-signoff-prereq-'));
const missingAppPath = path.join(tempRoot, 'missing-signed-app.app');
const missingAscKeyPath = path.join(tempRoot, 'missing-asc-key.p8');
const releaseEnvExamplePath = path.join(repoRoot, 'mobile', 'release.env.example');

const sensitiveNeedles = [
  'expo-token-secret',
  'release@example.invalid',
  'apple-password-secret',
  'asc-issuer-id',
  'asc-key-id',
  'asc-private-secret',
  'sentry-token-secret',
  'native-event-secret',
  'push-token-secret',
  'db-password-secret',
  'postgresql://',
  'Bearer ',
  'ExpoPushToken[',
];

const forbiddenExternalStepNeedles = [
  '[release-external-signoff] start status:',
  '[release-external-signoff] start handoff:',
  '[release-external-signoff] start eas_ios_testflight:',
  '[release-external-signoff] start eas_android:',
  '[release-external-signoff] start physical_device:',
  '[release-external-signoff] start push_delivery:',
  '[release-external-signoff] start native_crash_runtime:',
  '[release-external-signoff] start telemetry_runtime:',
  '[release-external-signoff] start release_db_parity:',
  '[release-external-signoff] start release_completion_audit:',
  '[release-external-signoff] start goal_completion_audit:',
];
const skippableExternalStepIds = [
  'eas_ios_testflight',
  'eas_android',
  'physical_device',
  'push_delivery',
  'native_crash_runtime',
  'telemetry_runtime',
  'release_db_parity',
  'release_completion_audit',
  'goal_completion_audit',
];

function fail(message) {
  console.error(`[release-prereq-report-check] ${message}`);
  process.exitCode = 1;
}

function assertNoSensitiveLeaks(label, text) {
  const leaked = sensitiveNeedles.filter((needle) => text.includes(needle));
  if (leaked.length > 0) {
    fail(`${label} leaked sensitive values: ${leaked.join(', ')}`);
  }
}

function runCase({ label, args, expectedMode, expectedPhysicalPlatform = 'ios' }) {
  const caseDir = fs.mkdtempSync(path.join(tempRoot, `${label}-`));
  const result = spawnSync(
    process.execPath,
    [
      path.join(scriptDir, 'run-release-external-evidence-signoff.mjs'),
      '--run',
      ...args,
      `--report-dir=${caseDir}`,
    ],
    {
      cwd: path.join(repoRoot, 'mobile'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        EXPO_TOKEN: 'expo-token-secret',
        ASC_APPLE_ID: 'release@example.invalid',
        EXPO_APPLE_APP_SPECIFIC_PASSWORD: 'apple-password-secret',
        APP_STORE_CONNECT_ISSUER_ID: 'asc-issuer-id',
        APP_STORE_CONNECT_KEY_ID: 'asc-key-id',
        APP_STORE_CONNECT_PRIVATE_KEY_PATH: missingAscKeyPath,
        APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN: 'ExpoPushToken[push-token-secret]',
        APP_SENTRY_ORG: 'emorapy-org',
        APP_SENTRY_PROJECT: 'emorapy-mobile',
        APP_SENTRY_AUTH_TOKEN: 'sentry-token-secret',
        APP_NATIVE_CRASH_SENTRY_EVENT_ID: 'native-event-secret',
        APP_TELEMETRY_RUNTIME_API_BASE_URL: 'https://telemetry-runtime.example.invalid/api/v1',
        DATABASE_URL: 'postgresql://release:db-password-secret@release-db.example.invalid/emorapy',
        APP_IOS_DEVICE_UDID: '00000000-000000000000000000000000',
        APP_IOS_DEVICE_APP_PATH: missingAppPath,
        APP_EAS_IOS_REQUIRE_TESTFLIGHT: 'true',
      },
    }
  );

  if (result.status === 0) {
    fail(`${label} unexpectedly passed with intentionally missing EAS project / file prerequisites.`);
  }

  const output = `${result.stdout}\n${result.stderr}`;
  assertNoSensitiveLeaks(`${label} stdout/stderr`, output);

  const startedExternalSteps = forbiddenExternalStepNeedles.filter((needle) => output.includes(needle));
  if (startedExternalSteps.length > 0) {
    fail(`${label} started external sign-off steps before prerequisite failure: ${startedExternalSteps.join(', ')}`);
  }

  const reportFiles = fs
    .readdirSync(caseDir)
    .filter((entry) => entry.startsWith('App-External-Signoff-Prerequisites-') && entry.endsWith('.json'));

  if (reportFiles.length !== 1) {
    fail(`${label} expected exactly one prerequisite report, found ${reportFiles.length}.`);
  }

  const reportPath = path.join(caseDir, reportFiles[0] ?? '');
  const raw = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
  const report = raw ? JSON.parse(raw) : {};

  if (report.type !== 'app-external-signoff-prerequisites') {
    fail(`${label} report type must be app-external-signoff-prerequisites.`);
  }
  if (report.mode !== expectedMode) {
    fail(`${label} report mode must be ${expectedMode}.`);
  }
  if (report.ok !== false || report.summary?.blocked !== true) {
    fail(`${label} report must be blocked and ok=false for intentionally missing prerequisites.`);
  }
  if (!Number.isInteger(report.summary?.missing_count) || report.summary.missing_count < 1) {
    fail(`${label} report must include a positive missing_count.`);
  }
  if (!Array.isArray(report.missing_prerequisites) || report.missing_prerequisites.length < 1) {
    fail(`${label} report must include missing_prerequisites.`);
  }
  if (!Array.isArray(report.resolution_hints) || report.resolution_hints.length !== report.missing_prerequisites.length) {
    fail(`${label} report must include one resolution_hints entry per missing prerequisite.`);
  }
  const missingIds = report.missing_prerequisites.map((entry) => entry.id);
  const hintIds = report.resolution_hints.map((entry) => entry.id);
  for (const id of missingIds) {
    if (!hintIds.includes(id)) {
      fail(`${label} resolution_hints must include missing prerequisite id ${id}.`);
    }
  }
  for (const hint of report.resolution_hints) {
    for (const key of ['id', 'message', 'owner_surface', 'action']) {
      if (!hint[key]) fail(`${label} resolution hint ${hint.id ?? '<unknown>'} must include ${key}.`);
    }
    if (!Array.isArray(hint.required_env_keys)) {
      fail(`${label} resolution hint ${hint.id} must include required_env_keys array.`);
    }
    if (!Array.isArray(hint.commands) || hint.commands.length < 1) {
      fail(`${label} resolution hint ${hint.id} must include command hints.`);
    }
    if (!Array.isArray(hint.docs) || hint.docs.length < 1) {
      fail(`${label} resolution hint ${hint.id} must include docs.`);
    }
  }
  if (!report.resolution_hints.some((entry) => entry.id === 'eas_project_id' && entry.owner_surface === 'Expo / EAS project setup')) {
    fail(`${label} resolution hints must map eas_project_id to Expo / EAS project setup.`);
  }
  if (
    expectedPhysicalPlatform === 'ios' &&
    !report.resolution_hints.some((entry) => entry.id === 'ios_signed_app_path' && entry.required_env_keys.includes('APP_IOS_DEVICE_APP_PATH'))
  ) {
    fail(`${label} resolution hints must map ios_signed_app_path to APP_IOS_DEVICE_APP_PATH.`);
  }
  if (report.summary?.report_contains_secrets !== false) {
    fail(`${label} report_contains_secrets must be false.`);
  }
  if (typeof report.tools?.eas_cli_available !== 'boolean') {
    fail(`${label} report must include tools.eas_cli_available boolean.`);
  }
  for (const key of [
    'expo_token_present',
    'apple_submission_credentials_present',
    'app_store_connect_api_credentials_present',
    'physical_device_input_present',
    'signed_app_input_present',
    'push_delivery_token_present',
    'sentry_runtime_query_credentials_present',
    'native_crash_event_id_present',
    'telemetry_runtime_api_base_url_present',
    'release_database_url_present',
  ]) {
    if (typeof report.credentials?.[key] !== 'boolean') {
      fail(`${label} report must include credentials.${key} boolean.`);
    }
  }
  const iosVisibility = report.device_visibility?.ios ?? {};
  for (const key of ['ok', 'requested_device_provided']) {
    if (typeof iosVisibility[key] !== 'boolean') {
      fail(`${label} report must include device_visibility.ios.${key} boolean.`);
    }
  }
  for (const key of ['physical_connected', 'physical_offline', 'simulators']) {
    if (!Number.isInteger(iosVisibility[key])) {
      fail(`${label} report must include device_visibility.ios.${key} integer.`);
    }
  }
  if (iosVisibility.requested_device_visible !== null && typeof iosVisibility.requested_device_visible !== 'boolean') {
    fail(`${label} report must include device_visibility.ios.requested_device_visible as boolean or null.`);
  }
  const androidVisibility = report.device_visibility?.android ?? {};
  for (const key of ['ok', 'requested_device_provided']) {
    if (typeof androidVisibility[key] !== 'boolean') {
      fail(`${label} report must include device_visibility.android.${key} boolean.`);
    }
  }
  for (const key of ['physical_connected', 'emulator_connected', 'unauthorized_or_offline']) {
    if (!Number.isInteger(androidVisibility[key])) {
      fail(`${label} report must include device_visibility.android.${key} integer.`);
    }
  }
  if (androidVisibility.requested_device_visible !== null && typeof androidVisibility.requested_device_visible !== 'boolean') {
    fail(`${label} report must include device_visibility.android.requested_device_visible as boolean or null.`);
  }
  const physicalDeviceVisibilityIds =
    expectedPhysicalPlatform === 'android'
      ? ['android_physical_device_discovery', 'android_physical_device_visible', 'android_physical_device_match']
      : ['ios_physical_device_discovery', 'ios_physical_device_visible', 'ios_physical_device_match'];
  if (!missingIds.some((id) => physicalDeviceVisibilityIds.includes(id))) {
    fail(`${label} report must block on ${expectedPhysicalPlatform} physical-device visibility before external sign-off run mode.`);
  }

  assertNoSensitiveLeaks(`${label} report`, raw);

  return report.summary.missing_count;
}

function runRejectedSkipCase() {
  const result = spawnSync(
    process.execPath,
    [path.join(scriptDir, 'run-release-external-evidence-signoff.mjs'), '--run', '--skip=goal_completion_audit'],
    {
      cwd: path.join(repoRoot, 'mobile'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        EXPO_TOKEN: 'expo-token-secret',
      },
    }
  );

  if (result.status === 0) {
    fail('run-skip unexpectedly passed; release:external-evidence:run must not allow skipped steps.');
  }

  const output = `${result.stdout}\n${result.stderr}`;
  assertNoSensitiveLeaks('run-skip stdout/stderr', output);

  if (
    !output.includes(
      '--skip is only allowed for dry-run or validate-only; release:external-evidence:run must execute every evidence step and strict audit.'
    )
  ) {
    fail('run-skip must explain that formal run mode cannot skip evidence or strict audit steps.');
  }

  const startedExternalSteps = forbiddenExternalStepNeedles.filter((needle) => output.includes(needle));
  if (startedExternalSteps.length > 0) {
    fail(`run-skip started external sign-off steps before rejecting skipped run mode: ${startedExternalSteps.join(', ')}`);
  }
}

function runPlaceholderEnvFileCase() {
  const caseDir = fs.mkdtempSync(path.join(tempRoot, 'placeholder-env-file-'));
  const result = spawnSync(
    process.execPath,
    [
      path.join(scriptDir, 'run-release-external-evidence-signoff.mjs'),
      '--run',
      '--validate-only',
      `--release-env-file=${releaseEnvExamplePath}`,
      `--report-dir=${caseDir}`,
    ],
    {
      cwd: path.join(repoRoot, 'mobile'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
      },
    }
  );

  if (result.status === 0) {
    fail('placeholder-env-file unexpectedly passed; REPLACE_WITH_ placeholders must not satisfy release prerequisites.');
  }

  const output = `${result.stdout}\n${result.stderr}`;
  assertNoSensitiveLeaks('placeholder-env-file stdout/stderr', output);
  if (!output.includes('env-file mobile/release.env.example loaded_keys=')) {
    fail('placeholder-env-file must report that the env file was loaded without printing values.');
  }

  const reportFiles = fs
    .readdirSync(caseDir)
    .filter((entry) => entry.startsWith('App-External-Signoff-Prerequisites-') && entry.endsWith('.json'));
  if (reportFiles.length !== 1) {
    fail(`placeholder-env-file expected exactly one prerequisite report, found ${reportFiles.length}.`);
  }

  const reportPath = path.join(caseDir, reportFiles[0] ?? '');
  const raw = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
  const report = raw ? JSON.parse(raw) : {};
  const missingIds = report.missing_prerequisites?.map((entry) => entry.id) ?? [];

  for (const [key, expected] of Object.entries({
    expo_token_present: false,
    apple_submission_credentials_present: false,
    app_store_connect_api_credentials_present: false,
    physical_device_input_present: false,
    signed_app_input_present: false,
    push_delivery_token_present: false,
    sentry_runtime_query_credentials_present: false,
    native_crash_event_id_present: false,
    telemetry_runtime_api_base_url_present: false,
    release_database_url_present: false,
  })) {
    if (report.credentials?.[key] !== expected) {
      fail(`placeholder-env-file credentials.${key} must be ${expected}; placeholder values cannot count as configured.`);
    }
  }

  for (const id of [
    'expo_token',
    'apple_submission_credentials',
    'asc_issuer_id',
    'asc_key_id',
    'asc_private_key',
    'ios_physical_device_id',
    'ios_signed_app_path',
    'push_delivery_token',
    'sentry_org',
    'sentry_project',
    'sentry_auth_token',
    'native_crash_event_id',
    'telemetry_runtime_api_base_url',
    'release_database_url',
  ]) {
    if (!missingIds.includes(id)) {
      fail(`placeholder-env-file must still report missing prerequisite ${id}.`);
    }
  }

  assertNoSensitiveLeaks('placeholder-env-file report', raw);
  return report.summary?.missing_count ?? missingIds.length;
}

function runRejectedEnvFileKeyCase() {
  const envFilePath = path.join(tempRoot, 'unsafe-release.env.local');
  fs.writeFileSync(envFilePath, 'NODE_OPTIONS=--require=/tmp/unsafe-release-hook.js\nEXPO_TOKEN=expo-token-secret\n');
  const result = spawnSync(
    process.execPath,
    [
      path.join(scriptDir, 'run-release-external-evidence-signoff.mjs'),
      '--run',
      '--validate-only',
      `--release-env-file=${envFilePath}`,
    ],
    {
      cwd: path.join(repoRoot, 'mobile'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
      },
    }
  );

  if (result.status === 0) {
    fail('unsafe-env-file-key unexpectedly passed; unsupported env-file keys must be rejected before validation.');
  }

  const output = `${result.stdout}\n${result.stderr}`;
  assertNoSensitiveLeaks('unsafe-env-file-key stdout/stderr', output);
  if (!output.includes('unsupported --release-env-file key: NODE_OPTIONS')) {
    fail('unsafe-env-file-key must explain that NODE_OPTIONS is not a supported release env-file key.');
  }
  const startedExternalSteps = forbiddenExternalStepNeedles.filter((needle) => output.includes(needle));
  if (startedExternalSteps.length > 0) {
    fail(`unsafe-env-file-key started external sign-off steps before rejecting env-file key: ${startedExternalSteps.join(', ')}`);
  }
}

function runDryRunStatusReportCase() {
  const caseDir = fs.mkdtempSync(path.join(tempRoot, 'dry-run-status-report-'));
  const result = spawnSync(
    process.execPath,
    [
      path.join(scriptDir, 'run-release-external-evidence-signoff.mjs'),
      '--dry-run',
      ...skippableExternalStepIds.map((stepId) => `--skip=${stepId}`),
      `--report-dir=${caseDir}`,
    ],
    {
      cwd: path.join(repoRoot, 'mobile'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        EXPO_TOKEN: 'expo-token-secret',
        APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN: 'ExpoPushToken[push-token-secret]',
        DATABASE_URL: 'postgresql://release:db-password-secret@release-db.example.invalid/emorapy',
      },
    }
  );

  if (result.status !== 0) {
    fail(`dry-run-status-report failed unexpectedly: ${result.stderr.trim() || result.stdout.trim()}`);
  }

  const output = `${result.stdout}\n${result.stderr}`;
  assertNoSensitiveLeaks('dry-run-status-report stdout/stderr', output);
  if (!output.includes('[release-external-signoff] start status:')) {
    fail('dry-run-status-report must run the status step.');
  }
  if (!output.includes('[release-external-signoff] start handoff:')) {
    fail('dry-run-status-report must run the handoff step.');
  }

  const startedExternalSteps = forbiddenExternalStepNeedles
    .filter((needle) => ![
      '[release-external-signoff] start status:',
      '[release-external-signoff] start handoff:',
    ].includes(needle))
    .filter((needle) => output.includes(needle));
  if (startedExternalSteps.length > 0) {
    fail(`dry-run-status-report unexpectedly started skipped external steps: ${startedExternalSteps.join(', ')}`);
  }

  const statusReportFiles = fs
    .readdirSync(caseDir)
    .filter((entry) => entry.startsWith('App-External-Evidence-Status-') && entry.endsWith('.json'));

  if (statusReportFiles.length !== 1) {
    fail(`dry-run-status-report expected exactly one status report, found ${statusReportFiles.length}.`);
  }

  const statusReportPath = path.join(caseDir, statusReportFiles[0] ?? '');
  const statusRaw = fs.existsSync(statusReportPath) ? fs.readFileSync(statusReportPath, 'utf8') : '';
  const statusReport = statusRaw ? JSON.parse(statusRaw) : {};

  if (statusReport.type !== 'app-external-evidence-status') {
    fail('dry-run-status-report type must be app-external-evidence-status.');
  }
  if (!Array.isArray(statusReport.blockers) || statusReport.blockers.length < 1) {
    fail('dry-run-status-report must include normalized blockers.');
  }
  if (!statusReport.blockers.some((entry) => entry.id === 'eas_project_id')) {
    fail('dry-run-status-report blockers must include eas_project_id in the current environment.');
  }
  if (!statusReport.blockers.some((entry) => entry.id === 'native_crash_event_id')) {
    fail('dry-run-status-report blockers must include native_crash_event_id when no controlled crash event id is provided.');
  }
  if (!statusReport.blockers.some((entry) => entry.id === 'sentry_runtime_query_credentials')) {
    fail('dry-run-status-report blockers must include sentry_runtime_query_credentials when no Sentry query credentials are provided.');
  }
  if (statusReport.credentials?.sentry_runtime_query_credentials_present !== false) {
    fail('dry-run-status-report credentials.sentry_runtime_query_credentials_present must be false without Sentry org / project / auth token.');
  }
  if (statusReport.credentials?.native_crash_event_id_present !== false) {
    fail('dry-run-status-report credentials.native_crash_event_id_present must be false without APP_NATIVE_CRASH_SENTRY_EVENT_ID / SENTRY_EVENT_ID.');
  }
  if (statusReport.evidence?.eas_ios_release?.state !== 'missing') {
    fail('dry-run-status-report must preserve structured evidence candidate state.');
  }

  assertNoSensitiveLeaks('dry-run-status-report status report', statusRaw);

  const handoffReportFiles = fs
    .readdirSync(caseDir)
    .filter((entry) => entry.startsWith('App-External-Evidence-Handoff-') && entry.endsWith('.json'));

  if (handoffReportFiles.length !== 1) {
    fail(`dry-run-status-report expected exactly one handoff report, found ${handoffReportFiles.length}.`);
  }

  const handoffReportPath = path.join(caseDir, handoffReportFiles[0] ?? '');
  const handoffRaw = fs.existsSync(handoffReportPath) ? fs.readFileSync(handoffReportPath, 'utf8') : '';
  const handoffReport = handoffRaw ? JSON.parse(handoffRaw) : {};

  if (handoffReport.type !== 'app-external-evidence-handoff') {
    fail('dry-run-status-report handoff type must be app-external-evidence-handoff.');
  }
  if (handoffReport.source_status_type !== 'app-external-evidence-status') {
    fail('dry-run-status-report handoff must reference the external evidence status report type.');
  }
  if (handoffReport.summary?.blocker_count !== statusReport.blockers.length) {
    fail('dry-run-status-report handoff blocker_count must match the status blocker count.');
  }
  if (!Array.isArray(handoffReport.items) || handoffReport.items.length !== statusReport.blockers.length) {
    fail('dry-run-status-report handoff must include one owner action item per status blocker.');
  }
  if (!handoffReport.items.some((entry) => entry.blocker_id === 'eas_project_id')) {
    fail('dry-run-status-report handoff items must include eas_project_id.');
  }
  const nativeCrashEventIdItem = handoffReport.items.find((entry) => entry.blocker_id === 'native_crash_event_id');
  const sentryCredentialsItem = handoffReport.items.find((entry) => entry.blocker_id === 'sentry_runtime_query_credentials');
  if (!sentryCredentialsItem) {
    fail('dry-run-status-report handoff items must include sentry_runtime_query_credentials.');
  } else {
    if (sentryCredentialsItem.prerequisite_only !== true || sentryCredentialsItem.release_completion_blocker !== false) {
      fail('dry-run-status-report sentry_runtime_query_credentials handoff item must be prerequisite-only, not a release completion blocker.');
    }
    if (!sentryCredentialsItem.required_env_keys?.includes('APP_SENTRY_AUTH_TOKEN or SENTRY_AUTH_TOKEN')) {
      fail('dry-run-status-report sentry_runtime_query_credentials handoff item must include the Sentry auth token env key.');
    }
  }
  if (!nativeCrashEventIdItem) {
    fail('dry-run-status-report handoff items must include native_crash_event_id.');
  } else {
    if (nativeCrashEventIdItem.prerequisite_only !== true || nativeCrashEventIdItem.release_completion_blocker !== false) {
      fail('dry-run-status-report native_crash_event_id handoff item must be prerequisite-only, not a release completion blocker.');
    }
    if (!nativeCrashEventIdItem.required_env_keys?.includes('APP_NATIVE_CRASH_SENTRY_EVENT_ID or SENTRY_EVENT_ID')) {
      fail('dry-run-status-report native_crash_event_id handoff item must include the controlled crash event id env key.');
    }
  }
  if (!handoffReport.items.every((entry) => entry.owner_surface && entry.accepted_evidence && entry.strict_gate)) {
    fail('dry-run-status-report handoff items must include owner_surface, accepted_evidence, and strict_gate.');
  }
  if (
    !Array.isArray(handoffReport.final_gates) ||
    !handoffReport.final_gates.includes('npm --prefix mobile run release:completion:audit:strict') ||
    !handoffReport.final_gates.includes('npm --prefix mobile run goal:completion:audit:strict')
  ) {
    fail('dry-run-status-report handoff must include final strict release and goal gates.');
  }
  if (handoffReport.summary?.known_blocker_count !== 16) {
    fail('dry-run-status-report handoff summary must expose the 16-item known blocker catalog.');
  }
  const releaseCompletionItemCount = handoffReport.items.filter(
    (entry) => entry.release_completion_blocker === true
  ).length;
  const prerequisiteOnlyItemCount = handoffReport.items.filter(
    (entry) => entry.prerequisite_only === true
  ).length;
  if (handoffReport.summary?.release_completion_handoff_blocker_count !== releaseCompletionItemCount) {
    fail('dry-run-status-report controlled handoff summary must match release completion handoff item count.');
  }
  if (handoffReport.summary?.prerequisite_only_blocker_count !== prerequisiteOnlyItemCount) {
    fail('dry-run-status-report controlled handoff summary must match prerequisite-only item count.');
  }

  assertNoSensitiveLeaks('dry-run-status-report handoff report', handoffRaw);

  return {
    statusBlockers: statusReport.blockers.length,
    handoffItems: handoffReport.items.length,
    knownBlockerCount: handoffReport.summary.known_blocker_count,
    releaseCompletionHandoffBlockerCount: handoffReport.summary.release_completion_handoff_blocker_count,
    prerequisiteOnlyBlockerCount: handoffReport.summary.prerequisite_only_blocker_count,
  };
}

function runDryRunEnvFileStatusProvenanceCase() {
  const caseDir = fs.mkdtempSync(path.join(tempRoot, 'dry-run-env-file-status-'));
  const envFilePath = path.join(caseDir, 'release.env.local');
  fs.writeFileSync(
    envFilePath,
    [
      'EXPO_TOKEN=expo-token-secret',
      'APP_TELEMETRY_RUNTIME_API_BASE_URL=https://telemetry-runtime.example.invalid/api/v1',
      'DATABASE_URL=postgresql://release:db-password-secret@release-db.example.invalid/emorapy',
      '',
    ].join('\n')
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(scriptDir, 'run-release-external-evidence-signoff.mjs'),
      '--dry-run',
      `--release-env-file=${envFilePath}`,
      ...skippableExternalStepIds.map((stepId) => `--skip=${stepId}`),
      `--report-dir=${caseDir}`,
    ],
    {
      cwd: path.join(repoRoot, 'mobile'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
      },
    }
  );

  if (result.status !== 0) {
    fail(`dry-run-env-file-status failed unexpectedly: ${result.stderr.trim() || result.stdout.trim()}`);
  }

  const output = `${result.stdout}\n${result.stderr}`;
  assertNoSensitiveLeaks('dry-run-env-file-status stdout/stderr', output);
  if (!output.includes('[release-external-signoff] env-file')) {
    fail('dry-run-env-file-status must print redacted env-file counters from the orchestrator.');
  }

  const statusReportFiles = fs
    .readdirSync(caseDir)
    .filter((entry) => entry.startsWith('App-External-Evidence-Status-') && entry.endsWith('.json'));

  if (statusReportFiles.length !== 1) {
    fail(`dry-run-env-file-status expected exactly one status report, found ${statusReportFiles.length}.`);
  }

  const statusReportPath = path.join(caseDir, statusReportFiles[0] ?? '');
  const statusRaw = fs.existsSync(statusReportPath) ? fs.readFileSync(statusReportPath, 'utf8') : '';
  const statusReport = statusRaw ? JSON.parse(statusRaw) : {};

  if (statusReport.env_files?.values_redacted !== true) {
    fail('dry-run-env-file-status status report must mark env_files.values_redacted=true.');
  }
  if (!Array.isArray(statusReport.env_files?.loaded) || statusReport.env_files.loaded.length !== 1) {
    fail('dry-run-env-file-status status report must record one redacted loaded env file.');
  }
  const envFileEntry = statusReport.env_files.loaded[0] ?? {};
  if (envFileEntry.loaded_keys !== 3) {
    fail(`dry-run-env-file-status status report loaded_keys must be 3, got ${envFileEntry.loaded_keys}.`);
  }
  if (envFileEntry.kept_existing_keys !== 0) {
    fail(`dry-run-env-file-status status report kept_existing_keys must be 0, got ${envFileEntry.kept_existing_keys}.`);
  }
  if (statusReport.credentials?.expo_token_present !== true) {
    fail('dry-run-env-file-status credentials.expo_token_present must be true when EXPO_TOKEN comes from env file.');
  }
  if (statusReport.credentials?.telemetry_runtime_api_base_url_present !== true) {
    fail('dry-run-env-file-status credentials.telemetry_runtime_api_base_url_present must be true when telemetry URL comes from env file.');
  }
  if (statusReport.credentials?.release_database_url_present !== true) {
    fail('dry-run-env-file-status credentials.release_database_url_present must be true when DATABASE_URL comes from env file.');
  }
  assertNoSensitiveLeaks('dry-run-env-file-status status report', statusRaw);

  return envFileEntry.loaded_keys;
}

try {
  const validateMissingCount = runCase({
    label: 'validate-only',
    args: ['--validate-only'],
    expectedMode: 'validate',
  });
  const runMissingCount = runCase({
    label: 'run',
    args: [],
    expectedMode: 'run',
  });
  const androidValidateMissingCount = runCase({
    label: 'android-validate-only',
    args: ['--validate-only', '--physical-platform=android'],
    expectedMode: 'validate',
    expectedPhysicalPlatform: 'android',
  });
  const placeholderEnvMissingCount = runPlaceholderEnvFileCase();
  runRejectedEnvFileKeyCase();
  runRejectedSkipCase();
  const dryRunReports = runDryRunStatusReportCase();
  const dryRunEnvFileStatusKeys = runDryRunEnvFileStatusProvenanceCase();

  if (process.exitCode) {
    process.exit(process.exitCode);
  }

  console.log(
    `[release-prereq-report-check] ok: validate/run blocked before external steps, Android validate blocks on device visibility, env-file placeholders remain missing, unsafe env-file keys are rejected, skipped run mode is rejected, prerequisite reports include safe resolution hints, and dry-run status/handoff reports are written with env-file provenance (${validateMissingCount}/${runMissingCount}/${androidValidateMissingCount}/${placeholderEnvMissingCount} missing, controlled dry-run blockers=${dryRunReports.statusBlockers}, handoff items=${dryRunReports.handoffItems}, known catalog=${dryRunReports.knownBlockerCount}, release handoff blockers=${dryRunReports.releaseCompletionHandoffBlockerCount}, prerequisite-only=${dryRunReports.prerequisiteOnlyBlockerCount}, env-file status keys=${dryRunEnvFileStatusKeys})`
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
