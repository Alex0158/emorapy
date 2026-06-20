import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const releaseCompletionAuditScript = path.join(scriptDir, 'check-release-completion-audit.mjs');
const evidenceRoot = path.join(
  repoRoot,
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證'
);
const evidenceReadmePath = path.join(evidenceRoot, 'README.md');
const releaseDocPath = path.join(evidenceRoot, 'App-Release-Hardening-2026-05-08.md');
const goalAuditPath = path.join(evidenceRoot, 'App-Goal-Completion-Audit-2026-05-08.md');
const roadmapPath = path.join(
  repoRoot,
  'docs/核心開發文件/20-App端/03-App完整版本開發Roadmap.md'
);
const pendingLedgerPath = path.join(
  repoRoot,
  'docs/核心開發文件/07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md'
);
const relatedExternalEvidenceWindowMs = 5 * 60 * 1000;

const requiredFlows = [
  '00-public-navigation-smoke.yaml',
  '10-quick-auth-form-smoke.yaml',
  '20-chat-entry-auth-gate-smoke.yaml',
  '30-notification-landing-auth-gate-smoke.yaml',
  '40-profile-interview-auth-gate-smoke.yaml',
  '50-case-repair-auth-gate-smoke.yaml',
  '60-deep-link-auth-resume-smoke.yaml',
];

const expectedEvidenceFile =
  process.env.APP_NATIVE_MAESTRO_EVIDENCE_FILE ||
  findEvidenceByPrefix('App-Native-Maestro-', ['.json']);
const evidencePath = expectedEvidenceFile ? path.resolve(evidenceRoot, expectedEvidenceFile) : null;
const iosReleaseSimulatorEvidenceFile =
  process.env.APP_IOS_RELEASE_SIMULATOR_EVIDENCE_FILE ||
  findEvidenceByPrefix('App-iOS-Release-Simulator-', ['.json']);
const iosReleaseSimulatorEvidencePath = iosReleaseSimulatorEvidenceFile
  ? path.resolve(evidenceRoot, iosReleaseSimulatorEvidenceFile)
  : null;
const externalStatusEvidenceFile =
  process.env.APP_EXTERNAL_EVIDENCE_STATUS_FILE ||
  findEvidenceByPrefix('App-External-Evidence-Status-', ['.json']);
const externalStatusEvidencePath = externalStatusEvidenceFile
  ? path.resolve(evidenceRoot, externalStatusEvidenceFile)
  : null;
const externalHandoffEvidenceFile =
  process.env.APP_EXTERNAL_EVIDENCE_HANDOFF_FILE ||
  findEvidenceByPrefix('App-External-Evidence-Handoff-', ['.json']);
const externalHandoffEvidencePath = externalHandoffEvidenceFile
  ? path.resolve(evidenceRoot, externalHandoffEvidenceFile)
  : null;
const app = JSON.parse(fs.readFileSync(path.join(mobileRoot, 'app.json'), 'utf8')).expo ?? {};
const issues = [];
const warnings = [];

const externalEvidenceKeys = [
  'eas_ios_release',
  'testflight',
  'eas_android_release',
  'physical_device',
  'push_delivery',
  'native_crash_runtime',
  'telemetry_runtime',
  'release_db_parity',
];

