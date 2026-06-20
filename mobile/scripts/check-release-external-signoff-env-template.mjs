import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const templatePath = path.join(mobileRoot, 'release.env.example');
const runbookPath = path.join(
  repoRoot,
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-External-Release-Signoff-Runbook-2026-05-08.md'
);
const inputChecklistPath = path.join(
  repoRoot,
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-External-Signoff-Input-Checklist-2026-05-16.md'
);
const gitignorePath = path.join(mobileRoot, '.gitignore');
const packageJsonPath = path.join(mobileRoot, 'package.json');

const requiredKeys = [
  'DEVELOPER_DIR',
  'APP_RELEASE_EXTERNAL_SIGNOFF_RUN',
  'APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR',
  'APP_PHYSICAL_DEVICE_PLATFORM',
  'APP_EAS_IOS_REQUIRE_TESTFLIGHT',
  'APP_EAS_PROJECT_FULL_NAME',
  'EXPO_TOKEN',
  'ASC_APPLE_ID',
  'EXPO_APPLE_APP_SPECIFIC_PASSWORD',
  'APP_STORE_CONNECT_ISSUER_ID',
  'APP_STORE_CONNECT_KEY_ID',
  'APP_STORE_CONNECT_PRIVATE_KEY_PATH',
  'APP_STORE_CONNECT_APP_ID',
  'APP_IOS_DEVICE_UDID',
  'APP_IOS_DEVICE_APP_PATH',
  'APP_ANDROID_DEVICE_SERIAL',
  'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN',
  'APP_PUSH_DELIVERY_ACCESS_TOKEN',
  'APP_SENTRY_ORG',
  'APP_SENTRY_PROJECT',
  'APP_SENTRY_AUTH_TOKEN',
  'APP_NATIVE_CRASH_SENTRY_EVENT_ID',
  'APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT',
  'APP_TELEMETRY_RUNTIME_API_BASE_URL',
  'DATABASE_URL',
];

const fixedValues = new Map([
  ['DEVELOPER_DIR', '/Applications/Xcode.app/Contents/Developer'],
  ['APP_RELEASE_EXTERNAL_SIGNOFF_RUN', 'false'],
  ['APP_PHYSICAL_DEVICE_PLATFORM', 'ios'],
  ['APP_EAS_IOS_REQUIRE_TESTFLIGHT', 'true'],
  ['APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT', 'production'],
]);

const placeholderKeys = requiredKeys.filter((key) => !fixedValues.has(key) && key !== 'APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR');
const forbiddenNeedles = [
  'Bearer ',
  'postgresql://',
  'postgres://',
  'ExpoPushToken[',
  'ExponentPushToken[',
  'expo-token-secret',
  'apple-password-secret',
  'sentry-token-secret',
  'db-password-secret',
  'BEGIN PRIVATE KEY',
  'BEGIN EC PRIVATE KEY',
];

function fail(message) {
  console.error(`[release-env-template-check] ${message}`);
  process.exitCode = 1;
}

function readRequiredText(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} missing: ${path.relative(repoRoot, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function parseEnvTemplate(text) {
  const entries = new Map();
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!match) {
      fail(`line ${index + 1} must use KEY=value syntax`);
      continue;
    }
    const [, key, value] = match;
    if (entries.has(key)) fail(`duplicate key in template: ${key}`);
    entries.set(key, value);
  }
  return entries;
}

const template = readRequiredText(templatePath, 'release env template');
const runbook = readRequiredText(runbookPath, 'external signoff runbook');
const inputChecklist = readRequiredText(inputChecklistPath, 'external signoff input checklist');
const gitignore = readRequiredText(gitignorePath, 'mobile gitignore');
const packageJsonText = readRequiredText(packageJsonPath, 'mobile package.json');
const entries = parseEnvTemplate(template);
const packageJson = packageJsonText ? JSON.parse(packageJsonText) : { scripts: {} };

if (!template.includes('Do not commit real secrets.')) {
  fail('template must warn not to commit real secrets.');
}

for (const needle of forbiddenNeedles) {
  if (template.includes(needle)) {
    fail(`template must not contain sensitive-looking value: ${needle}`);
  }
}

for (const key of requiredKeys) {
  if (!entries.has(key)) fail(`template missing required key: ${key}`);
}

for (const key of entries.keys()) {
  if (!requiredKeys.includes(key)) fail(`template includes undocumented key: ${key}`);
}

for (const [key, expected] of fixedValues.entries()) {
  if (entries.get(key) !== expected) {
    fail(`${key} must default to ${expected}.`);
  }
}

if (!entries.get('APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR')?.startsWith('/tmp/')) {
  fail('APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR must default to a /tmp path.');
}

