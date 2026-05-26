import path from 'node:path';
import process from 'node:process';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const auditScript = path.join(scriptDir, 'check-app-goal-completion-audit.mjs');
const copyCheckScript = path.join(scriptDir, 'check-user-copy-contracts.mjs');
const releaseEvidenceScript = path.join(scriptDir, 'check-release-evidence.mjs');
const releaseCompletionAuditContractScript = path.join(scriptDir, 'check-release-completion-audit-contract.mjs');
const externalStatusContractScript = path.join(scriptDir, 'check-release-external-evidence-status-contract.mjs');
const prereqReportContractScript = path.join(scriptDir, 'check-release-external-signoff-prerequisite-report.mjs');
const externalWorkflowContractScript = path.join(scriptDir, 'check-release-external-signoff-workflow.mjs');
const externalSignoffScript = path.join(scriptDir, 'run-release-external-evidence-signoff.mjs');
const trueServiceContractScript = path.join(scriptDir, 'check-app-true-service-smoke-contracts.mjs');

const requiredChecklistIds = new Set([
  'tech_stack',
  'ios_first_android_compatible',
  'm0_foundation',
  'm1_quick_auth',
  'm2_profile_interview',
  'm3_chat',
  'm4_formal_case_repair',
  'm5_push_deeplink_upload_telemetry',
  'ui_ux_accessibility',
  'tests_and_gates',
  'docs_progress_rewrite',
  'release_signoff',
]);

function fail(message) {
  console.error(`[app-goal-audit-contract] ${message}`);
  process.exit(1);
}