const externalBlockerIds = [
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

const externalCredentialFields = [
  'expo_token_present',
  'apple_submission_credentials_present',
  'app_store_connect_api_credentials_present',
  'push_delivery_token_present',
  'sentry_runtime_query_credentials_present',
  'native_crash_event_id_present',
  'telemetry_runtime_api_base_url_present',
  'release_database_url_present',
];

const externalStatusNextCommandNeedles = [
  'release:external-evidence:validate -- --physical-platform=ios',
  'release:external-evidence:run -- --physical-platform=ios',
  'physical-device:smoke -- --platform=ios',
  'release:external-evidence:validate -- --physical-platform=android',
  'release:external-evidence:run -- --physical-platform=android',
  'physical-device:smoke -- --platform=android',
  'push-delivery:smoke -- --run',
  'native-crash:runtime:smoke -- --run',
  'telemetry:runtime:smoke -- --run',
  'ops:release-db:evidence',
  'release:completion:audit:strict',
];

function findEvidenceByPrefix(prefix, extensions = ['.json']) {
  if (!fs.existsSync(evidenceRoot)) return null;
  const matches = fs
    .readdirSync(evidenceRoot)
    .filter((entry) => entry.startsWith(prefix) && extensions.some((extension) => entry.endsWith(extension)))
    .sort()
    .reverse();
  return matches[0] ?? null;
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    issues.push(`missing file: ${path.relative(repoRoot, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    issues.push(`missing file: ${path.relative(repoRoot, filePath)}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    issues.push(`invalid JSON ${path.relative(repoRoot, filePath)}: ${error.message}`);
    return null;
  }
}

function requireValue(condition, message) {
  if (!condition) issues.push(message);
}

function evidencePathLabel(filePath) {
  return path.relative(repoRoot, filePath);
}

function warnStaleEvidence(label, filePath, reason) {
  warnings.push(`${label} evidence ignored as stale for current App identity: ${evidencePathLabel(filePath)} (${reason}).`);
}

function includes(text, needle, label) {
  requireValue(text.includes(needle), `${label} must reference ${needle}`);
}

function requireObject(value, message) {
  requireValue(Boolean(value) && typeof value === 'object' && !Array.isArray(value), message);
}

function requireBoolean(value, message) {
  requireValue(typeof value === 'boolean', message);
}

function requireNonEmptyString(value, message) {
  requireValue(typeof value === 'string' && value.trim().length > 0, message);
}

function parseTimestamp(value, message) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(message);
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    issues.push(message);
    return null;
  }
  return timestamp;
}

function requireTimestampWithin(leftTimestamp, rightTimestamp, maxDeltaMs, message) {
  if (leftTimestamp === null || rightTimestamp === null) return;
  requireValue(Math.abs(leftTimestamp - rightTimestamp) <= maxDeltaMs, message);
}

function requireIntegerAtLeast(value, min, message) {
  requireValue(Number.isInteger(value) && value >= min, message);
}

function requireAppIdentity(identity, label) {
  requireObject(identity, `${label} app identity must be an object.`);
  if (!identity) return;
  requireValue(
    identity.ios_bundle_identifier === app.ios?.bundleIdentifier,
    `${label} iOS bundle identifier must match ${app.ios?.bundleIdentifier}.`
  );
  requireValue(
    identity.android_package === app.android?.package,
    `${label} Android package must match ${app.android?.package}.`
  );
  requireValue(identity.version === app.version, `${label} version must match ${app.version}.`);
  requireValue(
    identity.ios_build_number === app.ios?.buildNumber,
    `${label} iOS build number must match ${app.ios?.buildNumber}.`
  );
  requireValue(
    identity.android_version_code === app.android?.versionCode,
    `${label} Android version code must match ${app.android?.versionCode}.`
  );
  requireBoolean(identity.eas_project_id_present, `${label} eas_project_id_present must be boolean.`);
  requireBoolean(identity.eas_project_id_valid, `${label} eas_project_id_valid must be boolean.`);
  requireNonEmptyString(identity.eas_project_id_format, `${label} eas_project_id_format must be non-empty.`);
}

function requireKnownIds(ids, knownIds, label) {
  const known = new Set(knownIds);
  const seen = new Set();
  for (const id of ids) {
    requireValue(known.has(id), `${label} contains unknown blocker id ${id}.`);
    requireValue(!seen.has(id), `${label} contains duplicate blocker id ${id}.`);
    seen.add(id);
  }
}

function requireSameIdSet(leftIds, rightIds, label) {
  const left = [...leftIds].sort();
  const right = [...rightIds].sort();
  requireValue(
    left.length === right.length && left.every((id, index) => id === right[index]),
    `${label} must match (${left.join(', ')}) !== (${right.join(', ')}).`
  );
}