if (
  packageJson.scripts?.['release:external-evidence:input-status'] !==
  'node scripts/check-release-external-signoff-input-status.mjs'
) {
  fail('package.json must expose release:external-evidence:input-status.');
}
if (
  packageJson.scripts?.['release:external-evidence:fill-inputs'] !==
  'node scripts/fill-release-external-signoff-inputs.mjs'
) {
  fail('package.json must expose release:external-evidence:fill-inputs.');
}
if (
  packageJson.scripts?.['release:external-evidence:github-secrets:check'] !==
  'node scripts/check-release-github-secret-names.mjs'
) {
  fail('package.json must expose release:external-evidence:github-secrets:check.');
}
if (
  packageJson.scripts?.['release:external-evidence:github-secrets:strict'] !==
  'node scripts/check-release-github-secret-names.mjs --strict'
) {
  fail('package.json must expose release:external-evidence:github-secrets:strict.');
}
if (
  packageJson.scripts?.['release:external-evidence:github-secrets:sync'] !==
  'node scripts/sync-release-github-secrets.mjs'
) {
  fail('package.json must expose release:external-evidence:github-secrets:sync.');
}
if (
  packageJson.scripts?.['release:external-evidence:github-secrets:sync:contract'] !==
  'node scripts/check-release-github-secret-sync-contract.mjs'
) {
  fail('package.json must expose release:external-evidence:github-secrets:sync:contract.');
}
if (!packageJson.scripts?.['release:preflight']?.includes('release:external-evidence:input-status')) {
  fail('release:preflight must include release:external-evidence:input-status.');
}
if (!packageJson.scripts?.['release:preflight']?.includes('release:external-evidence:github-secrets:sync:contract')) {
  fail('release:preflight must include release:external-evidence:github-secrets:sync:contract.');
}

for (const key of placeholderKeys) {
  const value = entries.get(key);
  if (!value?.startsWith('REPLACE_WITH_')) {
    fail(`${key} must use a REPLACE_WITH_ placeholder, not a real value.`);
  }
}

for (const key of [
  'APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR',
  'APP_PHYSICAL_DEVICE_PLATFORM',
  'APP_EAS_IOS_REQUIRE_TESTFLIGHT',
  'APP_EAS_PROJECT_FULL_NAME',
  'EXPO_TOKEN',
  'ASC_APPLE_ID',
  'EXPO_APPLE_APP_SPECIFIC_PASSWORD',
  'APP_STORE_CONNECT_ISSUER_ID',
  'APP_STORE_CONNECT_KEY_ID',
  'APP_STORE_CONNECT_PRIVATE_KEY_PATH',
  'APP_STORE_CONNECT_APP_ID',
  'APP_IOS_DEVICE_UDID',
  'APP_IOS_DEVICE_APP_PATH',
  'APP_ANDROID_DEVICE_SERIAL',
  'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN',
  'APP_PUSH_DELIVERY_ACCESS_TOKEN',
  'APP_SENTRY_ORG',
  'APP_SENTRY_PROJECT',
  'APP_SENTRY_AUTH_TOKEN',
  'APP_NATIVE_CRASH_SENTRY_EVENT_ID',
  'APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT',
  'APP_TELEMETRY_RUNTIME_API_BASE_URL',
  'DATABASE_URL',
]) {
  if (!runbook.includes(key)) fail(`runbook must document release env key: ${key}`);
}

for (const key of [
  'APP_EAS_PROJECT_FULL_NAME',
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
  'APP_TELEMETRY_RUNTIME_API_BASE_URL',
  'DATABASE_URL',
]) {
  if (!inputChecklist.includes(key)) fail(`input checklist must document release env key: ${key}`);
}

for (const needle of [
  'mobile/release.env.local',
  '不保存任何 secret value',
  'release:external-evidence:input-status',
  'current_completion_blocker_inputs',
  'evidence_refresh_inputs',
  'app_store_record_prerequisites',
  'ready_for_current_completion_inputs',
  'ready_for_app_store_record_inputs',
  'ASC_APP_ID',
  'release:external-evidence:status -- --release-env-file=release.env.local --json',
  'env_files',
  'release:external-evidence:fill-inputs',
  'release:external-evidence:github-secrets:check',
  'release:external-evidence:github-secrets:strict',
  'release:external-evidence:github-secrets:sync',
  'release:external-evidence:github-secrets:sync:contract',
  'Production',
  'GitHub Environment',
  'dry-run',
  'ready_for_workflow_validate=false',
  'App-External-Signoff-Prerequisites-2026-05-16T07-29-51-655Z.json',
  'App-External-Signoff-Prerequisites-2026-05-16T07-29-50-317Z.json',
  'summary.report_contains_secrets=false',
  'app.eas_project_id_valid=true',
  'credentials.expo_token_present=true',
  'device_visibility.ios.requested_device_visible=true',
  'device_visibility.android.requested_device_visible=true',
]) {
  if (!inputChecklist.includes(needle)) fail(`input checklist must mention ${needle}.`);
}

for (const needle of [
  'mobile/release.env.example',
  'App-External-Signoff-Input-Checklist-2026-05-16.md',
  'release:external-evidence:input-status',
  'current_completion_blocker_inputs',
  'evidence_refresh_inputs',
  'app_store_record_prerequisites',
  'ready_for_current_completion_inputs',
  'ready_for_app_store_record_inputs',
  'ASC_APP_ID',
  'release:external-evidence:fill-inputs',
  'GitHub repository secrets',
  'Production',
  'GitHub Environment',
  'release:external-evidence:github-secrets:check',
  'release:external-evidence:github-secrets:strict',
  'release:external-evidence:github-secrets:sync',
  'release:external-evidence:github-secrets:sync:contract',
  'release:external-evidence:env-template:check',
  'release:external-evidence:signoff:android-dry-run',
  'Do not commit real secrets',
  'mobile/release.env.local',
  'release.env.*.local',
  '--release-env-file=release.env.local',
  'release:external-evidence:validate -- --release-env-file=release.env.local --physical-platform=android',
  '--physical-platform=android',
  'external evidence handoff',
]) {
  if (!runbook.includes(needle)) fail(`runbook must mention ${needle}.`);
}

for (const pattern of ['release.env.local', 'release.env.*.local']) {
  if (!gitignore.includes(pattern)) fail(`mobile/.gitignore must ignore ${pattern}.`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('[release-env-template-check] ok: release env template is complete and secret-safe');
