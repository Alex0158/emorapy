import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const handoffScript = path.join(scriptDir, 'check-release-external-evidence-handoff.mjs');
const redactionScript = path.join(scriptDir, 'check-release-evidence-redaction.mjs');

const requiredKnownBlockerIds = [
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
  console.error(`[release-external-handoff-contract] ${message}`);
  process.exit(1);
}

function runHandoff(extraEnv = {}, extraArgs = []) {
  return spawnSync(process.execPath, [handoffScript, '--json', ...extraArgs], {
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
  if (typeof value !== 'boolean') fail(`${label} must be boolean`);
}

function assertNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) fail(`${label} must be number`);
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
}

function assertStringArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  for (const [index, entry] of value.entries()) {
    assertNonEmptyString(entry, `${label}[${index}]`);
  }
}

function assertNoSensitiveLeaks(label, value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  for (const secret of controlledSecrets) {
    if (text.includes(secret)) {
      fail(`${label} leaked controlled secret: ${secret}`);
    }
  }
  for (const pattern of [/Bearer\s+(?!\[redacted\])\S+/, /\b(?:Expo|Exponent)PushToken\[[^\]]+\]/]) {
    if (pattern.test(text)) {
      fail(`${label} includes sensitive-looking token material`);
    }
  }
}

function validateHandoff(handoff, label) {
  if (!handoff || typeof handoff !== 'object') fail(`${label} root must be an object`);
  if (handoff.type !== 'app-external-evidence-handoff') {
    fail(`${label}.type must be app-external-evidence-handoff`);
  }
  if (Number.isNaN(Date.parse(handoff.generated_at))) {
    fail(`${label}.generated_at must be an ISO-like timestamp`);
  }
  if (handoff.source_status_type !== 'app-external-evidence-status') {
    fail(`${label}.source_status_type must be app-external-evidence-status`);
  }
  if (Number.isNaN(Date.parse(handoff.source_status_generated_at))) {
    fail(`${label}.source_status_generated_at must be an ISO-like timestamp`);
  }
  if (handoff.source_release_completion_audit_type !== 'app-release-completion-audit') {
    fail(`${label}.source_release_completion_audit_type must be app-release-completion-audit`);
  }
  if (Number.isNaN(Date.parse(handoff.source_release_completion_audit_generated_at))) {
    fail(`${label}.source_release_completion_audit_generated_at must be an ISO-like timestamp`);
  }
  const generatedAt = Date.parse(handoff.generated_at);
  const sourceStatusGeneratedAt = Date.parse(handoff.source_status_generated_at);
  const sourceReleaseCompletionAuditGeneratedAt = Date.parse(handoff.source_release_completion_audit_generated_at);
  if (sourceStatusGeneratedAt > generatedAt) {
    fail(`${label}.source_status_generated_at must not be after generated_at`);
  }
  if (sourceReleaseCompletionAuditGeneratedAt > generatedAt) {
    fail(`${label}.source_release_completion_audit_generated_at must not be after generated_at`);
  }
  if (!handoff.app || typeof handoff.app !== 'object') {
    fail(`${label}.app must be an object`);
  }

  const summary = handoff.summary ?? {};
  assertBoolean(summary.blocked, `${label}.summary.blocked`);
  assertNumber(summary.blocker_count, `${label}.summary.blocker_count`);
  assertNumber(
    summary.release_completion_handoff_blocker_count,
    `${label}.summary.release_completion_handoff_blocker_count`
  );
  assertNumber(summary.prerequisite_only_blocker_count, `${label}.summary.prerequisite_only_blocker_count`);
  assertNumber(summary.known_blocker_count, `${label}.summary.known_blocker_count`);
  assertBoolean(summary.report_contains_secrets, `${label}.summary.report_contains_secrets`);
  if (summary.report_contains_secrets !== false) {
    fail(`${label}.summary.report_contains_secrets must be false`);
  }
  if (summary.known_blocker_count !== requiredKnownBlockerIds.length) {
    fail(`${label}.summary.known_blocker_count must match required blocker catalog`);
  }

  if (!Array.isArray(handoff.items)) fail(`${label}.items must be an array`);
  if (handoff.items.length !== summary.blocker_count) {
    fail(`${label}.summary.blocker_count must match items length`);
  }
  if (summary.blocked !== (handoff.items.length > 0)) {
    fail(`${label}.summary.blocked must match whether items are present`);
  }

  const ids = new Set();
  let releaseCompletionHandoffBlockerCount = 0;
  let prerequisiteOnlyBlockerCount = 0;
  for (const [index, item] of handoff.items.entries()) {
    if (!item || typeof item !== 'object') fail(`${label}.items[${index}] must be an object`);
    assertNonEmptyString(item.blocker_id, `${label}.items[${index}].blocker_id`);
    if (ids.has(item.blocker_id)) fail(`${label}.items has duplicate blocker id ${item.blocker_id}`);
    ids.add(item.blocker_id);
    if (!requiredKnownBlockerIds.includes(item.blocker_id)) {
      fail(`${label}.items[${index}].blocker_id is not in the known blocker catalog: ${item.blocker_id}`);
    }
    for (const key of ['blocker_message', 'owner_surface', 'action', 'strict_gate']) {
      assertNonEmptyString(item[key], `${label}.items[${index}].${key}`);
    }
    assertBoolean(item.release_completion_blocker, `${label}.items[${index}].release_completion_blocker`);
    assertBoolean(item.prerequisite_only, `${label}.items[${index}].prerequisite_only`);
    if (item.release_completion_blocker === item.prerequisite_only) {
      fail(`${label}.items[${index}] must be either a release completion blocker or prerequisite-only blocker`);
    }
    if (item.release_completion_blocker) releaseCompletionHandoffBlockerCount += 1;
    if (item.prerequisite_only) prerequisiteOnlyBlockerCount += 1;
    assertStringArray(item.required_env_keys, `${label}.items[${index}].required_env_keys`);
    assertStringArray(item.commands, `${label}.items[${index}].commands`);
    assertStringArray(item.accepted_evidence, `${label}.items[${index}].accepted_evidence`);
    assertStringArray(item.docs, `${label}.items[${index}].docs`);
  }
  if (summary.release_completion_handoff_blocker_count !== releaseCompletionHandoffBlockerCount) {
    fail(`${label}.summary.release_completion_handoff_blocker_count must match item flags`);
  }
  if (summary.prerequisite_only_blocker_count !== prerequisiteOnlyBlockerCount) {
    fail(`${label}.summary.prerequisite_only_blocker_count must match item flags`);
  }
  if (summary.blocker_count !== releaseCompletionHandoffBlockerCount + prerequisiteOnlyBlockerCount) {
    fail(`${label}.summary blocker categories must add up to blocker_count`);
  }

  assertStringArray(handoff.final_gates, `${label}.final_gates`);
  for (const gate of [
    'npm --prefix mobile run release:completion:audit:strict',
    'npm --prefix mobile run goal:completion:audit:strict',
  ]) {
    if (!handoff.final_gates.includes(gate)) {
      fail(`${label}.final_gates must include ${gate}`);
    }
  }

  assertNoSensitiveLeaks(label, handoff);
}