function requireCommandIncludes(commands, needle, label) {
  requireValue(
    Array.isArray(commands) && commands.some((command) => typeof command === 'string' && command.includes(needle)),
    `${label} must include command containing ${needle}`
  );
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

  if (result.error) {
    issues.push(`release completion audit JSON failed to run: ${result.error.message}`);
    return null;
  }
  if (result.status !== 0) {
    issues.push(
      `release completion audit JSON must exit 0, got ${result.status}: ${
        result.stderr.trim() || result.stdout.trim().slice(0, 300)
      }`
    );
    return null;
  }
  if (result.stderr.trim()) {
    issues.push(`release completion audit JSON must not write stderr: ${result.stderr.trim()}`);
  }
  if (!result.stdout.trim()) {
    issues.push('release completion audit JSON produced empty stdout.');
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    issues.push(`release completion audit JSON did not parse: ${error.message}`);
    return null;
  }
}

const evidence = evidencePath ? readJson(evidencePath) : null;
const iosReleaseEvidence = iosReleaseSimulatorEvidencePath ? readJson(iosReleaseSimulatorEvidencePath) : null;
const externalStatusEvidence = externalStatusEvidencePath ? readJson(externalStatusEvidencePath) : null;
const externalHandoffEvidence = externalHandoffEvidencePath ? readJson(externalHandoffEvidencePath) : null;
const releaseCompletionAudit = runReleaseCompletionAuditJson();
const evidenceReadme = readText(evidenceReadmePath);
const releaseDoc = readText(releaseDocPath);
const goalAudit = readText(goalAuditPath);
const roadmap = readText(roadmapPath);
const pendingLedger = readText(pendingLedgerPath);

if (!evidencePath) {
  issues.push('missing native Maestro evidence file: App-Native-Maestro-*.json');
}

if (evidence) {
  if (evidence.app_id !== app.ios?.bundleIdentifier) {
    warnStaleEvidence(
      'Native Maestro',
      evidencePath,
      `app_id=${evidence.app_id ?? 'missing'}, expected=${app.ios?.bundleIdentifier}`
    );
  } else {
    requireValue(evidence.type === 'app-native-maestro-execution', 'evidence type must be app-native-maestro-execution.');
    requireValue(evidence.summary?.requested_flows === requiredFlows.length, `evidence requested_flows must be ${requiredFlows.length}.`);
    requireValue(evidence.summary?.passed_flows === requiredFlows.length, `evidence passed_flows must be ${requiredFlows.length}.`);
    requireValue(evidence.summary?.failed_flows === 0, 'evidence failed_flows must be 0.');
    requireValue(evidence.summary?.blocked === false, 'evidence blocked must be false.');
    requireValue(evidence.static_gate?.status === 'passed' && evidence.static_gate?.exit_code === 0, 'evidence static_gate must pass.');
    requireValue(evidence.native_readiness?.status === 'passed' && evidence.native_readiness?.exit_code === 0, 'evidence native_readiness must pass.');
    requireValue(Array.isArray(evidence.flows), 'evidence flows must be an array.');

    const flowByName = new Map((evidence.flows ?? []).map((flow) => [flow.flow, flow]));
    for (const flowName of requiredFlows) {
      const flow = flowByName.get(flowName);
      requireValue(Boolean(flow), `evidence missing flow ${flowName}.`);
      if (!flow) continue;
      requireValue(flow.status === 'passed', `flow ${flowName} must be passed.`);
      requireValue(flow.exit_code === 0, `flow ${flowName} exit_code must be 0.`);
      requireValue(Number.isInteger(flow.duration_ms) && flow.duration_ms > 0, `flow ${flowName} duration_ms must be positive.`);
      requireValue(
        typeof flow.stdout_tail === 'string' && flow.stdout_tail.includes('Flow '),
        `flow ${flowName} stdout_tail must include the Maestro flow heading.`
      );
    }
  }
}

