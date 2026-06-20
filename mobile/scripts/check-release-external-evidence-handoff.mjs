import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const releaseCompletionAuditScript = path.join(scriptDir, 'check-release-completion-audit.mjs');
const reportDirArg = process.argv.find((arg) => arg.startsWith('--report-dir='));
const reportDir = reportDirArg ? path.resolve(process.cwd(), reportDirArg.slice('--report-dir='.length)) : null;
const json = process.argv.includes('--json');

const knownBlockerIds = [
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
  'ios_physical_device_visible',
  'android_physical_device_visible',
];

const docs = {
  runbook: 'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-External-Release-Signoff-Runbook-2026-05-08.md',
  releaseHardening: 'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md',
  testBaseline: 'docs/核心開發文件/08-測試規範與驗收/03-App測試與證據接入基線.md',
  roadmap: 'docs/核心開發文件/20-App端/03-App完整版本開發Roadmap.md',
};

const actionCatalog = {
  eas_project_id: {
    owner_surface: 'Expo / EAS project setup',
    required_env_keys: ['APP_EAS_PROJECT_FULL_NAME'],
    action:
      'Bind mobile/app.json to the Emorapy EAS project and confirm the EAS full name matches @alexdev518/emorapy-mobile. Placeholder UUIDs, the legacy cj-mobile project name, and eas project:init --force as a rename workaround are not accepted.',
    commands: [
      'cd mobile && npx eas-cli@20.3.0 project:info --non-interactive',
      'APP_EAS_PROJECT_FULL_NAME=@alexdev518/emorapy-mobile npm --prefix mobile run release:external-evidence:status',
      'npm --prefix mobile run release:external-evidence:status',
    ],
    accepted_evidence: [
      'mobile/app.json expo.extra.eas.projectId is a real UUID-shaped EAS project id',
      'APP_EAS_PROJECT_FULL_NAME matches mobile/app.json owner/slug after EAS dashboard rename or new Emorapy project link',
      'cd mobile && npx eas-cli@20.3.0 project:info --non-interactive reports fullName @alexdev518/emorapy-mobile without changing mobile/app.json slug',
    ],
    strict_gate: 'npm --prefix mobile run release:completion:audit:strict',
    docs: [docs.runbook, docs.releaseHardening],
  },
  expo_token: {
    owner_surface: 'Expo / EAS credentials',
    required_env_keys: ['EXPO_TOKEN'],
    action: 'Provide a non-interactive Expo access token for EAS metadata queries.',
    commands: [
      'EXPO_TOKEN=<expo-access-token> npm --prefix mobile run release:external-evidence:validate',
    ],
    accepted_evidence: ['release prerequisite report shows expo_token_present=true'],
    strict_gate: 'npm --prefix mobile run release:external-evidence:run',
    docs: [docs.runbook, docs.testBaseline],
  },
  apple_submission_credentials: {
    owner_surface: 'Apple submission credentials',
    required_env_keys: ['ASC_APPLE_ID', 'EXPO_APPLE_APP_SPECIFIC_PASSWORD'],
    action: 'Provide Apple account and app-specific password needed by non-interactive submit readiness.',
    commands: [
      'ASC_APPLE_ID=<apple-id> EXPO_APPLE_APP_SPECIFIC_PASSWORD=<app-specific-password> npm --prefix mobile run release:external-evidence:validate',
    ],
    accepted_evidence: ['release prerequisite report shows apple_submission_credentials_present=true'],
    strict_gate: 'npm --prefix mobile run release:external-evidence:run',
    docs: [docs.runbook],
  },
  app_store_connect_api_credentials: {
    owner_surface: 'App Store Connect API',
    required_env_keys: [
      'APP_STORE_CONNECT_ISSUER_ID',
      'APP_STORE_CONNECT_KEY_ID',
      'APP_STORE_CONNECT_PRIVATE_KEY or APP_STORE_CONNECT_PRIVATE_KEY_PATH',
    ],
    action: 'Provide ASC API credentials so TestFlight build state can be queried as structured evidence.',
    commands: [
      'APP_STORE_CONNECT_ISSUER_ID=<issuer> APP_STORE_CONNECT_KEY_ID=<key-id> APP_STORE_CONNECT_PRIVATE_KEY_PATH=<p8-path> npm --prefix mobile run release:external-evidence:validate',
    ],
    accepted_evidence: ['release prerequisite report shows app_store_connect_api_credentials_present=true'],
    strict_gate: 'npm --prefix mobile run release:external-evidence:run -- --physical-platform=ios',
    docs: [docs.runbook, docs.releaseHardening],
  },
  sentry_runtime_query_credentials: {
    owner_surface: 'Sentry native crash runtime',
    required_env_keys: ['APP_SENTRY_ORG or SENTRY_ORG', 'APP_SENTRY_PROJECT or SENTRY_PROJECT', 'APP_SENTRY_AUTH_TOKEN or SENTRY_AUTH_TOKEN'],
    action:
      'Provide Sentry query credentials for the Emorapy mobile project so the runtime evidence runner can look up the controlled native crash event. The project slug must resolve to emorapy-mobile.',
    commands: [
      'APP_SENTRY_ORG=<org> APP_SENTRY_PROJECT=emorapy-mobile APP_SENTRY_AUTH_TOKEN=<token> npm --prefix mobile run release:external-evidence:validate',
      'APP_SENTRY_ORG=<org> APP_SENTRY_PROJECT=emorapy-mobile APP_SENTRY_AUTH_TOKEN=<token> APP_NATIVE_CRASH_SENTRY_EVENT_ID=<event-id> npm --prefix mobile run native-crash:runtime:smoke -- --run',
    ],
    accepted_evidence: [
      'release status shows credentials.sentry_runtime_query_credentials_present=true',
      'App-Native-Crash-Runtime-*.json with summary.provider_query_passed=true and blocked=false',
    ],
    strict_gate: 'npm --prefix mobile run native-crash:runtime:smoke -- --run',
    docs: [docs.runbook, docs.releaseHardening],
  },
  native_crash_event_id: {
    owner_surface: 'Sentry native crash runtime',
    required_env_keys: ['APP_NATIVE_CRASH_SENTRY_EVENT_ID or SENTRY_EVENT_ID'],
    action: 'Provide the controlled native crash event id that the runtime evidence runner will query.',
    commands: [
      'APP_NATIVE_CRASH_SENTRY_EVENT_ID=<controlled-event-id> npm --prefix mobile run release:external-evidence:validate',
      'APP_SENTRY_ORG=<org> APP_SENTRY_PROJECT=emorapy-mobile APP_SENTRY_AUTH_TOKEN=<token> APP_NATIVE_CRASH_SENTRY_EVENT_ID=<event-id> npm --prefix mobile run native-crash:runtime:smoke -- --run',
    ],
    accepted_evidence: [
      'release status shows credentials.native_crash_event_id_present=true',
      'App-Native-Crash-Runtime-*.json with sentry.event_id_sha256 and blocked=false',
    ],
    strict_gate: 'npm --prefix mobile run native-crash:runtime:smoke -- --run',
    docs: [docs.runbook, docs.releaseHardening],
  },
  eas_ios_release_evidence: {
    owner_surface: 'EAS iOS production build',
    required_env_keys: ['EXPO_TOKEN'],
    action: 'Generate pass-state EAS iOS production store build evidence for the current bundle id, version, and build number.',
    commands: [
      'EXPO_TOKEN=<expo-access-token> npm --prefix mobile run eas-ios-release:smoke -- --run --require-testflight',
    ],
    accepted_evidence: ['docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-EAS-iOS-Release-*.json'],
    strict_gate: 'npm --prefix mobile run release:completion:audit:strict',
    docs: [docs.runbook, docs.testBaseline],
  },
  testflight_evidence: {
    owner_surface: 'App Store Connect / TestFlight',
    required_env_keys: [
      'APP_STORE_CONNECT_ISSUER_ID',
      'APP_STORE_CONNECT_KEY_ID',
      'APP_STORE_CONNECT_PRIVATE_KEY or APP_STORE_CONNECT_PRIVATE_KEY_PATH',
    ],
    action: 'Query TestFlight and prove the matching build is present, valid, and not expired.',
    commands: [
      'APP_STORE_CONNECT_ISSUER_ID=<issuer> APP_STORE_CONNECT_KEY_ID=<key-id> APP_STORE_CONNECT_PRIVATE_KEY_PATH=<p8-path> npm --prefix mobile run eas-ios-release:smoke -- --run --require-testflight',
    ],
    accepted_evidence: ['App-EAS-iOS-Release-*.json with testflight_query_passed=true and blocked=false'],
    strict_gate: 'npm --prefix mobile run release:completion:audit:strict',
    docs: [docs.runbook, docs.releaseHardening],
  },
  eas_android_release_evidence: {
    owner_surface: 'EAS Android production build',
    required_env_keys: ['EXPO_TOKEN'],
    action: 'Generate pass-state EAS Android production store build evidence for the current package, version, and versionCode.',
    commands: [
      'EXPO_TOKEN=<expo-access-token> npm --prefix mobile run eas-android-release:smoke -- --run',
    ],
    accepted_evidence: ['docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-EAS-Android-Release-*.json'],
    strict_gate: 'npm --prefix mobile run release:completion:audit:strict',
    docs: [docs.runbook, docs.testBaseline],
  },
  physical_device_evidence: {
    owner_surface: 'Trusted physical device runner',
    required_env_keys: ['APP_IOS_DEVICE_UDID or APP_ANDROID_DEVICE_SERIAL', 'APP_IOS_DEVICE_APP_PATH for iOS'],
    action: 'Run native smoke on a connected physical device; simulator and emulator evidence are not accepted.',
    commands: [
      'APP_IOS_DEVICE_UDID=<trusted-device-udid> APP_IOS_DEVICE_APP_PATH=<signed-app-path> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=ios --report-dir=<report-dir>',
      'APP_IOS_DEVICE_UDID=<trusted-device-udid> APP_IOS_DEVICE_APP_PATH=<signed-app-path> npm --prefix mobile run release:external-evidence:run -- --physical-platform=ios --report-dir=<report-dir>',
      'APP_IOS_DEVICE_UDID=<trusted-device-udid> APP_IOS_DEVICE_APP_PATH=<signed-app-path> npm --prefix mobile run physical-device:smoke -- --platform=ios --run',
      'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=android --report-dir=<report-dir>',
      'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial> npm --prefix mobile run release:external-evidence:run -- --physical-platform=android --report-dir=<report-dir>',
      'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial> npm --prefix mobile run physical-device:smoke -- --platform=android --run',
    ],
    accepted_evidence: ['docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Physical-Device-*.json'],
    strict_gate: 'npm --prefix mobile run release:completion:audit:strict',
    docs: [docs.runbook, docs.releaseHardening],
  },
  push_delivery_evidence: {
    owner_surface: 'Expo push provider',
    required_env_keys: ['APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN', 'APP_PUSH_DELIVERY_ACCESS_TOKEN optional'],
    action: 'Send a controlled push and poll the provider receipt until accepted and ok.',
    commands: [
      'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN=<expo-push-token> npm --prefix mobile run push-delivery:smoke -- --run',
    ],
    accepted_evidence: ['docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Push-Delivery-*.json'],
    strict_gate: 'npm --prefix mobile run release:completion:audit:strict',
    docs: [docs.runbook, docs.testBaseline],
  },
  native_crash_runtime_evidence: {
    owner_surface: 'Sentry native crash runtime',
    required_env_keys: [
      'APP_SENTRY_ORG',
      'APP_SENTRY_PROJECT',
      'APP_SENTRY_AUTH_TOKEN',
      'APP_NATIVE_CRASH_SENTRY_EVENT_ID',
    ],
    action:
      'Query a controlled native crash event in the emorapy-mobile Sentry project and prove release, environment, native runtime, and crash-like signal.',
    commands: [
      'APP_SENTRY_ORG=<org> APP_SENTRY_PROJECT=emorapy-mobile APP_SENTRY_AUTH_TOKEN=<token> APP_NATIVE_CRASH_SENTRY_EVENT_ID=<event-id> npm --prefix mobile run native-crash:runtime:smoke -- --run',
    ],
    accepted_evidence: ['docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Native-Crash-Runtime-*.json'],
    strict_gate: 'npm --prefix mobile run release:completion:audit:strict',
    docs: [docs.runbook, docs.releaseHardening],
  },
  telemetry_runtime_evidence: {
    owner_surface: 'Release App telemetry ingest',
    required_env_keys: ['APP_TELEMETRY_RUNTIME_API_BASE_URL'],
    action: 'Post controlled App telemetry and OTLP trace payloads to the non-local release backend and prove both runtime ingest endpoints accept them.',
    commands: [
      'npm --prefix mobile run telemetry:runtime:smoke -- --run --release-env-file=release.env.local',
    ],
    accepted_evidence: ['docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Telemetry-Runtime-*.json'],
    strict_gate: 'npm --prefix mobile run release:completion:audit:strict',
    docs: [docs.runbook, docs.releaseHardening, docs.testBaseline],
  },
  release_db_parity_evidence: {
    owner_surface: 'Release / production PostgreSQL',
    required_env_keys: ['DATABASE_URL'],
    action: 'Run release DB parity against a non-local release or production PostgreSQL target.',
    commands: [
      'DATABASE_URL=<release-or-production-postgresql-url> npm --prefix backend run ops:release-db:evidence',
    ],
    accepted_evidence: ['docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-DB-Parity-*.json'],
    strict_gate: 'npm --prefix mobile run release:completion:audit:strict',
    docs: [docs.runbook, docs.releaseHardening],
  },
  ios_physical_device_visible: {
    owner_surface: 'Trusted iOS device runner',
    required_env_keys: ['DEVELOPER_DIR', 'APP_IOS_DEVICE_UDID'],
    action: 'Attach, unlock, and trust an iPhone visible to xctrace on the runner.',
    commands: [
      'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun xctrace list devices',
      'APP_IOS_DEVICE_UDID=<trusted-device-udid> APP_IOS_DEVICE_APP_PATH=<signed-app-path> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=ios --report-dir=<report-dir>',
      'npm --prefix mobile run release:external-evidence:status',
    ],
    accepted_evidence: ['release status shows devices.ios.physical_connected > 0'],
    strict_gate: 'npm --prefix mobile run physical-device:smoke -- --platform=ios --run',
    docs: [docs.runbook],
  },
  android_physical_device_visible: {
    owner_surface: 'Trusted Android device runner',
    required_env_keys: ['ANDROID_HOME or ANDROID_SDK_ROOT', 'APP_ANDROID_DEVICE_SERIAL'],
    action: 'Attach, authorize, and keep a physical Android device visible to adb.',
    commands: [
      'adb devices -l',
      'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial> npm --prefix mobile run release:external-evidence:validate -- --physical-platform=android --report-dir=<report-dir>',
      'npm --prefix mobile run release:external-evidence:status',
    ],
    accepted_evidence: ['release status shows devices.android.physical_connected > 0'],
    strict_gate: 'npm --prefix mobile run physical-device:smoke -- --platform=android --run',
    docs: [docs.runbook],
  },
};

