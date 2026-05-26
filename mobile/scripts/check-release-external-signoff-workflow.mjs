import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const workflowPath = path.join(repoRoot, '.github/workflows/app-release-external-signoff.yml');

function fail(message) {
  console.error(`[release-external-signoff-workflow-check] ${message}`);
  process.exitCode = 1;
}

function requireText(text, needle, message) {
  if (!text.includes(needle)) {
    fail(message);
  }
}

function requireOrdered(text, needles, message) {
  let offset = -1;
  for (const needle of needles) {
    const index = text.indexOf(needle, offset + 1);
    if (index < 0) {
      fail(`${message}: missing ${needle}`);
      return;
    }
    offset = index;
  }
}

if (!fs.existsSync(workflowPath)) {
  fail(`workflow file missing: ${path.relative(repoRoot, workflowPath)}`);
  process.exit(process.exitCode);
}

const workflow = fs.readFileSync(workflowPath, 'utf8');

for (const needle of [
  'workflow_dispatch:',
  'mode:',
  '- dry-run',
  '- validate',
  '- run',
  'runner_json:',
  'github_environment:',
  'default: Production',
  'environment: ${{ inputs.github_environment }}',
  'runs-on: ${{ fromJSON(inputs.runner_json) }}',
  'physical_platform:',
  'android_device_serial:',
  'require_testflight:',
  'continue_on_error:',
  'native_crash_environment:',
  'cancel-in-progress: false',
]) {
  requireText(workflow, needle, `workflow must expose ${needle}`);
}

for (const needle of [
  'APP_RELEASE_EXTERNAL_SIGNOFF_RUN: ${{ inputs.mode == \'run\' && \'true\' || \'false\' }}',
  'APP_PHYSICAL_DEVICE_PLATFORM: ${{ inputs.physical_platform }}',
  'APP_ANDROID_DEVICE_SERIAL: ${{ inputs.android_device_serial || secrets.APP_ANDROID_DEVICE_SERIAL }}',
  'APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR: ${{ runner.temp }}/app-release-external-signoff-report',
  'DEVELOPER_DIR: /Applications/Xcode.app/Contents/Developer',
  'EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}',
  'ASC_APPLE_ID: ${{ secrets.ASC_APPLE_ID }}',
  'EXPO_APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.EXPO_APPLE_APP_SPECIFIC_PASSWORD }}',
  'APP_STORE_CONNECT_ISSUER_ID: ${{ secrets.APP_STORE_CONNECT_ISSUER_ID }}',
  'APP_STORE_CONNECT_KEY_ID: ${{ secrets.APP_STORE_CONNECT_KEY_ID }}',
  'APP_STORE_CONNECT_PRIVATE_KEY: ${{ secrets.APP_STORE_CONNECT_PRIVATE_KEY }}',
  'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN: ${{ secrets.APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN }}',
  'APP_SENTRY_AUTH_TOKEN: ${{ secrets.APP_SENTRY_AUTH_TOKEN }}',
  'APP_NATIVE_CRASH_SENTRY_EVENT_ID: ${{ secrets.APP_NATIVE_CRASH_SENTRY_EVENT_ID }}',
  'APP_TELEMETRY_RUNTIME_API_BASE_URL: ${{ secrets.APP_TELEMETRY_RUNTIME_API_BASE_URL }}',
  'DATABASE_URL: ${{ secrets.APP_RELEASE_DATABASE_URL }}',
]) {
  requireText(workflow, needle, `workflow must preserve safe env mapping for ${needle.split(':')[0]}`);
}

requireOrdered(
  workflow,
  [
    'Run App release preflight',
    "APP_RELEASE_EXTERNAL_SIGNOFF_RUN: 'false'",
    'npm --prefix mobile run release:preflight',
    'Run local evidence safety gates',
    'npm --prefix mobile run release:evidence-redaction:check',
    'npm --prefix mobile run release:evidence-sanitization:check',
    'npm --prefix mobile run release:external-evidence:handoff:contract',
    'Validate release secrets for run mode',
    "if: ${{ inputs.mode == 'run' }}",
    'Run external release signoff',
    'Generate external release handoff report',
    'if: always()',
    'Generate App goal completion audit report',
    'if: always()',
    'Check generated App release evidence redaction',
    'if: always()',
    'Upload App release evidence',
    "if: ${{ always() && steps.evidence_redaction.outcome == 'success' }}",
  ],
  'workflow must run safety gates, signoff, generated handoff, goal audit artifact, redaction, then guarded artifact upload in order'
);

for (const needle of [
  'require_secret EXPO_TOKEN',
  'require_secret ASC_APPLE_ID',
  'require_secret EXPO_APPLE_APP_SPECIFIC_PASSWORD',
  'require_secret APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN',
  'require_secret APP_SENTRY_ORG',
  'require_secret APP_SENTRY_PROJECT',
  'require_secret APP_SENTRY_AUTH_TOKEN',
  'require_secret APP_NATIVE_CRASH_SENTRY_EVENT_ID',
  'require_secret APP_TELEMETRY_RUNTIME_API_BASE_URL',
  'require_secret DATABASE_URL',
  'require_secret APP_STORE_CONNECT_ISSUER_ID',
  'require_secret APP_STORE_CONNECT_KEY_ID',
  'require_secret APP_STORE_CONNECT_PRIVATE_KEY',
  'require_secret APP_IOS_DEVICE_UDID',
  'require_secret APP_IOS_DEVICE_APP_PATH',
  'require_secret APP_ANDROID_DEVICE_SERIAL',
  'if [ "${APP_PHYSICAL_DEVICE_PLATFORM}" = "android" ]; then',
]) {
  requireText(workflow, needle, `workflow run-mode prerequisite probe must include ${needle}`);
}

for (const needle of [
  'Run App release preflight',
  "APP_RELEASE_EXTERNAL_SIGNOFF_RUN: 'false'",
  'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix mobile run release:preflight',
  'script="release:external-evidence:run"',
  'script="release:external-evidence:validate"',
  'script="release:external-evidence:signoff"',
  'args+=(--dry-run)',
  'args+=(--continue-on-error)',
  'args+=(--no-testflight)',
  'args+=(--physical-platform="${APP_PHYSICAL_DEVICE_PLATFORM}")',
  'args+=(--report-dir="${APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR}")',
  'npm --prefix mobile run "${script}" -- "${args[@]}"',
  'release:external-evidence:handoff:check',
  'goal:completion:audit -- --report-dir="${APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR}"',
]) {
  requireText(workflow, needle, `workflow signoff command must preserve ${needle}`);
}

for (const needle of [
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-EAS-iOS-Release-*.json',
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-EAS-Android-Release-*.json',
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Physical-Device-*.json',
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Push-Delivery-*.json',
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Native-Crash-Runtime-*.json',
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Telemetry-Runtime-*.json',
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-DB-Parity-*.json',
  '${{ runner.temp }}/app-release-external-signoff-report/App-External-Signoff-Prerequisites-*.json',
  '${{ runner.temp }}/app-release-external-signoff-report/App-External-Evidence-Status-*.json',
  '${{ runner.temp }}/app-release-external-signoff-report/App-External-Evidence-Handoff-*.json',
  '${{ runner.temp }}/app-release-external-signoff-report/App-Goal-Completion-Audit-*.json',
  'if-no-files-found: warn',
]) {
  requireText(workflow, needle, `workflow artifact upload must include ${needle}`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('[release-external-signoff-workflow-check] ok: workflow contract is pinned');