if (!iosReleaseSimulatorEvidencePath) {
  issues.push('missing iOS Release simulator evidence file: App-iOS-Release-Simulator-*.json');
}

if (iosReleaseEvidence) {
  if (iosReleaseEvidence.app?.bundle_identifier !== app.ios?.bundleIdentifier) {
    warnStaleEvidence(
      'iOS Release simulator',
      iosReleaseSimulatorEvidencePath,
      `bundle_identifier=${iosReleaseEvidence.app?.bundle_identifier ?? 'missing'}, expected=${app.ios?.bundleIdentifier}`
    );
  } else {
    const checks = new Map((iosReleaseEvidence.checks ?? []).map((check) => [check.name, check.status]));
    for (const checkName of [
      'cocoapods_install',
      'metro_bundle',
      'xcode_release_build',
      'sentry_xcode_bundle_phase',
      'sentry_debug_symbols_phase',
      'simulator_install',
      'simulator_launch',
    ]) {
      requireValue(checks.get(checkName) === 'passed', `iOS Release simulator evidence ${checkName} must be passed.`);
    }
    requireValue(
      iosReleaseEvidence.schema === 'cj.app.ios_release_simulator_evidence.v1',
      'iOS Release simulator evidence schema must be cj.app.ios_release_simulator_evidence.v1.'
    );
    requireValue(iosReleaseEvidence.status === 'passed', 'iOS Release simulator evidence status must be passed.');
    requireValue(iosReleaseEvidence.platform?.os === 'ios', 'iOS Release simulator evidence platform.os must be ios.');
    requireValue(iosReleaseEvidence.app?.version === app.version, `iOS Release simulator evidence version must match ${app.version}.`);
    requireValue(
      iosReleaseEvidence.app?.build_number === app.ios?.buildNumber,
      `iOS Release simulator evidence build number must match ${app.ios?.buildNumber}.`
    );
    requireValue(iosReleaseEvidence.app?.configuration === 'Release', 'iOS Release simulator evidence configuration must be Release.');
    requireValue(
      iosReleaseEvidence.dependency_alignment?.expo_install_check === 'passed',
      'iOS Release simulator evidence must prove Expo dependency alignment passed.'
    );
    for (const externalEvidenceKind of [
      'EAS iOS production store build evidence',
      'TestFlight App Store Connect evidence',
      'physical device smoke evidence',
      'APNs or Expo provider delivery evidence',
      'native crash runtime evidence',
      'release or production DB parity evidence',
    ]) {
      requireValue(
        (iosReleaseEvidence.does_not_replace ?? []).includes(externalEvidenceKind),
        `iOS Release simulator evidence must explicitly not replace ${externalEvidenceKind}.`
      );
    }
  }
}

if (!externalStatusEvidencePath) {
  issues.push('missing external status evidence file: App-External-Evidence-Status-*.json');
}