function assertCatalogPinnedBySource() {
  const source = fs.readFileSync(handoffScript, 'utf8');
  for (const id of requiredKnownBlockerIds) {
    if (!source.includes(`'${id}'`)) {
      fail(`handoff source must pin known blocker id ${id}`);
    }
  }
  for (const needle of [
    'owner_surface',
    'required_env_keys',
    'accepted_evidence',
    'strict_gate',
    'native_crash_event_id_present',
    'release:external-evidence:validate -- --physical-platform=ios',
    'release:external-evidence:validate -- --physical-platform=android',
    'release:external-evidence:run -- --physical-platform=ios',
    'release:external-evidence:run -- --physical-platform=android',
    'telemetry:runtime:smoke -- --run',
    'source_release_completion_audit_type',
    'source_status_generated_at',
    'release_completion_blocker',
    'prerequisite_only',
    'release_completion_handoff_blocker_count',
    'App-External-Evidence-Handoff-',
    'assertNoSensitiveLeaks',
  ]) {
    if (!source.includes(needle)) fail(`handoff source must include ${needle}`);
  }
}

assertCatalogPinnedBySource();

const baselineResult = runHandoff();
const baseline = parseJsonResult('baseline handoff JSON', baselineResult);
validateHandoff(baseline, 'baseline handoff JSON');

const controlledEnv = {
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
};
const controlledResult = runHandoff(controlledEnv);
assertNoSensitiveLeaks('controlled handoff stdout/stderr', `${controlledResult.stdout}\n${controlledResult.stderr}`);
const controlled = parseJsonResult('controlled handoff JSON', controlledResult);
validateHandoff(controlled, 'controlled handoff JSON');

const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cj-release-handoff-report-'));
try {
  const reportResult = runHandoff(controlledEnv, [`--report-dir=${reportDir}`]);
  assertNoSensitiveLeaks('handoff report stdout/stderr', `${reportResult.stdout}\n${reportResult.stderr}`);
  const reportStdoutJson = parseJsonResult('handoff JSON with report dir', reportResult);
  validateHandoff(reportStdoutJson, 'handoff JSON with report dir');

  const files = fs
    .readdirSync(reportDir)
    .filter((entry) => entry.startsWith('App-External-Evidence-Handoff-') && entry.endsWith('.json'));
  if (files.length !== 1) {
    fail(`expected exactly one handoff report JSON, found ${files.length}`);
  }

  const reportPath = path.join(reportDir, files[0]);
  const reportRaw = fs.readFileSync(reportPath, 'utf8');
  assertNoSensitiveLeaks('handoff report file', reportRaw);
  const reportJson = JSON.parse(reportRaw);
  validateHandoff(reportJson, 'handoff report file JSON');

  const redactionResult = spawnSync(process.execPath, [redactionScript, `--evidence-dir=${reportDir}`], {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (redactionResult.status !== 0) {
    fail(`handoff report must pass release evidence redaction scan: ${redactionResult.stderr || redactionResult.stdout}`);
  }
  assertNoSensitiveLeaks('handoff redaction stdout/stderr', `${redactionResult.stdout}\n${redactionResult.stderr}`);
} finally {
  fs.rmSync(reportDir, { recursive: true, force: true });
}

console.log('[release-external-handoff-contract] ok: JSON schema, blocker catalog, report artifact, and secret redaction are pinned');