function runAudit(args) {
  return spawnSync(process.execPath, [auditScript, ...args], {
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
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`${label} did not produce valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateReportArtifactContract(referenceAudit) {
  const reportDir = mkdtempSync(path.join(os.tmpdir(), 'cj-goal-audit-contract-'));
  try {
    const result = runAudit(['--json', `--report-dir=${reportDir}`]);
    if (result.status !== 0) {
      fail(`report-dir JSON audit must exit 0, got ${result.status}`);
    }
    if (result.stderr.trim()) {
      fail(`report-dir JSON audit must not write stderr: ${result.stderr.trim()}`);
    }
    const stdoutAudit = parseJsonResult('report-dir JSON audit stdout', result);
    validateAuditRecord('report-dir JSON audit stdout', stdoutAudit);

    const files = readdirSync(reportDir).filter((entry) =>
      /^App-Goal-Completion-Audit-.+\.json$/.test(entry)
    );
    if (files.length !== 1) {
      fail(`report-dir JSON audit must write exactly one App-Goal-Completion-Audit-*.json file, got ${files.length}`);
    }

    const reportAudit = JSON.parse(readFileSync(path.join(reportDir, files[0]), 'utf8'));
    validateAuditRecord('report-dir JSON audit file', reportAudit);
    if (reportAudit.generated_at !== stdoutAudit.generated_at) {
      fail('report-dir JSON audit file generated_at must match stdout generated_at');
    }
    if (reportAudit.complete !== stdoutAudit.complete || reportAudit.complete !== referenceAudit.complete) {
      fail('report-dir JSON audit file complete flag must match stdout and baseline audit');
    }
    if (reportAudit.summary.passed !== stdoutAudit.summary.passed) {
      fail('report-dir JSON audit file summary must match stdout summary');
    }
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
}

function validateAuditRecord(label, audit) {
  if (!audit || typeof audit !== 'object') {
    fail(`${label} JSON root must be an object`);
  }
  if (typeof audit.objective !== 'string' || !audit.objective.includes('Expo + React Native + TypeScript')) {
    fail(`${label} objective must preserve the active /goal text`);
  }
  if (Number.isNaN(Date.parse(audit.generated_at))) {
    fail(`${label} generated_at must be an ISO-like timestamp`);
  }
  if (typeof audit.complete !== 'boolean') {
    fail(`${label} complete must be boolean`);
  }
  if (!audit.summary || typeof audit.summary !== 'object') {
    fail(`${label} summary must be an object`);
  }
  if (!Number.isInteger(audit.summary.passed) || !Number.isInteger(audit.summary.missing_or_incomplete)) {
    fail(`${label} summary passed/missing counts must be integers`);
  }
  if (!Array.isArray(audit.checklist) || audit.checklist.length === 0) {
    fail(`${label} checklist must be a non-empty array`);
  }

  const ids = new Set();
  let passed = 0;
  let missing = 0;
  for (const entry of audit.checklist) {
    if (!entry || typeof entry !== 'object') {
      fail(`${label} checklist entries must be objects`);
    }
    if (typeof entry.id !== 'string' || entry.id.length === 0) {
      fail(`${label} checklist entry id must be a non-empty string`);
    }
    if (ids.has(entry.id)) {
      fail(`${label} checklist id is duplicated: ${entry.id}`);
    }
    ids.add(entry.id);
    if (typeof entry.requirement !== 'string' || entry.requirement.length === 0) {
      fail(`${label} checklist ${entry.id} requirement must be a non-empty string`);
    }
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
      fail(`${label} checklist ${entry.id} evidence must be a non-empty array`);
    }
    if (!entry.evidence.every((item) => typeof item === 'string' && item.length > 0)) {
      fail(`${label} checklist ${entry.id} evidence entries must be non-empty strings`);
    }
    if (!['passed', 'missing_or_incomplete'].includes(entry.status)) {
      fail(`${label} checklist ${entry.id} has invalid status: ${entry.status}`);
    }
    if (entry.status === 'passed') passed += 1;
    if (entry.status === 'missing_or_incomplete') missing += 1;
  }

  for (const id of requiredChecklistIds) {
    if (!ids.has(id)) {
      fail(`${label} checklist missing required id: ${id}`);
    }
  }

  if (audit.summary.passed !== passed || audit.summary.missing_or_incomplete !== missing) {
    fail(`${label} summary counts do not match checklist statuses`);
  }
  if (audit.complete !== (missing === 0)) {
    fail(`${label} complete must be true only when there are no missing checklist items`);
  }

  const releaseSignoff = audit.checklist.find((entry) => entry.id === 'release_signoff');
  if (!releaseSignoff.requirement.includes('Release sign-off strict audit')) {
    fail(`${label} release_signoff requirement must explain the strict release audit dependency`);
  }
  if (audit.complete && releaseSignoff.status !== 'passed') {
    fail(`${label} complete=true requires release_signoff to pass`);
  }
  if (!releaseSignoff.details || typeof releaseSignoff.details !== 'object') {
    fail(`${label} release_signoff must include structured details`);
  }
  const releaseSignoffDetails = releaseSignoff.details;
  for (const requiredArray of [
    'blocker_ids',
    'handoff_blocker_ids',
    'prerequisite_only_blocker_ids',
    'release_completion_handoff_blocker_ids',
  ]) {
    if (!Array.isArray(releaseSignoffDetails[requiredArray])) {
      fail(`${label} release_signoff.details.${requiredArray} must be an array`);
    }
  }
  if (releaseSignoffDetails.release_audit_type !== 'app-release-completion-audit') {
    fail(`${label} release_signoff.details.release_audit_type must be app-release-completion-audit`);
  }
  if (typeof releaseSignoffDetails.release_audit_complete !== 'boolean') {
    fail(`${label} release_signoff.details.release_audit_complete must be boolean`);
  }
  if (!Number.isInteger(releaseSignoffDetails.release_audit_strict_exit_code)) {
    fail(`${label} release_signoff.details.release_audit_strict_exit_code must be an integer`);
  }
  if (releaseSignoff.status === 'missing_or_incomplete') {
    if (typeof releaseSignoff.caveat !== 'string' || releaseSignoff.caveat.length === 0) {
      fail(`${label} incomplete release_signoff must include a caveat`);
    }
    for (const requiredSnippet of [
      'blocker_ids:',
      'handoff_blocker_ids:',
      'prerequisite_only_blocker_ids:',
      'external_handoff:',
      'app_store_connect_api_credentials',
      'telemetry_runtime_evidence',
      'sentry_runtime_query_credentials',
      'native_crash_event_id',
      'ios_physical_device_visible',
      'android_physical_device_visible',
    ]) {
      if (!releaseSignoff.caveat.includes(requiredSnippet)) {
        fail(`${label} incomplete release_signoff caveat must include ${requiredSnippet}`);
      }
    }
    if (
      releaseSignoffDetails.blocker_ids.includes('release_production_db_parity') &&
      !releaseSignoff.caveat.includes('release_db_parity_evidence')
    ) {
      fail(`${label} incomplete release_signoff caveat must include release_db_parity_evidence when release DB parity remains unresolved`);
    }
    for (const requiredPrerequisiteOnlyBlocker of [
      'sentry_runtime_query_credentials',
      'native_crash_event_id',
      'ios_physical_device_visible',
      'android_physical_device_visible',
    ]) {
      if (!releaseSignoffDetails.prerequisite_only_blocker_ids.includes(requiredPrerequisiteOnlyBlocker)) {
        fail(`${label} release_signoff.details.prerequisite_only_blocker_ids must include ${requiredPrerequisiteOnlyBlocker}`);
      }
    }
    if (
      typeof releaseSignoffDetails.latest_external_handoff_path !== 'string' ||
      !releaseSignoffDetails.latest_external_handoff_path.includes('App-External-Evidence-Handoff-')
    ) {
      fail(`${label} release_signoff.details.latest_external_handoff_path must point at an external handoff snapshot`);
    }
    if (
      !releaseSignoffDetails.handoff_summary ||
      releaseSignoffDetails.handoff_summary.prerequisite_only_blocker_count !==
        releaseSignoffDetails.prerequisite_only_blocker_ids.length ||
      releaseSignoffDetails.handoff_summary.known_blocker_count !== 16
    ) {
      fail(`${label} release_signoff.details.handoff_summary must expose prerequisite-only and known blocker counts`);
    }
  }

  const testsAndGates = audit.checklist.find((entry) => entry.id === 'tests_and_gates');
  const testsAndGatesText = `${testsAndGates.requirement}\n${testsAndGates.evidence.join('\n')}`;
  if (!testsAndGatesText.includes('release:external-evidence:status:contract')) {
    fail(`${label} tests_and_gates must require release:external-evidence:status:contract`);
  }
  if (!testsAndGatesText.includes('routes:check')) {
    fail(`${label} tests_and_gates must require routes:check`);
  }
  if (!testsAndGatesText.includes('features:check')) {
    fail(`${label} tests_and_gates must require features:check`);
  }
  if (!testsAndGatesText.includes('true-service:check')) {
    fail(`${label} tests_and_gates must require true-service:check`);
  }
  if (!testsAndGatesText.includes('true-service smoke contract gate')) {
    fail(`${label} tests_and_gates must describe true-service smoke contract coverage`);
  }
  if (!testsAndGatesText.includes('mobile/scripts/check-app-true-service-smoke-contracts.mjs M1-M5 true-service smoke harness contract')) {
    fail(`${label} tests_and_gates must include the true-service smoke contract checker evidence`);
  }
  if (!testsAndGatesText.includes('web:routes:smoke')) {
    fail(`${label} tests_and_gates must require web:routes:smoke`);
  }
  if (!testsAndGatesText.includes('docs:check')) {
    fail(`${label} tests_and_gates must require docs:check`);
  }
  if (!testsAndGatesText.includes('docs:audit:dry-run:current')) {
    fail(`${label} tests_and_gates must require docs:audit:dry-run:current`);
  }
  if (
    !testsAndGatesText.includes(
      'docs:check and docs:audit:dry-run:current keep core document structure, truth checks, stale App status guard, and current SSOT metadata in the App preflight path'
    )
  ) {
    fail(`${label} tests_and_gates must state that docs checks and current docs audit are wired into App preflight`);
  }
  if (!testsAndGatesText.includes('release:external-evidence:fixtures:check')) {
    fail(`${label} tests_and_gates must require release:external-evidence:fixtures:check`);
  }
  if (!testsAndGatesText.includes('release:external-evidence:handoff:check')) {
    fail(`${label} tests_and_gates must require release:external-evidence:handoff:check`);
  }
  if (!testsAndGatesText.includes('release:external-evidence:handoff:contract')) {
    fail(`${label} tests_and_gates must require release:external-evidence:handoff:contract`);
  }
  if (!testsAndGatesText.includes('release:external-evidence:env-template:check')) {
    fail(`${label} tests_and_gates must require release:external-evidence:env-template:check`);
  }
  if (!testsAndGatesText.includes('release:external-evidence:input-status')) {
    fail(`${label} tests_and_gates must require release:external-evidence:input-status`);
  }
  if (!testsAndGatesText.includes('release:external-evidence:prereq-report:check')) {
    fail(`${label} tests_and_gates must require release:external-evidence:prereq-report:check`);
  }
  if (
    !testsAndGatesText.includes(
      'release:external-evidence:prereq-report:check covers iOS/Android device_visibility, Android physical-device validate, env-file placeholder guard, and env-file key allowlist'
    )
  ) {
    fail(`${label} tests_and_gates must state that prereq-report checks iOS/Android device visibility, Android physical-device validate, env-file placeholder guard, and env-file key allowlist`);
  }
  if (!testsAndGatesText.includes('release:external-evidence:workflow:check')) {
    fail(`${label} tests_and_gates must require release:external-evidence:workflow:check`);
  }
  if (!testsAndGatesText.includes('release:external-evidence:signoff')) {
    fail(`${label} tests_and_gates must require release:external-evidence:signoff`);
  }
  if (!testsAndGatesText.includes('release:external-evidence:signoff:android-dry-run')) {
    fail(`${label} tests_and_gates must require release:external-evidence:signoff:android-dry-run`);
  }
  if (!testsAndGatesText.includes('release:completion:audit:contract')) {
    fail(`${label} tests_and_gates must require release:completion:audit:contract`);
  }
  if (!testsAndGatesText.includes('release:evidence:check')) {
    fail(`${label} tests_and_gates must require release:evidence:check`);
  }
  if (
    !testsAndGatesText.includes(
      'release:completion:audit:contract covers app-release-completion-audit JSON schema, blocker_ids / handoff_blocker_ids consistency, external handoff coverage, strict exit-code consistency, required release blocker ids, and preflight wiring'
    )
  ) {
    fail(`${label} tests_and_gates must state that release completion audit contract checks JSON schema, blocker_ids / handoff_blocker_ids consistency, external handoff coverage, strict exit-code consistency, required release blocker ids, and preflight wiring`);
  }
  if (
    !testsAndGatesText.includes(
      'release:evidence:check validates App-External-Evidence-Status-*.json and App-External-Evidence-Handoff-*.json identity, blocker alignment, current release completion audit handoff_blocker_ids coverage, release/prerequisite classification, timestamp coherence, command coverage, final gates, and docs references'
    )
  ) {
    fail(`${label} tests_and_gates must state that release:evidence:check validates external status/handoff snapshots`);
  }
  if (!testsAndGatesText.includes('release:preflight command includes each required App gate script')) {
    fail(`${label} tests_and_gates must state that release:preflight includes each required App gate script`);
  }
  if (!testsAndGatesText.includes('mobile/scripts/lib/release-evidence-policy.mjs')) {
    fail(`${label} tests_and_gates must include the shared external evidence policy file`);
  }
  if (!testsAndGatesText.includes('mobile/scripts/run-telemetry-runtime-smoke.mjs App telemetry runtime event + OTLP release evidence runner')) {
    fail(`${label} tests_and_gates must include the telemetry runtime evidence runner`);
  }
  if (
    !testsAndGatesText.includes(
      'release:external-evidence:status:contract covers iOS/Android platform-specific validate/run next commands, signed app path, Android serial, and strict audit gate'
    )
  ) {
    fail(`${label} tests_and_gates must state that status-contract checks iOS/Android platform-specific validate/run next commands, signed app path, Android serial, and strict audit gate`);
  }

  const telemetry = audit.checklist.find((entry) => entry.id === 'm5_push_deeplink_upload_telemetry');
  const telemetryText = `${telemetry.requirement}\n${telemetry.evidence.join('\n')}`;
  if (!telemetryText.includes('/telemetry/otlp/v1/traces')) {
    fail(`${label} m5_push_deeplink_upload_telemetry must include CJ OTLP collector evidence`);
  }
  if (!telemetry.evidence.includes('backend/src/routes/app-telemetry.routes.ts /telemetry/otlp/v1/traces safe OTLP collector baseline')) {
    fail(`${label} m5_push_deeplink_upload_telemetry must use a file-backed OTLP route evidence label`);
  }
  if (!telemetry.evidence.includes('mobile/scripts/run-telemetry-runtime-smoke.mjs telemetry runtime evidence runner')) {
    fail(`${label} m5_push_deeplink_upload_telemetry must include telemetry runtime evidence runner coverage`);
  }
  if (telemetry.evidence.some((item) => item.includes('backend /'))) {
    fail(`${label} m5_push_deeplink_upload_telemetry evidence must not contain malformed backend path labels`);
  }

  const uiUx = audit.checklist.find((entry) => entry.id === 'ui_ux_accessibility');
  const uiUxText = `${uiUx.requirement}\n${uiUx.evidence.join('\n')}`;
  if (!uiUxText.includes('mobile/src/features/m2/labels.ts visible copy module scan')) {
    fail(`${label} ui_ux_accessibility must include feature label module copy coverage`);
  }
  if (!uiUxText.includes('script copy:check')) {
    fail(`${label} ui_ux_accessibility must include copy:check evidence`);
  }

  const copyCheckSource = readFileSync(copyCheckScript, 'utf8');
  for (const requiredSnippet of [
    "const scannedRoots = ['app', 'src/ui', 'src/features'];",
    'isVisibleCopyModule',
    'visible copy module',
    'relationship_history',
  ]) {
    if (!copyCheckSource.includes(requiredSnippet)) {
      fail(`${label} copy gate source must include ${requiredSnippet}`);
    }
  }

  const releaseCompletionAuditContractSource = readFileSync(releaseCompletionAuditContractScript, 'utf8');
  for (const requiredSnippet of [
    'app-release-completion-audit',
    'blocker_ids',
    'handoff_blocker_ids',
    'completionToExternalHandoffBlockerIds',
    'validateExternalHandoffCoverage',
    'requiredCheckIds',
    'app_store_connect_api_credentials',
    'strict JSON audit complete=false must exit non-zero',
    'release:preflight must include release:completion:audit:contract',
    'telemetry_runtime_evidence',
  ]) {
    if (!releaseCompletionAuditContractSource.includes(requiredSnippet)) {
      fail(`${label} release completion audit contract source must include ${requiredSnippet}`);
    }
  }

  const trueServiceContractSource = readFileSync(trueServiceContractScript, 'utf8');
  for (const requiredSnippet of [
    'release:preflight must include true-service:check',
    'VALID_SCOPES',
    '--bootstrap-local-users',
    '--allow-remote-db',
    'Refusing to run local API smoke because the backend database target is not local.',
    'App smoke DB-state injection is only allowed against local API and local DB.',
    'm1.case_judgment_stream_replay',
    'm1.expired_claim_session_ignored',
    'm2.failed_session_retry_accept',
    'm2.partial_success_retry_rejected',
    'm3.request_judgment',
    'm4.repair_track_replan_stream',
    'm5.notification_act',
    'm5.telemetry_ingest',
    'npm --prefix mobile run true-service:check',
  ]) {
    if (!trueServiceContractSource.includes(requiredSnippet)) {
      fail(`${label} true-service smoke contract source must include ${requiredSnippet}`);
    }
  }

  const releaseEvidenceSource = readFileSync(releaseEvidenceScript, 'utf8');
  for (const requiredSnippet of [
    "findEvidenceByPrefix('App-External-Evidence-Status-', ['.json'])",
    "findEvidenceByPrefix('App-External-Evidence-Handoff-', ['.json'])",
    'externalBlockerIds',
    'requireSameIdSet',
    'external status blockers and handoff items',
    'runReleaseCompletionAuditJson',
    'current release completion audit handoff_blocker_ids',
    'release-audit-covered',
    'source_release_completion_audit_type',
    'release_completion_blocker',
    'prerequisite_only',
    'release_completion_handoff_blocker_count',
    'relatedExternalEvidenceWindowMs',
    'source_status_generated_at',
    'source_release_completion_audit_generated_at',
    'external persisted status generated_at',
    'sentry_runtime_query_credentials',
    'native_crash_event_id',
    'sentry_runtime_query_credentials_present',
    'native_crash_event_id_present',
    'release:external-evidence:validate -- --physical-platform=ios',
    'release:external-evidence:validate -- --physical-platform=android',
    'goal completion audit doc',
    'App-External-Evidence-Handoff-*.json',
    'telemetry_runtime_evidence',
  ]) {
    if (!releaseEvidenceSource.includes(requiredSnippet)) {
      fail(`${label} release evidence checker source must include ${requiredSnippet}`);
    }
  }

  const externalStatusContractSource = readFileSync(externalStatusContractScript, 'utf8');
  for (const requiredSnippet of [
    'release:external-evidence:validate -- --physical-platform=ios',
    'release:external-evidence:run -- --physical-platform=ios',
    'APP_IOS_DEVICE_APP_PATH=<signed-app-path>',
    'release:external-evidence:validate -- --physical-platform=android',
    'release:external-evidence:run -- --physical-platform=android',
    'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial>',
    'release:completion:audit:strict',
    'telemetry:runtime:smoke -- --run',
  ]) {
    if (!externalStatusContractSource.includes(requiredSnippet)) {
      fail(`${label} status contract source must include ${requiredSnippet}`);
    }
  }

  const prereqReportContractSource = readFileSync(prereqReportContractScript, 'utf8');
  for (const requiredSnippet of [
    "expectedPhysicalPlatform = 'ios'",
    'android-validate-only',
    'Android validate blocks on device visibility',
    'placeholder-env-file',
    'REPLACE_WITH_ placeholders must not satisfy release prerequisites',
    'unsafe env-file keys are rejected',
    'unsupported --release-env-file key: NODE_OPTIONS',
    'device_visibility.android',
    'android_physical_device_visible',
    'requested_device_visible',
    'dry-run-status-report blockers must include sentry_runtime_query_credentials',
    'dry-run-status-report sentry_runtime_query_credentials handoff item must be prerequisite-only',
    'dry-run-status-report blockers must include native_crash_event_id',
    'dry-run-status-report native_crash_event_id handoff item must be prerequisite-only',
  ]) {
    if (!prereqReportContractSource.includes(requiredSnippet)) {
      fail(`${label} prereq-report contract source must include ${requiredSnippet}`);
    }
  }

  const externalSignoffSource = readFileSync(externalSignoffScript, 'utf8');
  for (const requiredSnippet of [
    '--release-env-file=',
    'allowedReleaseEnvFileKeys',
    'unsupported --release-env-file key',
    'isPlaceholderValue',
    'REPLACE_WITH_',
    'loaded_keys',
  ]) {
    if (!externalSignoffSource.includes(requiredSnippet)) {
      fail(`${label} external signoff source must include ${requiredSnippet}`);
    }
  }

  const externalWorkflowContractSource = readFileSync(externalWorkflowContractScript, 'utf8');
  for (const requiredSnippet of [
    'Run App release preflight',
    "APP_RELEASE_EXTERNAL_SIGNOFF_RUN: 'false'",
    'npm --prefix mobile run release:preflight',
    'Generate App goal completion audit report',
    'goal:completion:audit -- --report-dir="${APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR}"',
    'App-Goal-Completion-Audit-*.json',
    'workflow must run safety gates, signoff, generated handoff, goal audit artifact, redaction, then guarded artifact upload in order',
  ]) {
    if (!externalWorkflowContractSource.includes(requiredSnippet)) {
      fail(`${label} external workflow contract source must include ${requiredSnippet}`);
    }
  }
}

const nonStrictResult = runAudit(['--json']);
if (nonStrictResult.status !== 0) {
  fail(`non-strict JSON audit must exit 0, got ${nonStrictResult.status}`);
}
if (nonStrictResult.stderr.trim()) {
  fail(`non-strict JSON audit must not write stderr: ${nonStrictResult.stderr.trim()}`);
}
const nonStrictAudit = parseJsonResult('non-strict JSON audit', nonStrictResult);
validateAuditRecord('non-strict JSON audit', nonStrictAudit);

const strictResult = runAudit(['--strict', '--json']);
const strictAudit = parseJsonResult('strict JSON audit', strictResult);
validateAuditRecord('strict JSON audit', strictAudit);
if (strictAudit.complete && strictResult.status !== 0) {
  fail(`strict JSON audit complete=true must exit 0, got ${strictResult.status}`);
}
if (!strictAudit.complete && strictResult.status === 0) {
  fail('strict JSON audit complete=false must exit non-zero');
}
if (strictAudit.complete !== nonStrictAudit.complete) {
  fail('strict and non-strict JSON audits must report the same complete value');
}
validateReportArtifactContract(nonStrictAudit);

console.log(
  `[app-goal-audit-contract] ok: JSON schema valid; complete=${nonStrictAudit.complete}; strict_exit=${strictResult.status ?? 1}`
);
