import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const auditScript = path.join(scriptDir, 'check-release-completion-audit.mjs');
const handoffScript = path.join(scriptDir, 'check-release-external-evidence-handoff.mjs');
const packageJsonPath = path.join(mobileRoot, 'package.json');

const requiredCheckIds = new Set([
  'eas_project_id',
  'expo_token',
  'apple_submission_credentials',
  'app_store_connect_api_credentials',
  'eas_ios_build_artifact',
  'testflight_evidence',
  'physical_device_evidence',
  'android_native_toolchain_evidence',
  'android_emulator_runtime_evidence',
  'android_app_runtime_evidence',
  'android_full_flow_evidence',
  'ios_release_simulator_evidence',
  'eas_android_build_artifact',
  'apns_or_provider_delivery_evidence',
  'native_imagepicker_upload_evidence',
  'selected_media_backend_upload_evidence',
  'native_crash_sdk_configuration',
  'sentry_ios_native_prebuild_configuration',
  'native_crash_runtime_evidence',
  'otel_provider_evidence',
  'otel_collector_baseline',
  'telemetry_runtime_evidence',
  'release_production_db_parity',
]);

const releaseDocs = [
  'docs/核心開發文件/20-App端/03-App完整版本開發Roadmap.md',
  'docs/核心開發文件/08-測試規範與驗收/03-App測試與證據接入基線.md',
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md',
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md',
].map((relativePath) => path.join(repoRoot, relativePath));

const completionToExternalHandoffBlockerIds = {
  eas_project_id: ['eas_project_id'],
  expo_token: ['expo_token'],
  apple_submission_credentials: ['apple_submission_credentials'],
  app_store_connect_api_credentials: ['app_store_connect_api_credentials'],
  eas_ios_build_artifact: ['eas_ios_release_evidence'],
  testflight_evidence: ['testflight_evidence'],
  physical_device_evidence: ['physical_device_evidence'],
  eas_android_build_artifact: ['eas_android_release_evidence'],
  apns_or_provider_delivery_evidence: ['push_delivery_evidence'],
  native_crash_runtime_evidence: ['native_crash_runtime_evidence'],
  telemetry_runtime_evidence: ['telemetry_runtime_evidence'],
  release_production_db_parity: ['release_db_parity_evidence'],
};

function fail(message) {
  console.error(`[release-completion-audit-contract] ${message}`);
  process.exit(1);
}

function runAudit(args, envOverrides = {}) {
  return spawnSync(process.execPath, [auditScript, ...args], {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
      ...envOverrides,
    },
  });
}

function runHandoffJson() {
  return spawnSync(process.execPath, [handoffScript, '--json'], {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
    },
  });
}