const forbiddenNeedles = [
  'Bearer ',
  'postgresql://',
  'postgres://',
  'ExpoPushToken[',
  'ExponentPushToken[',
  'BEGIN PRIVATE KEY',
  'BEGIN EC PRIVATE KEY',
  'expo-token-secret',
  'apple-password-secret',
  'sentry-token-secret',
  'db-password-secret',
];

function fail(message) {
  console.error(`[release-external-handoff-check] ${message}`);
  process.exit(1);
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function runStatus() {
  const result = spawnSync(process.execPath, [path.join(scriptDir, 'check-release-external-evidence-status.mjs'), '--json'], {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    fail(`status command failed: ${(result.stderr || result.stdout).trim().slice(-500)}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`status command did not return JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function runReleaseCompletionAuditJson() {
  const result = spawnSync(process.execPath, [releaseCompletionAuditScript, '--json'], {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
    },
  });
  if (result.status !== 0) {
    fail(`release completion audit command failed: ${(result.stderr || result.stdout).trim().slice(-500)}`);
  }
  if (result.stderr.trim()) {
    fail(`release completion audit command must not write stderr: ${result.stderr.trim()}`);
  }
  try {
    const audit = JSON.parse(result.stdout);
    if (audit.type !== 'app-release-completion-audit') {
      fail(`unexpected release completion audit type: ${audit.type}`);
    }
    if (!Array.isArray(audit.handoff_blocker_ids)) {
      fail('release completion audit must include handoff_blocker_ids array');
    }
    const unknownIds = audit.handoff_blocker_ids.filter((id) => !knownBlockerIds.includes(id));
    if (unknownIds.length > 0) {
      fail(`release completion audit includes unknown handoff blocker ids: ${unknownIds.join(', ')}`);
    }
    return audit;
  } catch (error) {
    fail(`release completion audit command did not return JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateCatalog() {
  const catalogIds = Object.keys(actionCatalog);
  const missing = knownBlockerIds.filter((id) => !catalogIds.includes(id));
  const extra = catalogIds.filter((id) => !knownBlockerIds.includes(id));
  if (missing.length) fail(`handoff action catalog missing blocker ids: ${missing.join(', ')}`);
  if (extra.length) fail(`handoff action catalog has unknown blocker ids: ${extra.join(', ')}`);

  for (const [id, action] of Object.entries(actionCatalog)) {
    for (const key of ['owner_surface', 'action', 'strict_gate']) {
      if (!action[key]) fail(`${id} handoff action missing ${key}`);
    }
    if (!Array.isArray(action.required_env_keys)) fail(`${id} required_env_keys must be an array`);
    if (!Array.isArray(action.commands) || action.commands.length === 0) fail(`${id} must include at least one command`);
    if (!Array.isArray(action.accepted_evidence) || action.accepted_evidence.length === 0) {
      fail(`${id} must include accepted evidence`);
    }
    if (!Array.isArray(action.docs) || action.docs.length === 0) fail(`${id} must include docs`);
  }
}

function assertNoSensitiveLeaks(label, value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const leaks = forbiddenNeedles.filter((needle) => text.includes(needle));
  if (leaks.length) fail(`${label} includes sensitive-looking values: ${leaks.join(', ')}`);
}

function buildHandoff(status, releaseCompletionAudit) {
  if (status.type !== 'app-external-evidence-status') {
    fail(`unexpected status type: ${status.type}`);
  }
  if (!Array.isArray(status.blockers)) {
    fail('status must include a blockers array');
  }

  const unknownBlockers = status.blockers
    .map((blocker) => blocker.id)
    .filter((id) => !Object.prototype.hasOwnProperty.call(actionCatalog, id));
  if (unknownBlockers.length) fail(`handoff action catalog does not cover current blockers: ${unknownBlockers.join(', ')}`);

  const releaseCompletionHandoffIds = new Set(releaseCompletionAudit.handoff_blocker_ids);
  const statusBlockerIds = new Set(status.blockers.map((blocker) => blocker.id));
  const missingReleaseHandoffIds = [...releaseCompletionHandoffIds].filter((id) => !statusBlockerIds.has(id));
  if (missingReleaseHandoffIds.length > 0) {
    fail(
      `status blockers must cover current release completion audit handoff ids: ${missingReleaseHandoffIds.join(', ')}`
    );
  }

  const items = status.blockers.map((blocker) => {
    const releaseCompletionBlocker = releaseCompletionHandoffIds.has(blocker.id);
    return {
      blocker_id: blocker.id,
      blocker_message: blocker.message,
      release_completion_blocker: releaseCompletionBlocker,
      prerequisite_only: !releaseCompletionBlocker,
      ...actionCatalog[blocker.id],
    };
  });
  const releaseCompletionHandoffBlockerCount = items.filter((item) => item.release_completion_blocker).length;
  const prerequisiteOnlyBlockerCount = items.filter((item) => item.prerequisite_only).length;

  return {
    type: 'app-external-evidence-handoff',
    generated_at: new Date().toISOString(),
    source_status_type: status.type,
    source_status_generated_at: status.generated_at,
    source_release_completion_audit_type: releaseCompletionAudit.type,
    source_release_completion_audit_generated_at: releaseCompletionAudit.generated_at,
    app: status.app,
    summary: {
      blocked: items.length > 0,
      blocker_count: items.length,
      release_completion_handoff_blocker_count: releaseCompletionHandoffBlockerCount,
      prerequisite_only_blocker_count: prerequisiteOnlyBlockerCount,
      known_blocker_count: knownBlockerIds.length,
      report_contains_secrets: false,
    },
    items,
    final_gates: [
      'npm --prefix mobile run release:completion:audit:strict',
      'npm --prefix mobile run goal:completion:audit:strict',
    ],
  };
}

function writeReport(handoff) {
  if (!reportDir) return null;
  fs.mkdirSync(reportDir, { recursive: true });
  const filePath = path.join(reportDir, `App-External-Evidence-Handoff-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(handoff, null, 2)}\n`);
  return filePath;
}

function printHandoff(handoff, reportPath) {
  console.log('[release-external-handoff-check] release handoff blockers');
  if (handoff.items.length === 0) {
    console.log('- none');
  } else {
    for (const item of handoff.items) {
      const blockerKind = item.release_completion_blocker ? 'release' : 'prerequisite';
      console.log(`- ${item.blocker_id}: ${item.owner_surface} (${blockerKind})`);
    }
  }
  console.log('[release-external-handoff-check] final gates');
  for (const gate of handoff.final_gates) {
    console.log(`- ${gate}`);
  }
  if (reportPath) {
    console.log(`[release-external-handoff-check] report: ${path.relative(repoRoot, reportPath)}`);
  }
  console.log('[release-external-handoff-check] ok: normalized blockers have owner actions, evidence targets, and strict gates');
}

validateCatalog();
const status = runStatus();
const releaseCompletionAudit = runReleaseCompletionAuditJson();
const handoff = buildHandoff(status, releaseCompletionAudit);
assertNoSensitiveLeaks('handoff report', handoff);
const reportPath = writeReport(handoff);

if (json) {
  console.log(JSON.stringify(handoff, null, 2));
} else {
  printHandoff(handoff, reportPath);
}
