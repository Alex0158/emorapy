#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const failures = [];

function fail(message) {
  failures.push(message);
}

function readText(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`missing required file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function readJson(relativePath) {
  const source = readText(relativePath);
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function requireNeedles(relativePath, label, needles) {
  const source = readText(relativePath);
  if (!source) return;
  for (const needle of needles) {
    if (!source.includes(needle)) {
      fail(`${label} missing "${needle}" in ${relativePath}`);
    }
  }
}

function requireScript(packageJson, name, expectedValue) {
  const actual = packageJson.scripts?.[name];
  if (actual !== expectedValue) {
    fail(`mobile/package.json script "${name}" must be "${expectedValue}", got ${JSON.stringify(actual)}`);
  }
}

const mobilePackage = readJson('mobile/package.json');
const releasePreflight = mobilePackage.scripts?.['release:preflight'] ?? '';

requireScript(mobilePackage, 'smoke:true-service', 'node scripts/app-true-service-smoke.mjs');
requireScript(mobilePackage, 'true-service:check', 'node scripts/check-app-true-service-smoke-contracts.mjs');

if (!releasePreflight.includes('true-service:check')) {
  fail('release:preflight must include true-service:check');
}

const featureGateIndex = releasePreflight.indexOf('features:check');
const trueServiceGateIndex = releasePreflight.indexOf('true-service:check');
const platformGateIndex = releasePreflight.indexOf('platform:check');
if (featureGateIndex >= 0 && trueServiceGateIndex >= 0 && trueServiceGateIndex < featureGateIndex) {
  fail('release:preflight must run true-service:check after features:check');
}
if (platformGateIndex >= 0 && trueServiceGateIndex >= 0 && trueServiceGateIndex > platformGateIndex) {
  fail('release:preflight must run true-service:check before platform:check');
}

requireNeedles('mobile/scripts/app-true-service-smoke.mjs', 'true-service smoke scope and CLI contract', [
  "const VALID_SCOPES = new Set(['m1', 'm2', 'm3', 'm4', 'm5', 'all']);",
  '--scope=m1|m2|m3|m4|m5|all',
  '--run',
  '--dry-run',
  '--bootstrap-local-users',
  '--deep',
  '--m1-inject-expired-session',
  '--m1-stream-replay',
  '--m2-inject-failure',
  '--m2-inject-partial-success',
  '--request-ai',
  '--allow-remote-api',
  '--allow-remote-db',
  'APP_SMOKE_M1_STREAM_REPLAY=true',
  'APP_SMOKE_BACKEND_DATABASE_URL',
]);

requireNeedles('mobile/scripts/app-true-service-smoke.mjs', 'true-service smoke safety contract', [
  'Refusing to run against a non-local API URL without explicit override.',
  'Refusing to run local API smoke because the backend database target is not local.',
  'App smoke DB-state injection is only allowed against local API and local DB.',
  'App smoke DB-state injection requires a backend DATABASE_URL.',
  'Register temporary smoke users. Requires local API + local DB.',
  'Refusing to create smoke users unless both API and database targets are local.',
  'writes only smoke-created quick sessions',
  'writes only smoke-created interview sessions',
]);

requireNeedles('mobile/scripts/app-true-service-smoke.mjs', 'M1 true-service smoke steps', [
  "addStep(report, 'm1.session', 'passed'",
  "addStep(report, 'm1.quick_case_create', 'passed'",
  "addStep(report, 'm1.claim_session', 'passed'",
  "addStep(report, 'm1.case_judgment_stream_replay', 'passed'",
  "addStep(report, 'm1.expired_submit_session_recovered', 'passed'",
  "addStep(report, 'm1.expired_result_access_rejected', 'passed'",
  "addStep(report, 'm1.expired_claim_session_ignored', 'passed'",
]);

requireNeedles('mobile/scripts/app-true-service-smoke.mjs', 'M2 true-service smoke steps', [
  "addStep(report, 'm2.profile_me', 'passed'",
  "addStep(report, 'm2.consent', 'passed'",
  "addStep(report, 'm2.interview_deep_flow', 'warn'",
  "addStep(report, 'm2.interview_start', 'passed'",
  "addStep(report, 'm2.interview_response_complete', 'passed'",
  "addStep(report, 'm2.my_story_completion', 'passed'",
  "addStep(report, 'm2.failed_session_retry_accept', 'passed'",
  "addStep(report, 'm2.partial_success_retry_rejected', 'passed'",
]);

requireNeedles('mobile/scripts/app-true-service-smoke.mjs', 'M3 true-service smoke steps', [
  "addStep(report, 'm3.room_create', 'passed'",
  "addStep(report, 'm3.message_a', 'passed'",
  "addStep(report, 'm3.invite_create', 'passed'",
  "addStep(report, 'm3.messages_list', 'passed'",
  "addStep(report, 'm3.judgment_status', 'passed'",
  "addStep(report, 'm3.invite_accept', 'passed'",
  "addStep(report, 'm3.message_b', 'passed'",
  "addStep(report, 'm3.message_a_followup', 'passed'",
  "addStep(report, 'm3.request_judgment', 'passed'",
]);

requireNeedles('mobile/scripts/app-true-service-smoke.mjs', 'M4 true-service smoke steps', [
  "stepPrefix: 'm4'",
  '`${stepPrefix}.evidence_upload`',
  "addStep(report, 'm4.pairing_create', 'passed'",
  "addStep(report, 'm4.pairing_join', 'passed'",
  "addStep(report, 'm4.case_create', 'passed'",
  "addStep(report, 'm4.repair_plan_generation', 'passed'",
  "addStep(report, 'm4.repair_plan_select', 'passed'",
  "addStep(report, 'm4.execution_confirm', 'passed'",
  "addStep(report, 'm4.repair_track_replan_accept', 'passed'",
  "addStep(report, 'm4.repair_track_replan_stream', 'passed'",
  'stream.persisted',
]);

requireNeedles('mobile/scripts/app-true-service-smoke.mjs', 'M5 true-service smoke steps', [
  "addStep(report, 'm5.push_token_register', 'passed'",
  "addStep(report, 'm5.notification_create', 'passed'",
  "addStep(report, 'm5.notification_list', 'passed'",
  "addStep(report, 'm5.notification_read', 'passed'",
  "addStep(report, 'm5.notification_snooze', 'passed'",
  "addStep(report, 'm5.notification_dismiss', 'passed'",
  "addStep(report, 'm5.notification_act', 'passed'",
  "addStep(report, 'm5.notification_mark_all_read', 'passed'",
  "addStep(report, 'm5.upload_case_create', 'passed'",
  "stepPrefix: 'm5'",
  "addStep(report, 'm5.telemetry_ingest', 'passed'",
  "addStep(report, 'm5.push_token_revoke', 'passed'",
]);

requireNeedles('mobile/scripts/check-app-goal-completion-audit.mjs', '/goal true-service audit wiring', [
  "'true-service:check'",
  'mobile/scripts/check-app-true-service-smoke-contracts.mjs',
  'M1 true-service smoke harness contract',
  'M2 true-service smoke harness contract',
  'M3 true-service smoke harness contract',
  'M4 true-service smoke harness contract',
  'M5 true-service smoke harness contract',
  'true-service smoke contract gate',
]);

requireNeedles('mobile/scripts/check-app-goal-audit-contract.mjs', '/goal contract true-service guard', [
  'check-app-true-service-smoke-contracts.mjs',
  'true-service:check',
  'm1.case_judgment_stream_replay',
  'm2.partial_success_retry_rejected',
  'm3.request_judgment',
  'm4.repair_track_replan_stream',
  'm5.telemetry_ingest',
]);

requireNeedles('docs/核心開發文件/08-測試規範與驗收/03-App測試與證據接入基線.md', 'App test baseline true-service contract docs', [
  'npm --prefix mobile run true-service:check',
  'true-service smoke harness contract',
  '--m1-stream-replay',
  '--m1-inject-expired-session',
  '--m2-inject-failure',
  '--m2-inject-partial-success',
  '--request-ai',
  'm4.repair_track_replan_stream',
  'm5.telemetry_ingest',
]);

requireNeedles('docs/核心開發文件/20-App端/03-App完整版本開發Roadmap.md', 'App roadmap true-service contract docs', [
  'npm --prefix mobile run true-service:check',
  'true-service smoke harness contract',
  'M1-M5 true-service smoke',
]);

requireNeedles(
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md',
  'App goal audit true-service docs',
  [
    'npm --prefix mobile run true-service:check',
    'true-service smoke contract gate',
    'M1-M5 true-service smoke harness',
  ]
);

if (failures.length > 0) {
  console.error('[app-true-service-smoke-contract] failures:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[app-true-service-smoke-contract] ok: M1-M5 true-service smoke harness, safety, docs, and /goal audit contracts checked');