let externalStatusBlockerIds = [];
let externalStatusGeneratedAt = null;
if (externalStatusEvidence) {
  requireValue(
    externalStatusEvidence.type === 'app-external-evidence-status',
    'external status evidence type must be app-external-evidence-status.'
  );
  externalStatusGeneratedAt = parseTimestamp(
    externalStatusEvidence.generated_at,
    'external status evidence generated_at must be an ISO-like timestamp.'
  );
  requireAppIdentity(externalStatusEvidence.app, 'external status evidence');

  requireObject(externalStatusEvidence.credentials, 'external status evidence credentials must be an object.');
  for (const field of externalCredentialFields) {
    requireBoolean(
      externalStatusEvidence.credentials?.[field],
      `external status evidence credentials.${field} must be boolean.`
    );
  }

  requireObject(externalStatusEvidence.env_files, 'external status evidence env_files must be an object.');
  requireValue(
    externalStatusEvidence.env_files?.values_redacted === true,
    'external status evidence env_files.values_redacted must be true.'
  );
  requireValue(
    Array.isArray(externalStatusEvidence.env_files?.loaded),
    'external status evidence env_files.loaded must be an array.'
  );
  for (const [index, entry] of (externalStatusEvidence.env_files?.loaded ?? []).entries()) {
    requireObject(entry, `external status evidence env_files.loaded[${index}] must be an object.`);
    requireNonEmptyString(entry?.file, `external status evidence env_files.loaded[${index}].file must be non-empty.`);
    requireIntegerAtLeast(
      entry?.loaded_keys,
      0,
      `external status evidence env_files.loaded[${index}].loaded_keys must be a non-negative integer.`
    );
    requireIntegerAtLeast(
      entry?.kept_existing_keys,
      0,
      `external status evidence env_files.loaded[${index}].kept_existing_keys must be a non-negative integer.`
    );
  }

  requireObject(externalStatusEvidence.tools, 'external status evidence tools must be an object.');
  requireBoolean(externalStatusEvidence.tools?.eas_cli_available, 'external status evidence tools.eas_cli_available must be boolean.');
  requireBoolean(
    externalStatusEvidence.tools?.eas_cli_authenticated,
    'external status evidence tools.eas_cli_authenticated must be boolean.'
  );

  requireObject(externalStatusEvidence.devices?.ios, 'external status evidence devices.ios must be an object.');
  requireObject(externalStatusEvidence.devices?.android, 'external status evidence devices.android must be an object.');
  requireBoolean(externalStatusEvidence.devices?.ios?.ok, 'external status evidence devices.ios.ok must be boolean.');
  requireBoolean(externalStatusEvidence.devices?.android?.ok, 'external status evidence devices.android.ok must be boolean.');
  for (const [platform, fields] of [
    ['ios', ['physical_connected', 'physical_offline', 'simulators']],
    ['android', ['physical_connected', 'emulator_connected', 'unauthorized_or_offline']],
  ]) {
    for (const field of fields) {
      requireIntegerAtLeast(
        externalStatusEvidence.devices?.[platform]?.[field],
        0,
        `external status evidence devices.${platform}.${field} must be a non-negative integer.`
      );
    }
  }

  requireObject(externalStatusEvidence.evidence, 'external status evidence evidence must be an object.');
  for (const key of externalEvidenceKeys) {
    const candidate = externalStatusEvidence.evidence?.[key];
    requireObject(candidate, `external status evidence evidence.${key} must be an object.`);
    requireNonEmptyString(candidate?.state, `external status evidence evidence.${key}.state must be non-empty.`);
    requireValue(
      Array.isArray(candidate?.validation_errors),
      `external status evidence evidence.${key}.validation_errors must be an array.`
    );
  }

  requireValue(Array.isArray(externalStatusEvidence.next_commands), 'external status evidence next_commands must be an array.');
  for (const needle of externalStatusNextCommandNeedles) {
    requireCommandIncludes(externalStatusEvidence.next_commands, needle, 'external status evidence next_commands');
  }

  requireValue(Array.isArray(externalStatusEvidence.blockers), 'external status evidence blockers must be an array.');
  externalStatusBlockerIds = (externalStatusEvidence.blockers ?? []).map((blocker) => blocker?.id);
  for (const blocker of externalStatusEvidence.blockers ?? []) {
    requireNonEmptyString(blocker?.id, 'external status evidence blocker.id must be non-empty.');
    requireNonEmptyString(blocker?.message, `external status evidence blocker ${blocker?.id ?? '<unknown>'} message must be non-empty.`);
  }
  requireKnownIds(externalStatusBlockerIds, externalBlockerIds, 'external status evidence blockers');
}

if (!externalHandoffEvidencePath) {
  issues.push('missing external handoff evidence file: App-External-Evidence-Handoff-*.json');
}