function parseJsonResult(label, result) {
  if (!result.stdout.trim()) {
    fail(`${label} produced empty stdout`);
  }
  if (result.stderr.trim()) {
    fail(`${label} must not write stderr in JSON mode: ${result.stderr.trim()}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`${label} did not produce valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateAuditRecord(label, audit) {
  if (!audit || typeof audit !== 'object') {
    fail(`${label} JSON root must be an object`);
  }
  if (audit.type !== 'app-release-completion-audit') {
    fail(`${label}.type must be app-release-completion-audit`);
  }
  if (Number.isNaN(Date.parse(audit.generated_at))) {
    fail(`${label}.generated_at must be an ISO-like timestamp`);
  }
  if (typeof audit.strict !== 'boolean') {
    fail(`${label}.strict must be boolean`);
  }
  if (typeof audit.complete !== 'boolean') {
    fail(`${label}.complete must be boolean`);
  }
  if (!audit.summary || typeof audit.summary !== 'object') {
    fail(`${label}.summary must be an object`);
  }
  for (const key of ['passed', 'blocked', 'failures', 'warnings', 'verified']) {
    if (!Number.isInteger(audit.summary[key])) {
      fail(`${label}.summary.${key} must be an integer`);
    }
  }
  if (!Array.isArray(audit.checks) || audit.checks.length === 0) {
    fail(`${label}.checks must be a non-empty array`);
  }
  if (
    !Array.isArray(audit.verified) ||
    !Array.isArray(audit.warnings) ||
    !Array.isArray(audit.blockers) ||
    !Array.isArray(audit.blocker_ids) ||
    !Array.isArray(audit.handoff_blocker_ids) ||
    !Array.isArray(audit.failures)
  ) {
    fail(`${label}.verified/warnings/blockers/blocker_ids/handoff_blocker_ids/failures must all be arrays`);
  }
  if (!audit.verified.every((entry) => typeof entry === 'string')) {
    fail(`${label}.verified entries must be strings`);
  }
  if (!audit.warnings.every((entry) => typeof entry === 'string')) {
    fail(`${label}.warnings entries must be strings`);
  }
  if (!audit.blockers.every((entry) => typeof entry === 'string')) {
    fail(`${label}.blockers entries must be strings`);
  }
  if (!audit.blocker_ids.every((entry) => typeof entry === 'string')) {
    fail(`${label}.blocker_ids entries must be strings`);
  }
  if (!audit.handoff_blocker_ids.every((entry) => typeof entry === 'string')) {
    fail(`${label}.handoff_blocker_ids entries must be strings`);
  }
  if (!audit.failures.every((entry) => typeof entry === 'string')) {
    fail(`${label}.failures entries must be strings`);
  }

  const ids = new Set();
  const blockedIds = [];
  const handoffIdsFromBlockedChecks = [];
  let nativeCrashRuntimeCheck = null;
  let passed = 0;
  let blocked = 0;
  for (const [index, check] of audit.checks.entries()) {
    if (!check || typeof check !== 'object') {
      fail(`${label}.checks[${index}] must be an object`);
    }
    if (typeof check.id !== 'string' || check.id.length === 0) {
      fail(`${label}.checks[${index}].id must be a non-empty string`);
    }
    if (ids.has(check.id)) {
      fail(`${label}.checks contains duplicate id: ${check.id}`);
    }
    ids.add(check.id);
    if (check.id === 'native_crash_runtime_evidence') {
      nativeCrashRuntimeCheck = check;
    }
    if (!['passed', 'blocked'].includes(check.status)) {
      fail(`${label}.checks[${index}].status has invalid value: ${check.status}`);
    }
    if (typeof check.documented !== 'boolean') {
      fail(`${label}.checks[${index}].documented must be boolean`);
    }
    if (check.status === 'passed') {
      passed += 1;
      if (check.blocker !== null) {
        fail(`${label}.checks[${index}] passed entries must have blocker=null`);
      }
    }
    if (check.status === 'blocked') {
      blocked += 1;
      blockedIds.push(check.id);
      if (typeof check.blocker !== 'string' || check.blocker.length === 0) {
        fail(`${label}.checks[${index}] blocked entries must include a blocker string`);
      }
    }
    if (!Array.isArray(check.doc_needles) || !check.doc_needles.every((entry) => typeof entry === 'string')) {
      fail(`${label}.checks[${index}].doc_needles must be a string array`);
    }
    if (
      !Array.isArray(check.handoff_catalog_ids) ||
      !check.handoff_catalog_ids.every((entry) => typeof entry === 'string')
    ) {
      fail(`${label}.checks[${index}].handoff_catalog_ids must be a string array`);
    }
    if (
      !Array.isArray(check.handoff_blocker_ids) ||
      !check.handoff_blocker_ids.every((entry) => typeof entry === 'string')
    ) {
      fail(`${label}.checks[${index}].handoff_blocker_ids must be a string array`);
    }
    const expectedHandoffIds = completionToExternalHandoffBlockerIds[check.id] ?? [];
    const actualCatalogIds = [...check.handoff_catalog_ids].sort();
    const sortedExpectedHandoffIds = [...expectedHandoffIds].sort();
    if (actualCatalogIds.length !== sortedExpectedHandoffIds.length) {
      fail(`${label}.checks[${index}].handoff_catalog_ids length must match the completion-to-handoff catalog map`);
    }
    for (const [handoffIndex, expectedId] of sortedExpectedHandoffIds.entries()) {
      if (actualCatalogIds[handoffIndex] !== expectedId) {
        fail(`${label}.checks[${index}].handoff_catalog_ids must match the completion-to-handoff catalog map`);
      }
    }
    const expectedCurrentHandoffIds = check.status === 'blocked' ? sortedExpectedHandoffIds : [];
    const actualHandoffIds = [...check.handoff_blocker_ids].sort();
    if (actualHandoffIds.length !== expectedCurrentHandoffIds.length) {
      fail(`${label}.checks[${index}].handoff_blocker_ids length must match current blocked handoff ids`);
    }
    for (const [handoffIndex, expectedId] of expectedCurrentHandoffIds.entries()) {
      if (actualHandoffIds[handoffIndex] !== expectedId) {
        fail(`${label}.checks[${index}].handoff_blocker_ids must match current blocked handoff ids`);
      }
    }
    if (check.status === 'blocked') {
      handoffIdsFromBlockedChecks.push(...check.handoff_blocker_ids);
    }
  }

  for (const id of requiredCheckIds) {
    if (!ids.has(id)) {
      fail(`${label}.checks missing required id: ${id}`);
    }
  }
  if (!nativeCrashRuntimeCheck) {
    fail(`${label}.checks missing native_crash_runtime_evidence check`);
  }
  if (
    !nativeCrashRuntimeCheck.doc_needles.some((entry) =>
      entry.includes('production environment') || entry.includes('release / production environment match')
    )
  ) {
    fail(`${label}.native_crash_runtime_evidence doc_needles must pin production environment wording`);
  }
  if (
    audit.blocker_ids.includes('native_crash_runtime_evidence') &&
    typeof nativeCrashRuntimeCheck.blocker === 'string' &&
    !nativeCrashRuntimeCheck.blocker.includes('production environment')
  ) {
    fail(`${label}.native_crash_runtime_evidence blocker must mention production environment`);
  }
  if (
    audit.blocker_ids.includes('native_crash_runtime_evidence') &&
    !audit.warnings.some(
      (entry) => entry.includes('APP_NATIVE_CRASH_EVIDENCE_FILE') && entry.includes('production environment')
    )
  ) {
    fail(`${label}.warnings must mention production environment for missing native crash runtime evidence`);
  }
  if (audit.summary.passed !== passed || audit.summary.blocked !== blocked) {
    fail(`${label}.summary passed/blocked counts must match checks`);
  }
  const actualBlockedIds = [...audit.blocker_ids].sort();
  const expectedBlockedIds = [...blockedIds].sort();
  if (actualBlockedIds.length !== expectedBlockedIds.length) {
    fail(`${label}.blocker_ids length must match blocked checks`);
  }
  for (const [index, expectedId] of expectedBlockedIds.entries()) {
    if (actualBlockedIds[index] !== expectedId) {
      fail(`${label}.blocker_ids must match blocked check ids`);
    }
  }
  const actualHandoffBlockerIds = [...audit.handoff_blocker_ids].sort();
  const expectedHandoffBlockerIds = [...new Set(handoffIdsFromBlockedChecks)].sort();
  if (actualHandoffBlockerIds.length !== expectedHandoffBlockerIds.length) {
    fail(`${label}.handoff_blocker_ids length must match blocked checks`);
  }
  for (const [index, expectedId] of expectedHandoffBlockerIds.entries()) {
    if (actualHandoffBlockerIds[index] !== expectedId) {
      fail(`${label}.handoff_blocker_ids must match blocked check handoff ids`);
    }
  }
  if (audit.summary.failures !== audit.failures.length) {
    fail(`${label}.summary.failures must match failures length`);
  }
  if (audit.summary.warnings !== audit.warnings.length) {
    fail(`${label}.summary.warnings must match warnings length`);
  }
  if (audit.summary.verified !== audit.verified.length) {
    fail(`${label}.summary.verified must match verified length`);
  }
  if (audit.complete !== (audit.failures.length === 0 && blocked === 0)) {
    fail(`${label}.complete must be true only when failures and blocked checks are zero`);
  }
}

function validateExternalHandoffCoverage(label, audit, handoff) {
  if (!handoff || typeof handoff !== 'object') {
    fail(`${label} handoff JSON root must be an object`);
  }
  if (handoff.type !== 'app-external-evidence-handoff') {
    fail(`${label} handoff.type must be app-external-evidence-handoff`);
  }
  if (!Array.isArray(handoff.items)) {
    fail(`${label} handoff.items must be an array`);
  }
  const handoffIds = new Set(handoff.items.map((item) => item?.blocker_id).filter(Boolean));
  for (const id of audit.handoff_blocker_ids) {
    if (!handoffIds.has(id)) {
      fail(`${label}.handoff_blocker_ids must be covered by release:external-evidence:handoff:check: ${id}`);
    }
  }
}

function getCheck(audit, id) {
  return audit.checks.find((check) => check.id === id);
}

const nonStrictResult = runAudit(['--json']);
if (nonStrictResult.status !== 0) {
  fail(`non-strict JSON audit must exit 0, got ${nonStrictResult.status}`);
}
const nonStrictAudit = parseJsonResult('non-strict JSON audit', nonStrictResult);
validateAuditRecord('non-strict JSON audit', nonStrictAudit);
if (nonStrictAudit.strict !== false) {
  fail('non-strict JSON audit must report strict=false');
}

const strictResult = runAudit(['--strict', '--json']);
const strictAudit = parseJsonResult('strict JSON audit', strictResult);
validateAuditRecord('strict JSON audit', strictAudit);
if (strictAudit.strict !== true) {
  fail('strict JSON audit must report strict=true');
}
if (strictAudit.complete && strictResult.status !== 0) {
  fail(`strict JSON audit complete=true must exit 0, got ${strictResult.status}`);
}
if (!strictAudit.complete && strictResult.status === 0) {
  fail('strict JSON audit complete=false must exit non-zero');
}
if (strictAudit.complete !== nonStrictAudit.complete) {
  fail('strict and non-strict JSON audits must report the same complete value');
}

const placeholderCredentialResult = runAudit(['--json'], {
  EXPO_TOKEN: 'REPLACE_WITH_EXPO_ACCESS_TOKEN',
  ASC_APPLE_ID: 'REPLACE_WITH_APPLE_ID_EMAIL',
  EXPO_APPLE_APP_SPECIFIC_PASSWORD: 'REPLACE_WITH_APPLE_APP_SPECIFIC_PASSWORD',
  APP_STORE_CONNECT_ISSUER_ID: 'REPLACE_WITH_ASC_ISSUER_ID',
  ASC_ISSUER_ID: 'REPLACE_WITH_ASC_ISSUER_ID',
  APP_STORE_CONNECT_KEY_ID: 'REPLACE_WITH_ASC_KEY_ID',
  ASC_KEY_ID: 'REPLACE_WITH_ASC_KEY_ID',
  APP_STORE_CONNECT_PRIVATE_KEY: 'REPLACE_WITH_ASC_PRIVATE_KEY',
  ASC_PRIVATE_KEY: 'REPLACE_WITH_ASC_PRIVATE_KEY',
  APP_STORE_CONNECT_PRIVATE_KEY_PATH: 'REPLACE_WITH_ABSOLUTE_PATH_TO_ASC_PRIVATE_KEY_P8',
  ASC_PRIVATE_KEY_PATH: 'REPLACE_WITH_ABSOLUTE_PATH_TO_ASC_PRIVATE_KEY_P8',
});
if (placeholderCredentialResult.status !== 0) {
  fail(`placeholder credential JSON audit must exit 0, got ${placeholderCredentialResult.status}`);
}
const placeholderCredentialAudit = parseJsonResult('placeholder credential JSON audit', placeholderCredentialResult);
validateAuditRecord('placeholder credential JSON audit', placeholderCredentialAudit);
for (const id of ['expo_token', 'apple_submission_credentials', 'app_store_connect_api_credentials']) {
  const check = getCheck(placeholderCredentialAudit, id);
  if (check?.status !== 'blocked') {
    fail(`placeholder credential JSON audit must keep ${id} blocked`);
  }
  if (!placeholderCredentialAudit.blocker_ids.includes(id)) {
    fail(`placeholder credential JSON audit blocker_ids must include ${id}`);
  }
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'emorapy-release-audit-contract-'));
try {
  const envFilePath = path.join(tempRoot, 'release.env.local');
  writeFileSync(
    envFilePath,
    [
      'APP_EAS_PROJECT_FULL_NAME=@alexdev518/emorapy-mobile',
      'EXPO_TOKEN=REPLACE_WITH_EXPO_ACCESS_TOKEN',
      'ASC_APPLE_ID=REPLACE_WITH_APPLE_ID_EMAIL',
      'EXPO_APPLE_APP_SPECIFIC_PASSWORD=REPLACE_WITH_APPLE_APP_SPECIFIC_PASSWORD',
      'APP_STORE_CONNECT_ISSUER_ID=REPLACE_WITH_ASC_ISSUER_ID',
      'APP_STORE_CONNECT_KEY_ID=REPLACE_WITH_ASC_KEY_ID',
      'APP_STORE_CONNECT_PRIVATE_KEY=REPLACE_WITH_ASC_PRIVATE_KEY',
      '',
    ].join('\n')
  );

  const placeholderEnvFileResult = runAudit(['--json', `--release-env-file=${envFilePath}`], {
    EXPO_TOKEN: '',
    ASC_APPLE_ID: '',
    EXPO_APPLE_APP_SPECIFIC_PASSWORD: '',
    APP_STORE_CONNECT_ISSUER_ID: '',
    APP_STORE_CONNECT_KEY_ID: '',
    APP_STORE_CONNECT_PRIVATE_KEY: '',
  });
  if (placeholderEnvFileResult.status !== 0) {
    fail(`placeholder release-env-file JSON audit must exit 0, got ${placeholderEnvFileResult.status}`);
  }
  const placeholderEnvFileAudit = parseJsonResult(
    'placeholder release-env-file JSON audit',
    placeholderEnvFileResult
  );
  validateAuditRecord('placeholder release-env-file JSON audit', placeholderEnvFileAudit);
  for (const id of ['expo_token', 'apple_submission_credentials', 'app_store_connect_api_credentials']) {
    const check = getCheck(placeholderEnvFileAudit, id);
    if (check?.status !== 'blocked') {
      fail(`placeholder release-env-file JSON audit must keep ${id} blocked`);
    }
    if (!placeholderEnvFileAudit.blocker_ids.includes(id)) {
      fail(`placeholder release-env-file JSON audit blocker_ids must include ${id}`);
    }
  }

  const unsafeEnvFilePath = path.join(tempRoot, 'unsafe.env');
  writeFileSync(unsafeEnvFilePath, 'NODE_OPTIONS=--require ./leak.js\n');
  const unsafeEnvFileResult = runAudit(['--json', `--release-env-file=${unsafeEnvFilePath}`]);
  if (unsafeEnvFileResult.status === 0) {
    fail('unsafe release-env-file key audit must exit non-zero');
  }
  if (!unsafeEnvFileResult.stderr.includes('unsupported --release-env-file key: NODE_OPTIONS')) {
    fail('unsafe release-env-file key audit must report unsupported key without value');
  }
  if (
    unsafeEnvFileResult.stderr.includes('--require ./leak.js') ||
    unsafeEnvFileResult.stdout.includes('--require ./leak.js')
  ) {
    fail('unsafe release-env-file key audit must not echo raw value');
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

const handoffResult = runHandoffJson();
if (handoffResult.status !== 0) {
  fail(`release external handoff JSON must exit 0, got ${handoffResult.status}`);
}
const handoff = parseJsonResult('release external handoff JSON', handoffResult);
validateExternalHandoffCoverage('non-strict JSON audit', nonStrictAudit, handoff);
validateExternalHandoffCoverage('strict JSON audit', strictAudit, handoff);

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const scripts = pkg.scripts ?? {};
if (!scripts['release:completion:audit:contract']) {
  fail('package.json must expose release:completion:audit:contract');
}
if (!scripts['release:preflight']?.includes('release:completion:audit:contract')) {
  fail('release:preflight must include release:completion:audit:contract');
}

const docsText = releaseDocs.map((filePath) => readFileSync(filePath, 'utf8')).join('\n');
for (const requiredSnippet of [
  'release:completion:audit -- --json',
  'release:completion:audit -- --release-env-file=release.env.local --json',
  'release:completion:audit:contract',
  'app-release-completion-audit',
]) {
  if (!docsText.includes(requiredSnippet)) {
    fail(`core release docs must mention ${requiredSnippet}`);
  }
}

console.log(
  `[release-completion-audit-contract] ok: JSON schema valid; complete=${nonStrictAudit.complete}; strict_exit=${strictResult.status ?? 1}`
);