if (externalHandoffEvidence) {
  const externalHandoffGeneratedAt = parseTimestamp(
    externalHandoffEvidence.generated_at,
    'external handoff evidence generated_at must be an ISO-like timestamp.'
  );
  requireValue(
    externalHandoffEvidence.type === 'app-external-evidence-handoff',
    'external handoff evidence type must be app-external-evidence-handoff.'
  );
  requireValue(
    externalHandoffEvidence.source_status_type === 'app-external-evidence-status',
    'external handoff evidence source_status_type must be app-external-evidence-status.'
  );
  const externalHandoffSourceStatusGeneratedAt = parseTimestamp(
    externalHandoffEvidence.source_status_generated_at,
    'external handoff evidence source_status_generated_at must be an ISO-like timestamp.'
  );
  requireValue(
    externalHandoffEvidence.source_release_completion_audit_type === 'app-release-completion-audit',
    'external handoff evidence source_release_completion_audit_type must be app-release-completion-audit.'
  );
  const externalHandoffSourceReleaseAuditGeneratedAt = parseTimestamp(
    externalHandoffEvidence.source_release_completion_audit_generated_at,
    'external handoff evidence source_release_completion_audit_generated_at must be an ISO-like timestamp.'
  );
  requireTimestampWithin(
    externalHandoffSourceStatusGeneratedAt,
    externalHandoffGeneratedAt,
    relatedExternalEvidenceWindowMs,
    'external handoff source_status_generated_at must be close to handoff generated_at.'
  );
  requireTimestampWithin(
    externalHandoffSourceReleaseAuditGeneratedAt,
    externalHandoffGeneratedAt,
    relatedExternalEvidenceWindowMs,
    'external handoff source_release_completion_audit_generated_at must be close to handoff generated_at.'
  );
  requireTimestampWithin(
    externalStatusGeneratedAt,
    externalHandoffSourceStatusGeneratedAt,
    relatedExternalEvidenceWindowMs,
    'external persisted status generated_at must be close to handoff source_status_generated_at.'
  );
  if (externalHandoffGeneratedAt !== null && externalHandoffSourceStatusGeneratedAt !== null) {
    requireValue(
      externalHandoffSourceStatusGeneratedAt <= externalHandoffGeneratedAt,
      'external handoff source_status_generated_at must not be after handoff generated_at.'
    );
  }
  if (externalHandoffGeneratedAt !== null && externalHandoffSourceReleaseAuditGeneratedAt !== null) {
    requireValue(
      externalHandoffSourceReleaseAuditGeneratedAt <= externalHandoffGeneratedAt,
      'external handoff source_release_completion_audit_generated_at must not be after handoff generated_at.'
    );
  }
  if (externalHandoffGeneratedAt !== null && externalStatusGeneratedAt !== null) {
    requireValue(
      externalStatusGeneratedAt <= externalHandoffGeneratedAt,
      'external persisted status generated_at must not be after handoff generated_at.'
    );
  }
  if (externalStatusGeneratedAt !== null && externalHandoffSourceStatusGeneratedAt !== null) {
    requireValue(
      externalStatusGeneratedAt <= externalHandoffSourceStatusGeneratedAt,
      'external persisted status generated_at must not be after handoff source_status_generated_at.'
    );
  }
  requireAppIdentity(externalHandoffEvidence.app, 'external handoff evidence');

  requireObject(externalHandoffEvidence.summary, 'external handoff evidence summary must be an object.');
  requireBoolean(externalHandoffEvidence.summary?.blocked, 'external handoff evidence summary.blocked must be boolean.');
  requireBoolean(
    externalHandoffEvidence.summary?.report_contains_secrets,
    'external handoff evidence summary.report_contains_secrets must be boolean.'
  );
  requireValue(
    externalHandoffEvidence.summary?.report_contains_secrets === false,
    'external handoff evidence summary.report_contains_secrets must be false.'
  );
  requireIntegerAtLeast(
    externalHandoffEvidence.summary?.blocker_count,
    0,
    'external handoff evidence summary.blocker_count must be a non-negative integer.'
  );
  requireIntegerAtLeast(
    externalHandoffEvidence.summary?.release_completion_handoff_blocker_count,
    0,
    'external handoff evidence summary.release_completion_handoff_blocker_count must be a non-negative integer.'
  );
  requireIntegerAtLeast(
    externalHandoffEvidence.summary?.prerequisite_only_blocker_count,
    0,
    'external handoff evidence summary.prerequisite_only_blocker_count must be a non-negative integer.'
  );
  requireValue(
    externalHandoffEvidence.summary?.known_blocker_count === externalBlockerIds.length,
    `external handoff evidence summary.known_blocker_count must be ${externalBlockerIds.length}.`
  );
  requireValue(Array.isArray(externalHandoffEvidence.items), 'external handoff evidence items must be an array.');

  const handoffBlockerIds = (externalHandoffEvidence.items ?? []).map((item) => item?.blocker_id);
  requireKnownIds(handoffBlockerIds, externalBlockerIds, 'external handoff evidence items');
  requireValue(
    externalHandoffEvidence.summary?.blocker_count === handoffBlockerIds.length,
    'external handoff evidence summary.blocker_count must match items length.'
  );
  const releaseCompletionHandoffItems = (externalHandoffEvidence.items ?? []).filter(
    (item) => item?.release_completion_blocker === true
  );
  const prerequisiteOnlyItems = (externalHandoffEvidence.items ?? []).filter(
    (item) => item?.prerequisite_only === true
  );
  requireValue(
    externalHandoffEvidence.summary?.release_completion_handoff_blocker_count === releaseCompletionHandoffItems.length,
    'external handoff evidence summary.release_completion_handoff_blocker_count must match item flags.'
  );
  requireValue(
    externalHandoffEvidence.summary?.prerequisite_only_blocker_count === prerequisiteOnlyItems.length,
    'external handoff evidence summary.prerequisite_only_blocker_count must match item flags.'
  );
  requireValue(
    releaseCompletionHandoffItems.length + prerequisiteOnlyItems.length === handoffBlockerIds.length,
    'external handoff evidence release completion and prerequisite item counts must add up to items length.'
  );
  if (releaseCompletionAudit) {
    requireValue(
      releaseCompletionAudit.type === 'app-release-completion-audit',
      'current release completion audit type must be app-release-completion-audit.'
    );
    requireValue(
      Array.isArray(releaseCompletionAudit.handoff_blocker_ids),
      'current release completion audit handoff_blocker_ids must be an array.'
    );
    requireKnownIds(
      releaseCompletionAudit.handoff_blocker_ids ?? [],
      externalBlockerIds,
      'current release completion audit handoff_blocker_ids'
    );
    for (const blockerId of releaseCompletionAudit.handoff_blocker_ids ?? []) {
      requireValue(
        handoffBlockerIds.includes(blockerId),
        `external handoff evidence must cover current release completion audit handoff_blocker_id ${blockerId}.`
      );
      requireValue(
        releaseCompletionHandoffItems.some((item) => item?.blocker_id === blockerId),
        `external handoff evidence must mark current release completion audit handoff_blocker_id ${blockerId} as release_completion_blocker.`
      );
    }
    if (releaseCompletionAudit.complete === false) {
      requireValue(
        externalHandoffEvidence.summary?.blocked === true,
        'external handoff evidence summary.blocked must be true while current release completion audit is incomplete.'
      );
    }
  }
  if (externalStatusEvidence) {
    requireSameIdSet(
      externalStatusBlockerIds,
      handoffBlockerIds,
      'external status blockers and handoff items'
    );
  }

  for (const item of externalHandoffEvidence.items ?? []) {
    const label = `external handoff evidence item ${item?.blocker_id ?? '<unknown>'}`;
    requireNonEmptyString(item?.blocker_id, `${label} blocker_id must be non-empty.`);
    requireBoolean(item?.release_completion_blocker, `${label} release_completion_blocker must be boolean.`);
    requireBoolean(item?.prerequisite_only, `${label} prerequisite_only must be boolean.`);
    requireValue(
      item?.release_completion_blocker !== item?.prerequisite_only,
      `${label} must be either release completion blocker or prerequisite-only blocker.`
    );
    requireNonEmptyString(item?.owner_surface, `${label} owner_surface must be non-empty.`);
    requireNonEmptyString(item?.action, `${label} action must be non-empty.`);
    requireValue(Array.isArray(item?.commands) && item.commands.length > 0, `${label} commands must be non-empty.`);
    requireValue(
      Array.isArray(item?.accepted_evidence) && item.accepted_evidence.length > 0,
      `${label} accepted_evidence must be non-empty.`
    );
    requireNonEmptyString(item?.strict_gate, `${label} strict_gate must be non-empty.`);
    requireValue(Array.isArray(item?.docs) && item.docs.length > 0, `${label} docs must be non-empty.`);
  }

  const physicalDeviceItem = (externalHandoffEvidence.items ?? []).find(
    (item) => item?.blocker_id === 'physical_device_evidence'
  );
  if (physicalDeviceItem) {
    requireCommandIncludes(
      physicalDeviceItem.commands,
      'release:external-evidence:validate -- --physical-platform=ios',
      'external handoff physical_device_evidence commands'
    );
    requireCommandIncludes(
      physicalDeviceItem.commands,
      'release:external-evidence:run -- --physical-platform=ios',
      'external handoff physical_device_evidence commands'
    );
    requireCommandIncludes(
      physicalDeviceItem.commands,
      'release:external-evidence:validate -- --physical-platform=android',
      'external handoff physical_device_evidence commands'
    );
    requireCommandIncludes(
      physicalDeviceItem.commands,
      'release:external-evidence:run -- --physical-platform=android',
      'external handoff physical_device_evidence commands'
    );
  }

  requireCommandIncludes(
    externalHandoffEvidence.final_gates,
    'release:completion:audit:strict',
    'external handoff evidence final_gates'
  );
  requireCommandIncludes(
    externalHandoffEvidence.final_gates,
    'goal:completion:audit:strict',
    'external handoff evidence final_gates'
  );
}

if (expectedEvidenceFile) {
  includes(releaseDoc, expectedEvidenceFile, 'release evidence doc');
}
includes(releaseDoc, '7/7 flows', 'release evidence doc');
includes(releaseDoc, 'Android SDK', 'release evidence doc');
if (expectedEvidenceFile) {
  includes(roadmap, expectedEvidenceFile, 'App Roadmap');
}
includes(roadmap, 'Android config readiness gate', 'App Roadmap');
if (iosReleaseSimulatorEvidenceFile) {
  includes(releaseDoc, iosReleaseSimulatorEvidenceFile, 'release evidence doc');
  includes(roadmap, iosReleaseSimulatorEvidenceFile, 'App Roadmap');
}
if (externalStatusEvidenceFile) {
  includes(evidenceReadme, externalStatusEvidenceFile, 'evidence README');
  includes(releaseDoc, externalStatusEvidenceFile, 'release evidence doc');
  includes(goalAudit, externalStatusEvidenceFile, 'goal completion audit doc');
  includes(pendingLedger, externalStatusEvidenceFile, 'App pending ledger');
}
if (externalHandoffEvidenceFile) {
  includes(evidenceReadme, externalHandoffEvidenceFile, 'evidence README');
  includes(releaseDoc, externalHandoffEvidenceFile, 'release evidence doc');
  includes(goalAudit, externalHandoffEvidenceFile, 'goal completion audit doc');
  includes(pendingLedger, externalHandoffEvidenceFile, 'App pending ledger');
  includes(roadmap, 'App-External-Evidence-Handoff-*.json', 'App Roadmap');
}

if (issues.length > 0) {
  console.error(`[release-evidence-check] failed with ${issues.length} issue(s):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('[release-evidence-check] warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

console.log(
  `[release-evidence-check] ok: ${expectedEvidenceFile} and ${iosReleaseSimulatorEvidenceFile} are schema-checked when identity-current and stale-ignored when pre-Emorapy; ${externalStatusEvidenceFile} and ${externalHandoffEvidenceFile} prove current external blocker handoff is schema-valid, env-file-provenance-valid, release-audit-covered, timestamp-coherent, and docs-referenced`
);
