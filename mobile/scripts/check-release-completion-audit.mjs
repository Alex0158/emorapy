import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getExpoProjectIdStatus } from './lib/release-app-config.mjs';
import {
  buildReleaseEvidencePolicies,
  getReleaseBlockingMigrationCount,
  validateTelemetryBackendVersionFreshness,
  validateEvidenceAgainstPolicy,
} from './lib/release-evidence-policy.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const strict = process.argv.includes('--strict');
const json = process.argv.includes('--json');
const fixtureContract = process.argv.includes('--fixture-contract');
const releaseBlockingMigrationCount = getReleaseBlockingMigrationCount();

const evidenceRoot = path.join(
  repoRoot,
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證'
);
const docPaths = [
  'docs/核心開發文件/20-App端/03-App完整版本開發Roadmap.md',
  'docs/核心開發文件/08-測試規範與驗收/03-App測試與證據接入基線.md',
  'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md',
  'docs/核心開發文件/07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md',
].map((relativePath) => path.join(repoRoot, relativePath));

const failures = [];
const blockers = [];
const verified = [];
const warnings = [];
const completionChecks = [];
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    failures.push(`missing documented audit source: ${path.relative(repoRoot, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireValue(condition, message) {
  if (!condition) failures.push(message);
}

function evidencePathLabel(filePath) {
  return path.relative(repoRoot, filePath);
}

function ignoreStaleEvidence(label, filePath, reason) {
  warnings.push(`${label} evidence ignored as stale for current App identity: ${evidencePathLabel(filePath)} (${reason}).`);
  return false;
}

function requireExternalEvidencePolicy(evidence, appConfig, policyKey, label) {
  const policy = buildReleaseEvidencePolicies(appConfig ?? {})[policyKey];
  const errors = validateEvidenceAgainstPolicy(evidence, policy);
  for (const error of errors) {
    failures.push(`${label}: ${error}.`);
  }
  return errors.length === 0;
}

function getCurrentGitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const commitSha = result.stdout?.trim() ?? '';
  if (result.status !== 0 || !/^[0-9a-f]{40}$/i.test(commitSha)) return null;
  return commitSha.toLowerCase();
}

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

function hasAppleSubmissionCredentials() {
  return hasEnv('ASC_APPLE_ID') && hasEnv('EXPO_APPLE_APP_SPECIFIC_PASSWORD');
}

function hasAppStoreConnectApiCredentials() {
  return (
    (hasEnv('APP_STORE_CONNECT_ISSUER_ID') || hasEnv('ASC_ISSUER_ID')) &&
    (hasEnv('APP_STORE_CONNECT_KEY_ID') || hasEnv('ASC_KEY_ID')) &&
    (hasEnv('APP_STORE_CONNECT_PRIVATE_KEY') ||
      hasEnv('ASC_PRIVATE_KEY') ||
      hasEnv('APP_STORE_CONNECT_PRIVATE_KEY_PATH') ||
      hasEnv('ASC_PRIVATE_KEY_PATH'))
  );
}

function existingPathFromEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) return null;
  const filePath = path.resolve(repoRoot, value);
  return fs.existsSync(filePath) ? filePath : null;
}

function findEvidenceByPrefix(prefix, extensions = ['.json', '.md']) {
  if (!fs.existsSync(evidenceRoot)) return null;
  const matches = fs
    .readdirSync(evidenceRoot)
    .filter((entry) => entry.startsWith(prefix) && extensions.some((extension) => entry.endsWith(extension)))
    .sort()
    .reverse();
  const match = matches[0];
  return match ? path.join(evidenceRoot, match) : null;
}

function hasPlugin(plugins, pluginName) {
  return (plugins ?? []).some((entry) => {
    if (typeof entry === 'string') return entry === pluginName;
    return Array.isArray(entry) && entry[0] === pluginName;
  });
}

function mobileFileIncludes(relativePath, needles) {
  const filePath = path.join(mobileRoot, relativePath);
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, 'utf8');
  return needles.every((needle) => text.includes(needle));
}

function repoFileIncludes(relativePath, needles) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, 'utf8');
  return needles.every((needle) => text.includes(needle));
}

function validateEasIosReleaseEvidence(filePath, app) {
  if (!filePath) return false;
  if (!filePath.endsWith('.json')) {
    failures.push('EAS iOS release evidence must be structured JSON generated by mobile/scripts/run-eas-ios-release-smoke.mjs.');
    return false;
  }

  const evidence = readJson(filePath);
  const policyPassed = requireExternalEvidencePolicy(evidence, app, 'eas_ios_release', 'EAS iOS release evidence');
  requireValue(
    evidence.type === 'app-eas-ios-release-evidence',
    'EAS iOS release evidence type must be app-eas-ios-release-evidence.'
  );
  requireValue(
    evidence.app_ios_bundle_identifier === app.ios?.bundleIdentifier,
    `EAS iOS release evidence bundle identifier must match ${app.ios?.bundleIdentifier}.`
  );
  requireValue(evidence.app_version === app.version, `EAS iOS release evidence app version must match ${app.version}.`);
  requireValue(
    evidence.app_build_number === app.ios?.buildNumber,
    `EAS iOS release evidence build number must match ${app.ios?.buildNumber}.`
  );
  requireValue(evidence.summary?.run_mode === 'run', 'EAS iOS release evidence must be generated in run mode.');
  requireValue(evidence.summary?.eas_query_passed === true, 'EAS iOS release evidence must pass EAS query.');
  requireValue(evidence.summary?.build_found === true, 'EAS iOS release evidence must find a build.');
  requireValue(evidence.summary?.platform_ios === true, 'EAS iOS release evidence must prove platform ios.');
  requireValue(evidence.summary?.status_finished === true, 'EAS iOS release evidence must prove finished status.');
  requireValue(evidence.summary?.distribution_store === true, 'EAS iOS release evidence must prove store distribution.');
  requireValue(evidence.summary?.profile_production === true, 'EAS iOS release evidence must prove production build profile.');
  requireValue(evidence.summary?.app_identifier_matches === true, 'EAS iOS release evidence must match bundle identifier.');
  requireValue(evidence.summary?.app_version_matches === true, 'EAS iOS release evidence must match app version.');
  requireValue(evidence.summary?.build_number_matches === true, 'EAS iOS release evidence must match build number.');
  requireValue(evidence.summary?.artifact_url_present === true, 'EAS iOS release evidence must include an artifact URL summary.');
  requireValue(evidence.summary?.artifact_head_passed === true, 'EAS iOS release evidence must pass artifact HEAD/range check.');
  requireValue(Boolean(evidence.eas_build?.id_sha256), 'EAS iOS release evidence must include only a hashed EAS build id.');
  requireValue(Boolean(evidence.eas_build?.artifact?.url_sha256), 'EAS iOS release evidence must include only a hashed artifact URL.');
  requireValue(evidence.summary?.blocked === false, 'EAS iOS release evidence must have blocked=false.');

  return evidence.type === 'app-eas-ios-release-evidence' &&
    evidence.app_ios_bundle_identifier === app.ios?.bundleIdentifier &&
    evidence.app_version === app.version &&
    evidence.app_build_number === app.ios?.buildNumber &&
    evidence.summary?.run_mode === 'run' &&
    evidence.summary?.eas_query_passed === true &&
    evidence.summary?.build_found === true &&
    evidence.summary?.platform_ios === true &&
    evidence.summary?.status_finished === true &&
    evidence.summary?.distribution_store === true &&
    evidence.summary?.profile_production === true &&
    evidence.summary?.app_identifier_matches === true &&
    evidence.summary?.app_version_matches === true &&
    evidence.summary?.build_number_matches === true &&
    evidence.summary?.artifact_url_present === true &&
    evidence.summary?.artifact_head_passed === true &&
    Boolean(evidence.eas_build?.id_sha256) &&
    Boolean(evidence.eas_build?.artifact?.url_sha256) &&
    evidence.summary?.blocked === false &&
    policyPassed;
}

function validateTestFlightEvidence(filePath, app) {
  if (!filePath) return false;
  if (!filePath.endsWith('.json')) {
    failures.push('TestFlight evidence must be structured JSON generated by mobile/scripts/run-eas-ios-release-smoke.mjs.');
    return false;
  }

  const evidence = readJson(filePath);
  const policyPassed = requireExternalEvidencePolicy(evidence, app, 'testflight', 'TestFlight evidence');
  requireValue(
    evidence.type === 'app-eas-ios-release-evidence',
    'TestFlight evidence type must be app-eas-ios-release-evidence.'
  );
  requireValue(
    evidence.app_ios_bundle_identifier === app.ios?.bundleIdentifier,
    `TestFlight evidence bundle identifier must match ${app.ios?.bundleIdentifier}.`
  );
  requireValue(evidence.app_version === app.version, `TestFlight evidence app version must match ${app.version}.`);
  requireValue(
    evidence.app_build_number === app.ios?.buildNumber,
    `TestFlight evidence build number must match ${app.ios?.buildNumber}.`
  );
  requireValue(evidence.summary?.run_mode === 'run', 'TestFlight evidence must be generated in run mode.');
  requireValue(evidence.summary?.testflight_query_required === true, 'TestFlight evidence must require TestFlight query.');
  requireValue(evidence.summary?.testflight_query_passed === true, 'TestFlight evidence must pass App Store Connect query.');
  requireValue(evidence.summary?.testflight_build_found === true, 'TestFlight evidence must find a TestFlight build.');
  requireValue(evidence.summary?.testflight_version_matches === true, 'TestFlight evidence must match app version.');
  requireValue(evidence.summary?.testflight_build_number_matches === true, 'TestFlight evidence must match build number.');
  requireValue(evidence.summary?.testflight_processing_valid === true, 'TestFlight evidence must prove VALID processing state.');
  requireValue(evidence.summary?.testflight_not_expired === true, 'TestFlight evidence must prove build is not expired.');
  requireValue(Boolean(evidence.testflight?.build_id_sha256), 'TestFlight evidence must include only a hashed App Store Connect build id.');
  requireValue(evidence.summary?.blocked === false, 'TestFlight evidence must have blocked=false.');

  return evidence.type === 'app-eas-ios-release-evidence' &&
    evidence.app_ios_bundle_identifier === app.ios?.bundleIdentifier &&
    evidence.app_version === app.version &&
    evidence.app_build_number === app.ios?.buildNumber &&
    evidence.summary?.run_mode === 'run' &&
    evidence.summary?.testflight_query_required === true &&
    evidence.summary?.testflight_query_passed === true &&
    evidence.summary?.testflight_build_found === true &&
    evidence.summary?.testflight_version_matches === true &&
    evidence.summary?.testflight_build_number_matches === true &&
    evidence.summary?.testflight_processing_valid === true &&
    evidence.summary?.testflight_not_expired === true &&
    Boolean(evidence.testflight?.build_id_sha256) &&
    evidence.summary?.blocked === false &&
    policyPassed;
}

function validateEasAndroidReleaseEvidence(filePath, app) {
  if (!filePath) return false;
  if (!filePath.endsWith('.json')) {
    failures.push('EAS Android release evidence must be structured JSON generated by mobile/scripts/run-eas-android-release-smoke.mjs.');
    return false;
  }

  const evidence = readJson(filePath);
  if (evidence.app_android_package !== app.android?.package) {
    return ignoreStaleEvidence(
      'EAS Android release',
      filePath,
      `app_android_package=${evidence.app_android_package ?? 'missing'}, expected=${app.android?.package}`
    );
  }
  const policyPassed = requireExternalEvidencePolicy(evidence, app, 'eas_android_release', 'EAS Android release evidence');
  requireValue(
    evidence.type === 'app-eas-android-release-evidence',
    'EAS Android release evidence type must be app-eas-android-release-evidence.'
  );
  requireValue(
    evidence.app_android_package === app.android?.package,
    `EAS Android release evidence package must match ${app.android?.package}.`
  );
  requireValue(evidence.app_version === app.version, `EAS Android release evidence app version must match ${app.version}.`);
  requireValue(evidence.summary?.run_mode === 'run', 'EAS Android release evidence must be generated in run mode.');
  requireValue(evidence.summary?.eas_query_passed === true, 'EAS Android release evidence must pass EAS query.');
  requireValue(evidence.summary?.build_found === true, 'EAS Android release evidence must find a build.');
  requireValue(evidence.summary?.platform_android === true, 'EAS Android release evidence must prove platform android.');
  requireValue(evidence.summary?.status_finished === true, 'EAS Android release evidence must prove finished status.');
  requireValue(evidence.summary?.distribution_store === true, 'EAS Android release evidence must prove store distribution.');
  requireValue(evidence.summary?.profile_production === true, 'EAS Android release evidence must prove production build profile.');
  requireValue(evidence.summary?.app_identifier_matches === true, 'EAS Android release evidence must match package.');
  requireValue(evidence.summary?.app_version_matches === true, 'EAS Android release evidence must match app version.');
  requireValue(evidence.summary?.version_code_matches === true, 'EAS Android release evidence must match versionCode.');
  requireValue(evidence.summary?.artifact_url_present === true, 'EAS Android release evidence must include an artifact URL summary.');
  requireValue(evidence.summary?.artifact_head_passed === true, 'EAS Android release evidence must pass artifact HEAD/range check.');
  requireValue(Boolean(evidence.eas_build?.id_sha256), 'EAS Android release evidence must include only a hashed EAS build id.');
  requireValue(Boolean(evidence.eas_build?.artifact?.url_sha256), 'EAS Android release evidence must include only a hashed artifact URL.');
  requireValue(evidence.summary?.blocked === false, 'EAS Android release evidence must have blocked=false.');

  return evidence.type === 'app-eas-android-release-evidence' &&
    evidence.app_android_package === app.android?.package &&
    evidence.app_version === app.version &&
    evidence.summary?.run_mode === 'run' &&
    evidence.summary?.eas_query_passed === true &&
    evidence.summary?.build_found === true &&
    evidence.summary?.platform_android === true &&
    evidence.summary?.status_finished === true &&
    evidence.summary?.distribution_store === true &&
    evidence.summary?.profile_production === true &&
    evidence.summary?.app_identifier_matches === true &&
    evidence.summary?.app_version_matches === true &&
    evidence.summary?.version_code_matches === true &&
    evidence.summary?.artifact_url_present === true &&
    evidence.summary?.artifact_head_passed === true &&
    Boolean(evidence.eas_build?.id_sha256) &&
    Boolean(evidence.eas_build?.artifact?.url_sha256) &&
    evidence.summary?.blocked === false &&
    policyPassed;
}

function validateReleaseDbEvidence(filePath) {
  if (!filePath) return false;
  if (!filePath.endsWith('.json')) {
    failures.push('release DB parity evidence must be structured JSON generated by backend/scripts/check-release-db-parity.ts.');
    return false;
  }

  const evidence = readJson(filePath);
  const policyPassed = requireExternalEvidencePolicy(evidence, {}, 'release_db_parity', 'release DB parity evidence');
  requireValue(
    evidence.type === 'app-release-db-parity-evidence',
    'release DB parity evidence type must be app-release-db-parity-evidence.'
  );
  requireValue(evidence.check === 'release-db-parity', 'release DB parity evidence check must be release-db-parity.');
  requireValue(evidence.ok === true, 'release DB parity evidence must have ok=true.');
  requireValue(evidence.report?.check === 'release-db-parity', 'release DB parity evidence must include report.check.');
  requireValue(evidence.report?.ok === true, 'release DB parity report must have ok=true.');
  requireValue(
    evidence.report?.requiredMigrationCount === releaseBlockingMigrationCount,
    `release DB parity evidence must cover the current release-blocking migration set (${releaseBlockingMigrationCount}).`
  );
  requireValue(
    evidence.report?.appliedRequiredMigrationCount === evidence.report?.requiredMigrationCount,
    'release DB parity evidence must apply every required migration.'
  );
  requireValue(
    Array.isArray(evidence.report?.missingRequiredMigrations) &&
      evidence.report.missingRequiredMigrations.length === 0,
    'release DB parity evidence must have no missing required migrations.'
  );
  requireValue(
    Array.isArray(evidence.report?.incompleteRequiredMigrations) &&
      evidence.report.incompleteRequiredMigrations.length === 0,
    'release DB parity evidence must have no incomplete required migrations.'
  );
  requireValue(
    Array.isArray(evidence.report?.failedMigrations) && evidence.report.failedMigrations.length === 0,
    'release DB parity evidence must have no failed migrations.'
  );
  requireValue(
    evidence.target?.classification === 'release' || evidence.target?.classification === 'production',
    'release DB parity evidence target must be release or production.'
  );
  requireValue(
    evidence.target?.database?.local === false,
    'release DB parity evidence must be generated against a non-local target DB.'
  );
  requireValue(
    evidence.target?.database?.provider === 'postgresql' || evidence.target?.database?.provider === 'postgres',
    'release DB parity evidence must target PostgreSQL.'
  );

  return evidence.type === 'app-release-db-parity-evidence' &&
    evidence.check === 'release-db-parity' &&
    evidence.ok === true &&
    evidence.report?.ok === true &&
    evidence.report?.appliedRequiredMigrationCount === evidence.report?.requiredMigrationCount &&
    evidence.target?.database?.local === false &&
    (evidence.target?.classification === 'release' || evidence.target?.classification === 'production') &&
    policyPassed;
}

function validateIosReleaseSimulatorEvidence(filePath, app) {
  if (!filePath) return false;
  if (!filePath.endsWith('.json')) {
    failures.push('iOS Release simulator evidence must be structured JSON.');
    return false;
  }

  const evidence = readJson(filePath);
  if (evidence.app?.bundle_identifier !== app.ios?.bundleIdentifier) {
    return ignoreStaleEvidence(
      'iOS Release simulator',
      filePath,
      `bundle_identifier=${evidence.app?.bundle_identifier ?? 'missing'}, expected=${app.ios?.bundleIdentifier}`
    );
  }
  const checks = new Map((evidence.checks ?? []).map((check) => [check.name, check.status]));
  const requiredChecks = [
    'cocoapods_install',
    'metro_bundle',
    'xcode_release_build',
    'sentry_xcode_bundle_phase',
    'sentry_debug_symbols_phase',
    'simulator_install',
    'simulator_launch',
  ];
  const doesNotReplace = evidence.does_not_replace ?? [];

  requireValue(
    evidence.schema === 'cj.app.ios_release_simulator_evidence.v1',
    'iOS Release simulator evidence schema must be cj.app.ios_release_simulator_evidence.v1.'
  );
  requireValue(evidence.status === 'passed', 'iOS Release simulator evidence status must be passed.');
  requireValue(evidence.platform?.os === 'ios', 'iOS Release simulator evidence platform.os must be ios.');
  requireValue(
    evidence.app?.bundle_identifier === app.ios?.bundleIdentifier,
    `iOS Release simulator evidence bundle identifier must match ${app.ios?.bundleIdentifier}.`
  );
  requireValue(evidence.app?.version === app.version, `iOS Release simulator evidence version must match ${app.version}.`);
  requireValue(
    evidence.app?.build_number === app.ios?.buildNumber,
    `iOS Release simulator evidence build number must match ${app.ios?.buildNumber}.`
  );
  requireValue(evidence.app?.configuration === 'Release', 'iOS Release simulator evidence configuration must be Release.');
  requireValue(
    evidence.dependency_alignment?.expo_install_check === 'passed',
    'iOS Release simulator evidence must prove Expo dependency alignment passed.'
  );
  for (const checkName of requiredChecks) {
    requireValue(checks.get(checkName) === 'passed', `iOS Release simulator evidence must pass ${checkName}.`);
  }
  for (const externalEvidenceKind of [
    'EAS iOS production store build evidence',
    'TestFlight App Store Connect evidence',
    'physical device smoke evidence',
    'APNs or Expo provider delivery evidence',
    'native crash runtime evidence',
    'release or production DB parity evidence',
  ]) {
    requireValue(
      doesNotReplace.includes(externalEvidenceKind),
      `iOS Release simulator evidence must explicitly not replace ${externalEvidenceKind}.`
    );
  }

  return evidence.schema === 'cj.app.ios_release_simulator_evidence.v1' &&
    evidence.status === 'passed' &&
    evidence.platform?.os === 'ios' &&
    evidence.app?.bundle_identifier === app.ios?.bundleIdentifier &&
    evidence.app?.version === app.version &&
    evidence.app?.build_number === app.ios?.buildNumber &&
    evidence.app?.configuration === 'Release' &&
    evidence.dependency_alignment?.expo_install_check === 'passed' &&
    requiredChecks.every((checkName) => checks.get(checkName) === 'passed') &&
    doesNotReplace.includes('EAS iOS production store build evidence') &&
    doesNotReplace.includes('TestFlight App Store Connect evidence') &&
    doesNotReplace.includes('physical device smoke evidence') &&
    doesNotReplace.includes('APNs or Expo provider delivery evidence') &&
    doesNotReplace.includes('native crash runtime evidence') &&
    doesNotReplace.includes('release or production DB parity evidence');
}

function validateSelectedMediaUploadEvidence(filePath) {
  if (!filePath) return false;
  if (!filePath.endsWith('.json')) {
    failures.push('selected-media backend upload evidence must be structured JSON.');
    return false;
  }

  const evidence = readJson(filePath);
  requireValue(
    evidence.type === 'app-selected-media-backend-upload-smoke',
    'selected-media upload evidence type must be app-selected-media-backend-upload-smoke.'
  );
  requireValue(evidence.api?.local === true, 'selected-media upload evidence must target a local API.');
  requireValue(
    evidence.database?.source === 'APP_SMOKE_BACKEND_DATABASE_URL',
    'selected-media upload evidence must use explicit APP_SMOKE_BACKEND_DATABASE_URL.'
  );
  requireValue(evidence.database?.local === true, 'selected-media upload evidence must target a local DB.');
  requireValue(
    evidence.summary?.platform_boundary_passed === true,
    'selected-media upload evidence must pass platform boundary gate.'
  );
  requireValue(evidence.summary?.upload_unit_passed === true, 'selected-media upload evidence must pass upload unit tests.');
  requireValue(
    evidence.summary?.true_service_upload_passed === true,
    'selected-media upload evidence must pass true-service upload/delete.'
  );
  requireValue(
    evidence.summary?.synthetic_fixture_upload === true,
    'selected-media upload evidence must declare synthetic fixture upload.'
  );
  requireValue(evidence.summary?.blocked === false, 'selected-media upload evidence must have blocked=false.');
  requireValue(
    evidence.true_service?.required_steps?.['m5.upload_case_create'] === true &&
      evidence.true_service?.required_steps?.['m5.evidence_upload'] === true &&
      evidence.true_service?.required_steps?.['m5.evidence_delete'] === true,
    'selected-media upload evidence must prove m5 upload case, evidence upload, and evidence delete steps.'
  );

  return evidence.type === 'app-selected-media-backend-upload-smoke' &&
    evidence.api?.local === true &&
    evidence.database?.local === true &&
    evidence.summary?.true_service_upload_passed === true &&
    evidence.summary?.blocked === false;
}

function validatePhysicalDeviceEvidence(filePath, app) {
  if (!filePath) return false;
  if (!filePath.endsWith('.json')) {
    failures.push('physical device evidence must be structured JSON generated by mobile/scripts/run-physical-device-smoke.mjs.');
    return false;
  }

  const evidence = readJson(filePath);
  const policyPassed = requireExternalEvidencePolicy(evidence, app, 'physical_device', 'physical device evidence');
  requireValue(
    evidence.type === 'app-physical-device-smoke',
    'physical device evidence type must be app-physical-device-smoke.'
  );
  requireValue(
    evidence.platform === 'ios' || evidence.platform === 'android',
    'physical device evidence platform must be ios or android.'
  );
  if (evidence.platform === 'ios') {
    requireValue(
      evidence.app_ios_bundle_identifier === app.ios?.bundleIdentifier,
      `physical iOS evidence bundle identifier must match ${app.ios?.bundleIdentifier}.`
    );
  }
  if (evidence.platform === 'android') {
    requireValue(
      evidence.app_android_package === app.android?.package,
      `physical Android evidence package must match ${app.android?.package}.`
    );
  }
  requireValue(evidence.device?.is_physical === true, 'physical device evidence must mark device.is_physical=true.');
  requireValue(Boolean(evidence.device?.identifier_sha256), 'physical device evidence must include a hashed device identifier.');
  requireValue(evidence.summary?.device_connected === true, 'physical device evidence must prove device_connected=true.');
  requireValue(evidence.summary?.device_is_physical === true, 'physical device evidence must prove device_is_physical=true.');
  requireValue(evidence.summary?.static_gate_passed === true, 'physical device evidence must pass Maestro static gate.');
  requireValue(evidence.summary?.platform_readiness_passed === true, 'physical device evidence must pass platform readiness gate.');
  requireValue(evidence.summary?.app_runtime_passed === true, 'physical device evidence must pass native app runtime launch.');
  requireValue(evidence.summary?.maestro_smoke_passed === true, 'physical device evidence must pass M0 Maestro smoke.');
  requireValue(evidence.summary?.blocked === false, 'physical device evidence must have blocked=false.');

  return evidence.type === 'app-physical-device-smoke' &&
    (evidence.platform === 'ios' || evidence.platform === 'android') &&
    evidence.device?.is_physical === true &&
    evidence.summary?.device_connected === true &&
    evidence.summary?.device_is_physical === true &&
    evidence.summary?.static_gate_passed === true &&
    evidence.summary?.platform_readiness_passed === true &&
    evidence.summary?.app_runtime_passed === true &&
    evidence.summary?.maestro_smoke_passed === true &&
    evidence.summary?.blocked === false &&
    policyPassed;
}

function validatePushDeliveryEvidence(filePath, app) {
  if (!filePath) return false;
  if (!filePath.endsWith('.json')) {
    failures.push('push delivery evidence must be structured JSON generated by mobile/scripts/run-push-delivery-smoke.mjs.');
    return false;
  }

  const evidence = readJson(filePath);
  const policyPassed = requireExternalEvidencePolicy(evidence, app, 'push_delivery', 'push delivery evidence');
  requireValue(
    evidence.type === 'app-push-provider-delivery-smoke',
    'push delivery evidence type must be app-push-provider-delivery-smoke.'
  );
  requireValue(evidence.provider === 'expo', 'push delivery evidence provider must be expo.');
  requireValue(
    evidence.app_ios_bundle_identifier === app.ios?.bundleIdentifier,
    `push delivery evidence iOS bundle identifier must match ${app.ios?.bundleIdentifier}.`
  );
  requireValue(
    evidence.app_android_package === app.android?.package,
    `push delivery evidence Android package must match ${app.android?.package}.`
  );
  requireValue(Boolean(evidence.push_token?.sha256), 'push delivery evidence must include only a hashed push token.');
  requireValue(
    evidence.push_token?.redacted === true,
    'push delivery evidence must declare the raw push token redacted.'
  );
  requireValue(
    evidence.payload?.source_path === '/notifications',
    'push delivery evidence must target the App notification landing path.'
  );
  requireValue(evidence.summary?.run_mode === 'run', 'push delivery evidence must be generated in run mode.');
  requireValue(evidence.summary?.provider_send_passed === true, 'push delivery evidence must pass provider send.');
  requireValue(evidence.summary?.ticket_accepted === true, 'push delivery evidence must include an accepted provider ticket.');
  requireValue(evidence.summary?.receipt_checked === true, 'push delivery evidence must poll provider receipt.');
  requireValue(evidence.summary?.receipt_ok === true, 'push delivery evidence must include ok provider receipt.');
  requireValue(evidence.summary?.blocked === false, 'push delivery evidence must have blocked=false.');

  return evidence.type === 'app-push-provider-delivery-smoke' &&
    evidence.provider === 'expo' &&
    evidence.push_token?.sha256 &&
    evidence.push_token?.redacted === true &&
    evidence.payload?.source_path === '/notifications' &&
    evidence.summary?.run_mode === 'run' &&
    evidence.summary?.provider_send_passed === true &&
    evidence.summary?.ticket_accepted === true &&
    evidence.summary?.receipt_checked === true &&
    evidence.summary?.receipt_ok === true &&
    evidence.summary?.blocked === false &&
    policyPassed;
}

function validateNativeCrashRuntimeEvidence(filePath, app) {
  if (!filePath) return false;
  if (!filePath.endsWith('.json')) {
    failures.push('native crash runtime evidence must be structured JSON generated by mobile/scripts/run-native-crash-runtime-smoke.mjs.');
    return false;
  }

  const evidence = readJson(filePath);
  const policyPassed = requireExternalEvidencePolicy(evidence, app, 'native_crash_runtime', 'native crash runtime evidence');
  requireValue(
    evidence.type === 'app-native-crash-runtime-evidence',
    'native crash runtime evidence type must be app-native-crash-runtime-evidence.'
  );
  requireValue(evidence.provider === 'sentry', 'native crash runtime evidence provider must be sentry.');
  requireValue(
    evidence.app_ios_bundle_identifier === app.ios?.bundleIdentifier,
    `native crash runtime evidence iOS bundle identifier must match ${app.ios?.bundleIdentifier}.`
  );
  requireValue(
    evidence.app_android_package === app.android?.package,
    `native crash runtime evidence Android package must match ${app.android?.package}.`
  );
  requireValue(Boolean(evidence.sentry?.event_id_sha256), 'native crash runtime evidence must include only a hashed Sentry event id.');
  requireValue(evidence.summary?.run_mode === 'run', 'native crash runtime evidence must be generated in run mode.');
  requireValue(evidence.summary?.provider_query_passed === true, 'native crash runtime evidence must pass provider query.');
  requireValue(evidence.summary?.event_found === true, 'native crash runtime evidence must find a provider event.');
  requireValue(evidence.summary?.release_matches === true, 'native crash runtime evidence must match App release.');
  requireValue(evidence.summary?.environment_matches === true, 'native crash runtime evidence must match Sentry environment.');
  requireValue(
    evidence.expected?.environment === 'production',
    'native crash runtime evidence expected environment must be production.'
  );
  requireValue(
    evidence.event?.environment === 'production',
    'native crash runtime evidence event environment must be production.'
  );
  requireValue(evidence.summary?.native_runtime_observed === true, 'native crash runtime evidence must observe native runtime.');
  requireValue(evidence.summary?.crash_event_observed === true, 'native crash runtime evidence must observe a crash-like event.');
  requireValue(evidence.summary?.blocked === false, 'native crash runtime evidence must have blocked=false.');

  return evidence.type === 'app-native-crash-runtime-evidence' &&
    evidence.provider === 'sentry' &&
    Boolean(evidence.sentry?.event_id_sha256) &&
    evidence.summary?.run_mode === 'run' &&
    evidence.summary?.provider_query_passed === true &&
    evidence.summary?.event_found === true &&
    evidence.summary?.release_matches === true &&
    evidence.summary?.environment_matches === true &&
    evidence.expected?.environment === 'production' &&
    evidence.event?.environment === 'production' &&
    evidence.summary?.native_runtime_observed === true &&
    evidence.summary?.crash_event_observed === true &&
    evidence.summary?.blocked === false &&
    policyPassed;
}

function validateTelemetryRuntimeEvidence(filePath, app) {
  if (!filePath) return false;
  if (!filePath.endsWith('.json')) {
    failures.push('telemetry runtime evidence must be structured JSON generated by mobile/scripts/run-telemetry-runtime-smoke.mjs.');
    return false;
  }

  const evidence = readJson(filePath);
  if (
    evidence.app_ios_bundle_identifier !== app.ios?.bundleIdentifier ||
    evidence.app_android_package !== app.android?.package
  ) {
    return ignoreStaleEvidence(
      'telemetry runtime',
      filePath,
      `ios=${evidence.app_ios_bundle_identifier ?? 'missing'}, android=${evidence.app_android_package ?? 'missing'}, expected=${app.ios?.bundleIdentifier}/${app.android?.package}`
    );
  }
  const policyPassed = requireExternalEvidencePolicy(evidence, app, 'telemetry_runtime', 'telemetry runtime evidence');
  requireValue(
    evidence.type === 'app-telemetry-runtime-evidence',
    'telemetry runtime evidence type must be app-telemetry-runtime-evidence.'
  );
  requireValue(evidence.provider === 'backend', 'telemetry runtime evidence provider must be backend.');
  requireValue(
    evidence.app_ios_bundle_identifier === app.ios?.bundleIdentifier,
    `telemetry runtime evidence iOS bundle identifier must match ${app.ios?.bundleIdentifier}.`
  );
  requireValue(
    evidence.app_android_package === app.android?.package,
    `telemetry runtime evidence Android package must match ${app.android?.package}.`
  );
  requireValue(evidence.app_version === app.version, `telemetry runtime evidence app version must match ${app.version}.`);
  requireValue(
    evidence.app_build_number === app.ios?.buildNumber,
    `telemetry runtime evidence build number must match ${app.ios?.buildNumber}.`
  );
  requireValue(
    evidence.app_version_code === String(app.android?.versionCode),
    `telemetry runtime evidence versionCode must match ${app.android?.versionCode}.`
  );
  requireValue(evidence.api?.non_local === true, 'telemetry runtime evidence must target a non-local API.');
  requireValue(evidence.api?.raw_url_redacted === true, 'telemetry runtime evidence must not store the raw API URL.');
  requireValue(Boolean(evidence.api?.host_sha256), 'telemetry runtime evidence must include only a hashed API host.');
  const backendVersionFreshnessErrors = validateTelemetryBackendVersionFreshness(evidence, repoRoot);
  for (const error of backendVersionFreshnessErrors) {
    failures.push(`telemetry runtime evidence: ${error}.`);
  }
  requireValue(
    evidence.backend_version?.endpoint_path === '/version',
    'telemetry runtime evidence must check backend /version before ingest.'
  );
  requireValue(
    evidence.backend_version?.raw_url_redacted === true,
    'telemetry runtime evidence backend version check must not store the raw URL.'
  );
  requireValue(
    Boolean(evidence.backend_version?.host_sha256),
    'telemetry runtime evidence backend version check must hash the API host.'
  );
  requireValue(
    evidence.backend_version?.response_ok === true,
    'telemetry runtime evidence backend /version response must be ok.'
  );
  requireValue(
    evidence.backend_version?.service === 'backend',
    'telemetry runtime evidence backend /version service must be backend.'
  );
  requireValue(
    evidence.backend_version?.commit_matches_expected === true,
    'telemetry runtime evidence backend /version commit precheck must pass.'
  );
  requireValue(Boolean(evidence.event?.request_id_sha256), 'telemetry runtime evidence must hash the event request id.');
  requireValue(Boolean(evidence.otlp?.trace_id_sha256), 'telemetry runtime evidence must hash the OTLP trace id.');
  requireValue(Boolean(evidence.otlp?.span_id_sha256), 'telemetry runtime evidence must hash the OTLP span id.');
  requireValue(evidence.summary?.run_mode === 'run', 'telemetry runtime evidence must be generated in run mode.');
  requireValue(evidence.summary?.api_non_local === true, 'telemetry runtime evidence summary must prove non-local API.');
  requireValue(evidence.summary?.backend_version_passed === true, 'telemetry runtime evidence must pass backend version precheck.');
  requireValue(evidence.summary?.event_ingest_passed === true, 'telemetry runtime evidence must pass event ingest.');
  requireValue(evidence.summary?.otlp_ingest_passed === true, 'telemetry runtime evidence must pass OTLP ingest.');
  requireValue(
    Number(evidence.summary?.event_accepted_count) >= 1,
    'telemetry runtime evidence must accept at least one event.'
  );
  requireValue(
    Number(evidence.summary?.otlp_accepted_spans) >= 1,
    'telemetry runtime evidence must accept at least one OTLP span.'
  );
  requireValue(evidence.summary?.safe_payload === true, 'telemetry runtime evidence must use a safe payload.');
  requireValue(evidence.summary?.blocked === false, 'telemetry runtime evidence must have blocked=false.');

  return evidence.type === 'app-telemetry-runtime-evidence' &&
    evidence.provider === 'backend' &&
    evidence.app_ios_bundle_identifier === app.ios?.bundleIdentifier &&
    evidence.app_android_package === app.android?.package &&
    evidence.app_version === app.version &&
    evidence.app_build_number === app.ios?.buildNumber &&
    evidence.app_version_code === String(app.android?.versionCode) &&
    evidence.api?.non_local === true &&
    evidence.api?.raw_url_redacted === true &&
    Boolean(evidence.api?.host_sha256) &&
    backendVersionFreshnessErrors.length === 0 &&
    evidence.backend_version?.endpoint_path === '/version' &&
    evidence.backend_version?.raw_url_redacted === true &&
    Boolean(evidence.backend_version?.host_sha256) &&
    evidence.backend_version?.response_ok === true &&
    evidence.backend_version?.service === 'backend' &&
    evidence.backend_version?.commit_matches_expected === true &&
    Boolean(evidence.event?.request_id_sha256) &&
    Boolean(evidence.otlp?.trace_id_sha256) &&
    Boolean(evidence.otlp?.span_id_sha256) &&
    evidence.summary?.run_mode === 'run' &&
    evidence.summary?.api_non_local === true &&
    evidence.summary?.backend_version_passed === true &&
    evidence.summary?.event_ingest_passed === true &&
    evidence.summary?.otlp_ingest_passed === true &&
    Number(evidence.summary?.event_accepted_count) >= 1 &&
    Number(evidence.summary?.otlp_accepted_spans) >= 1 &&
    evidence.summary?.safe_payload === true &&
    evidence.summary?.blocked === false &&
    policyPassed;
}

function runCommand(command, args = [], options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function commandAvailable(candidates, args = ['--version']) {
  for (const command of candidates) {
    if (!command) continue;
    const result = runCommand(command, args);
    if (result.status === 0) return command;
  }
  return null;
}

function commandAvailableWithOptions(candidates, args = ['--version'], options = {}) {
  for (const command of candidates) {
    if (!command) continue;
    const result = runCommand(command, args, options);
    if (result.status === 0) return command;
  }
  return null;
}

function buildJavaToolEnv() {
  const homebrewJavaHome = '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';
  const javaHome =
    process.env.JAVA_HOME || (fs.existsSync(path.join(homebrewJavaHome, 'bin/java')) ? homebrewJavaHome : null);
  if (!javaHome) return process.env;
  return {
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${path.join(javaHome, 'bin')}:${process.env.PATH ?? ''}`,
  };
}

function firstExistingPath(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

function addCompletionCheck({ id, done, blocker, docNeedles, evidence }) {
  const documented = docNeedles.some((needle) => docsText.includes(needle));
  requireValue(documented, `completion blocker ${id} must be documented with one of: ${docNeedles.join(' | ')}`);
  const handoffCatalogIds = completionToExternalHandoffBlockerIds[id] ?? [];
  const handoffBlockerIds = done ? [] : handoffCatalogIds;

  completionChecks.push({
    id,
    status: done ? 'passed' : 'blocked',
    documented,
    evidence: evidence ?? null,
    blocker: done ? null : blocker,
    doc_needles: docNeedles,
    handoff_catalog_ids: handoffCatalogIds,
    handoff_blocker_ids: handoffBlockerIds,
  });

  if (done) {
    verified.push(evidence ?? id);
  } else {
    blockers.push(`${id}: ${blocker}`);
  }
}

function writeFixture(tempRoot, fileName, record) {
  const filePath = path.join(tempRoot, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function runExternalEvidenceFixtureContract(app) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cj-release-evidence-fixtures-'));
  const hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const validators = [
    {
      label: 'eas ios + testflight',
      fileName: 'App-EAS-iOS-Release-Fixture.json',
      validate: (filePath) => validateEasIosReleaseEvidence(filePath, app) && validateTestFlightEvidence(filePath, app),
      mutate: (record) => {
        record.summary.artifact_head_passed = false;
      },
      record: {
        type: 'app-eas-ios-release-evidence',
        app_ios_bundle_identifier: app.ios?.bundleIdentifier,
        app_version: app.version,
        app_build_number: app.ios?.buildNumber,
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
      },
    },
    {
      label: 'eas android',
      fileName: 'App-EAS-Android-Release-Fixture.json',
      validate: (filePath) => validateEasAndroidReleaseEvidence(filePath, app),
      mutate: (record) => {
        record.summary.version_code_matches = false;
      },
      record: {
        type: 'app-eas-android-release-evidence',
        app_android_package: app.android?.package,
        app_version: app.version,
        app_version_code: String(app.android?.versionCode),
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
    },
    {
      label: 'physical device',
      fileName: 'App-Physical-Device-Fixture.json',
      validate: (filePath) => validatePhysicalDeviceEvidence(filePath, app),
      mutate: (record) => {
        record.device.is_physical = false;
      },
      record: {
        type: 'app-physical-device-smoke',
        platform: 'ios',
        app_android_package: app.android?.package,
        app_ios_bundle_identifier: app.ios?.bundleIdentifier,
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
    },
    {
      label: 'push delivery',
      fileName: 'App-Push-Delivery-Fixture.json',
      validate: (filePath) => validatePushDeliveryEvidence(filePath, app),
      mutate: (record) => {
        record.summary.receipt_ok = false;
      },
      record: {
        type: 'app-push-provider-delivery-smoke',
        provider: 'expo',
        app_ios_bundle_identifier: app.ios?.bundleIdentifier,
        app_android_package: app.android?.package,
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
    },
    {
      label: 'native crash runtime',
      fileName: 'App-Native-Crash-Runtime-Fixture.json',
      validate: (filePath) => validateNativeCrashRuntimeEvidence(filePath, app),
      mutate: (record) => {
        record.event.environment = 'development';
      },
      record: {
        type: 'app-native-crash-runtime-evidence',
        provider: 'sentry',
        app_ios_bundle_identifier: app.ios?.bundleIdentifier,
        app_android_package: app.android?.package,
        sentry: {
          event_id_sha256: hash,
        },
        expected: {
          release: `emorapy-mobile@${app.version}+${app.ios?.buildNumber}`,
          environment: 'production',
        },
        event: {
          release: `emorapy-mobile@${app.version}+${app.ios?.buildNumber}`,
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
    },
    {
      label: 'telemetry runtime',
      fileName: 'App-Telemetry-Runtime-Fixture.json',
      validate: (filePath) => validateTelemetryRuntimeEvidence(filePath, app),
      mutate: (record) => {
        record.summary.otlp_ingest_passed = false;
      },
      record: {
        type: 'app-telemetry-runtime-evidence',
        provider: 'backend',
        app_android_package: app.android?.package,
        app_ios_bundle_identifier: app.ios?.bundleIdentifier,
        app_version: app.version,
        app_build_number: app.ios?.buildNumber,
        app_version_code: String(app.android?.versionCode),
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
          commit_sha: getCurrentGitHead(),
          commit_short_sha: getCurrentGitHead()?.slice(0, 7),
          expected_commit_sha: getCurrentGitHead(),
          expected_commit_short_sha: getCurrentGitHead()?.slice(0, 7),
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
    },
    {
      label: 'release db parity',
      fileName: 'App-Release-DB-Parity-Fixture.json',
      validate: (filePath) => validateReleaseDbEvidence(filePath),
      mutate: (record) => {
        record.target.database.local = true;
      },
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
    },
  ];

  const fixtureFailures = [];

  for (const validator of validators) {
    failures.length = 0;
    const positivePath = writeFixture(tempRoot, validator.fileName, validator.record);
    if (!validator.validate(positivePath) || failures.length > 0) {
      fixtureFailures.push(
        `${validator.label} positive fixture failed: ${failures.join(' | ') || 'validator returned false'}`
      );
    }

    failures.length = 0;
    const negativeRecord = JSON.parse(JSON.stringify(validator.record));
    validator.mutate(negativeRecord);
    const negativePath = writeFixture(tempRoot, validator.fileName.replace('.json', '-Invalid.json'), negativeRecord);
    if (validator.validate(negativePath) || failures.length === 0) {
      fixtureFailures.push(`${validator.label} negative fixture was not rejected.`);
    }
  }

  failures.length = 0;

  if (fixtureFailures.length) {
    console.error('[release-external-evidence-fixtures-check] failures:');
    for (const failure of fixtureFailures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`[release-external-evidence-fixtures-check] ok: ${validators.length} evidence validator fixture pairs passed`);
  process.exit(0);
}

if (fixtureContract) {
  const fixtureApp = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  runExternalEvidenceFixtureContract(fixtureApp);
}

const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
const easProjectId = getExpoProjectIdStatus(app);
const pkg = readJson(path.join(mobileRoot, 'package.json'));
const scripts = pkg.scripts ?? {};
const appReleaseSignoffWorkflow = readText(path.join(repoRoot, '.github/workflows/app-release-external-signoff.yml'));
const releaseEvidenceSanitizationScript = readText(
  path.join(mobileRoot, 'scripts/check-release-evidence-sanitization.mjs')
);
const externalEvidenceStatusScript = readText(
  path.join(mobileRoot, 'scripts/check-release-external-evidence-status.mjs')
);
const externalEvidencePolicyScript = readText(
  path.join(mobileRoot, 'scripts/lib/release-evidence-policy.mjs')
);
const externalEvidenceStatusContractScript = readText(
  path.join(mobileRoot, 'scripts/check-release-external-evidence-status-contract.mjs')
);
const externalEvidenceHandoffScript = readText(
  path.join(mobileRoot, 'scripts/check-release-external-evidence-handoff.mjs')
);
const externalEvidenceHandoffContractScript = readText(
  path.join(mobileRoot, 'scripts/check-release-external-evidence-handoff-contract.mjs')
);
const externalSignoffPrereqReportScript = readText(
  path.join(mobileRoot, 'scripts/check-release-external-signoff-prerequisite-report.mjs')
);
const externalSignoffWorkflowContractScript = readText(
  path.join(mobileRoot, 'scripts/check-release-external-signoff-workflow.mjs')
);
const externalSignoffEnvTemplateScript = readText(
  path.join(mobileRoot, 'scripts/check-release-external-signoff-env-template.mjs')
);
const externalSignoffInputStatusScript = readText(
  path.join(mobileRoot, 'scripts/check-release-external-signoff-input-status.mjs')
);
const externalSignoffFillInputsScript = readText(
  path.join(mobileRoot, 'scripts/fill-release-external-signoff-inputs.mjs')
);
const githubSecretNamesScript = readText(
  path.join(mobileRoot, 'scripts/check-release-github-secret-names.mjs')
);
const githubSecretsSyncScript = readText(path.join(mobileRoot, 'scripts/sync-release-github-secrets.mjs'));
const githubSecretsSyncContractScript = readText(
  path.join(mobileRoot, 'scripts/check-release-github-secret-sync-contract.mjs')
);
const releaseEnvTemplate = readText(path.join(mobileRoot, 'release.env.example'));
const mobileGitignore = readText(path.join(mobileRoot, '.gitignore'));
const runReleaseExternalSignoffScript = readText(
  path.join(mobileRoot, 'scripts/run-release-external-evidence-signoff.mjs')
);
const dependencyMap = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
};
const docsText = docPaths.map(readText).join('\n');

const expectedMaestroEvidence =
  process.env.APP_NATIVE_MAESTRO_EVIDENCE_FILE ||
  'App-Native-Maestro-2026-05-08T16-03-15-803Z.json';
const maestroEvidencePath = path.join(evidenceRoot, expectedMaestroEvidence);
if (fs.existsSync(maestroEvidencePath)) {
  const evidence = readJson(maestroEvidencePath);
  requireValue(evidence.type === 'app-native-maestro-execution', 'native Maestro evidence type must be app-native-maestro-execution.');
  requireValue(evidence.summary?.passed_flows === 7, 'native Maestro evidence must prove 7 passed flows.');
  requireValue(evidence.summary?.failed_flows === 0, 'native Maestro evidence must have zero failed flows.');
  requireValue(evidence.summary?.blocked === false, 'native Maestro evidence must not be blocked.');
  verified.push(`iOS simulator native Maestro evidence: ${expectedMaestroEvidence}`);
} else {
  failures.push(`missing iOS simulator native Maestro evidence: ${path.relative(repoRoot, maestroEvidencePath)}`);
}

const requiredPreflightScripts = [
  'test',
  'accessibility:check',
  'copy:check',
  'routes:check',
  'features:check',
  'platform:check',
  'typecheck',
  'smoke:web',
  'web:routes:smoke',
  'maestro:check',
  'native:check',
  'android:check',
  'device-discovery:check',
  'release:evidence:check',
  'release:evidence-redaction:check',
  'release:evidence-sanitization:check',
  'release:external-evidence:status',
  'release:external-evidence:status:contract',
  'release:external-evidence:handoff:check',
  'release:external-evidence:handoff:contract',
  'release:external-evidence:fixtures:check',
  'release:external-evidence:dry-run',
  'release:external-evidence:signoff',
  'release:external-evidence:signoff:android-dry-run',
  'release:external-evidence:prereq-report:check',
  'release:external-evidence:workflow:check',
  'release:external-evidence:env-template:check',
  'release:external-evidence:input-status',
  'release:external-evidence:github-secrets:sync:contract',
  'release:completion:audit',
  'release:completion:audit:contract',
  'goal:completion:audit',
  'goal:completion:audit:contract',
  'release:check',
];
requireValue(Boolean(scripts['release:completion:audit']), 'package.json must expose release:completion:audit.');
requireValue(Boolean(scripts['release:completion:audit:strict']), 'package.json must expose release:completion:audit:strict.');
requireValue(Boolean(scripts['release:completion:audit:contract']), 'package.json must expose release:completion:audit:contract.');
requireValue(Boolean(scripts['goal:completion:audit']), 'package.json must expose goal:completion:audit.');
requireValue(Boolean(scripts['goal:completion:audit:strict']), 'package.json must expose goal:completion:audit:strict.');
requireValue(Boolean(scripts['goal:completion:audit:contract']), 'package.json must expose goal:completion:audit:contract.');
requireValue(Boolean(scripts['release:evidence-redaction:check']), 'package.json must expose release:evidence-redaction:check.');
requireValue(Boolean(scripts['release:evidence-sanitization:check']), 'package.json must expose release:evidence-sanitization:check.');
requireValue(Boolean(scripts['copy:check']), 'package.json must expose copy:check.');
requireValue(Boolean(scripts['routes:check']), 'package.json must expose routes:check.');
requireValue(Boolean(scripts['features:check']), 'package.json must expose features:check.');
requireValue(Boolean(scripts['web:routes:smoke']), 'package.json must expose web:routes:smoke.');
requireValue(
  releaseEvidenceSanitizationScript.includes('runRedactionExtraDirChecks') &&
    releaseEvidenceSanitizationScript.includes('App-External-Signoff-Prerequisites-Clean.json') &&
    releaseEvidenceSanitizationScript.includes('App-External-Signoff-Prerequisites-Leak.json') &&
    releaseEvidenceSanitizationScript.includes('redaction extra-dir leak report failed without proving the injected report was scanned'),
  'release:evidence-sanitization:check must cover extra evidence-dir redaction pass/fail cases.'
);
requireValue(
  externalSignoffPrereqReportScript.includes('validate/run blocked before external steps') &&
    externalSignoffPrereqReportScript.includes('safe resolution hints') &&
    externalSignoffPrereqReportScript.includes('resolution_hints') &&
    externalSignoffPrereqReportScript.includes('owner_surface') &&
    externalSignoffPrereqReportScript.includes('dry-run status/handoff reports are written') &&
    externalSignoffPrereqReportScript.includes('App-External-Evidence-Status-') &&
    externalSignoffPrereqReportScript.includes('App-External-Evidence-Handoff-') &&
    externalSignoffPrereqReportScript.includes('skipped run mode is rejected') &&
    externalSignoffPrereqReportScript.includes('forbiddenExternalStepNeedles') &&
    externalSignoffPrereqReportScript.includes('assertNoSensitiveLeaks(`${label} stdout/stderr`, output)') &&
    externalSignoffPrereqReportScript.includes("expectedMode: 'run'") &&
    externalSignoffPrereqReportScript.includes('env-file placeholders remain missing') &&
    externalSignoffPrereqReportScript.includes('unsafe env-file keys are rejected') &&
    externalSignoffPrereqReportScript.includes('unsupported --release-env-file key: NODE_OPTIONS'),
  'release:external-evidence:prereq-report:check must cover validate and run prerequisite failures without leaking secrets or starting external steps.'
);
requireValue(
  runReleaseExternalSignoffScript.includes('options.run && !options.validateOnly && options.skip.size > 0') &&
    runReleaseExternalSignoffScript.includes(
      'release:external-evidence:run must execute every evidence step and strict audit'
    ) &&
    runReleaseExternalSignoffScript.includes('buildPrerequisiteResolutionHints') &&
    runReleaseExternalSignoffScript.includes('prerequisiteActionCatalog') &&
    runReleaseExternalSignoffScript.includes('resolution_hints') &&
    runReleaseExternalSignoffScript.includes("id: 'handoff'") &&
    runReleaseExternalSignoffScript.includes('check-release-external-evidence-handoff.mjs') &&
    runReleaseExternalSignoffScript.includes('allowedReleaseEnvFileKeys') &&
    runReleaseExternalSignoffScript.includes('unsupported --release-env-file key') &&
    runReleaseExternalSignoffScript.includes('isPlaceholderValue'),
  'release:external-evidence:run must reject --skip in formal run mode, emit safe prerequisite resolution hints, only load allowlisted env-file keys, and always run the handoff step so strict audits cannot be bypassed and blockers remain actionable.'
);
requireValue(Boolean(scripts['release:external-evidence:status']), 'package.json must expose release:external-evidence:status.');
requireValue(Boolean(scripts['release:external-evidence:status:contract']), 'package.json must expose release:external-evidence:status:contract.');
requireValue(Boolean(scripts['release:external-evidence:handoff:check']), 'package.json must expose release:external-evidence:handoff:check.');
requireValue(Boolean(scripts['release:external-evidence:handoff:contract']), 'package.json must expose release:external-evidence:handoff:contract.');
requireValue(
  externalEvidenceStatusScript.includes('function buildBlockers') &&
    externalEvidenceStatusScript.includes('buildReleaseEvidencePolicies') &&
    externalEvidenceStatusScript.includes('summarizeEvidenceCandidate') &&
    externalEvidenceStatusScript.includes('App-External-Evidence-Status-') &&
    externalEvidenceStatusScript.includes('writeStatusReport') &&
    externalEvidenceStatusScript.includes('normalized blockers') &&
    externalEvidenceStatusScript.includes('eas_ios_release_evidence') &&
    externalEvidenceStatusScript.includes('telemetry_runtime_evidence') &&
    externalEvidenceStatusScript.includes('release_db_parity_evidence') &&
    externalEvidenceStatusScript.includes('ios_physical_device_visible'),
  'release:external-evidence:status must expose normalized blockers for CI / dashboard consumers.'
);
requireValue(
  externalEvidencePolicyScript.includes('validateEvidenceAgainstPolicy') &&
    externalEvidencePolicyScript.includes('buildReleaseEvidencePolicies') &&
    externalEvidencePolicyScript.includes('summarizeEvidenceCandidate') &&
    externalEvidencePolicyScript.includes('invalid_candidate') &&
    externalEvidencePolicyScript.includes('numberAtLeast') &&
    externalEvidencePolicyScript.includes('device.is_physical') &&
    externalEvidencePolicyScript.includes('push_token.redacted') &&
    externalEvidencePolicyScript.includes('app-eas-ios-release-evidence') &&
    externalEvidencePolicyScript.includes('app-telemetry-runtime-evidence') &&
    externalEvidencePolicyScript.includes('app-release-db-parity-evidence'),
  'shared release evidence policy must pin type-aware, identity-bound external evidence validation used by status and completion audits.'
);
requireValue(
  externalEvidenceStatusContractScript.includes('requiredCurrentBlockerIds') &&
    externalEvidenceStatusContractScript.includes('validateBlockers') &&
    externalEvidenceStatusContractScript.includes('invalid EAS evidence must be reported as invalid_candidate') &&
    externalEvidenceStatusContractScript.includes('evidence candidates are type-aware') &&
    externalEvidenceStatusContractScript.includes('identity-bound') &&
    externalEvidenceStatusContractScript.includes('validateEvidenceFixturePair') &&
    externalEvidenceStatusContractScript.includes('status report JSON') &&
    externalEvidenceStatusContractScript.includes('App-External-Evidence-Status-') &&
    externalEvidenceStatusContractScript.includes('blockers are normalized') &&
    externalEvidenceStatusContractScript.includes('controlled-secret status JSON blockers must not include') &&
    externalEvidenceStatusContractScript.includes('telemetry_runtime_evidence') &&
    externalEvidenceStatusContractScript.includes('release_db_parity_evidence'),
  'release:external-evidence:status:contract must validate identity-bound evidence candidates, normalized blockers, and secret-safe blocker messages.'
);
requireValue(
  externalEvidenceHandoffScript.includes('app-external-evidence-handoff') &&
    externalEvidenceHandoffScript.includes('knownBlockerIds') &&
    externalEvidenceHandoffScript.includes('owner_surface') &&
    externalEvidenceHandoffScript.includes('accepted_evidence') &&
    externalEvidenceHandoffScript.includes('strict_gate') &&
    externalEvidenceHandoffScript.includes('App-External-Evidence-Handoff-') &&
    externalEvidenceHandoffScript.includes('assertNoSensitiveLeaks') &&
    externalEvidenceHandoffScript.includes('release:completion:audit:strict') &&
    externalEvidenceHandoffScript.includes('goal:completion:audit:strict') &&
    externalEvidenceHandoffScript.includes('telemetry_runtime_evidence') &&
    externalEvidenceHandoffScript.includes('release_db_parity_evidence'),
  'release:external-evidence:handoff:check must map every normalized blocker to owner actions, evidence targets, strict gates, and a secret-safe handoff report.'
);
requireValue(
  externalEvidenceHandoffContractScript.includes('app-external-evidence-handoff') &&
    externalEvidenceHandoffContractScript.includes('requiredKnownBlockerIds') &&
    externalEvidenceHandoffContractScript.includes('controlledSecrets') &&
    externalEvidenceHandoffContractScript.includes('App-External-Evidence-Handoff-') &&
    externalEvidenceHandoffContractScript.includes('check-release-evidence-redaction.mjs') &&
    externalEvidenceHandoffContractScript.includes('handoff report file JSON') &&
    externalEvidenceHandoffContractScript.includes('blocker catalog') &&
    externalEvidenceHandoffContractScript.includes('secret redaction are pinned'),
  'release:external-evidence:handoff:contract must validate handoff JSON schema, blocker catalog coverage, report artifact writing, and redaction safety.'
);
requireValue(Boolean(scripts['release:external-evidence:fixtures:check']), 'package.json must expose release:external-evidence:fixtures:check.');
requireValue(Boolean(scripts['release:external-evidence:dry-run']), 'package.json must expose release:external-evidence:dry-run.');
requireValue(Boolean(scripts['release:external-evidence:signoff']), 'package.json must expose release:external-evidence:signoff.');
requireValue(Boolean(scripts['release:external-evidence:signoff:android-dry-run']), 'package.json must expose release:external-evidence:signoff:android-dry-run.');
requireValue(
  scripts['release:external-evidence:signoff:android-dry-run']?.includes('--physical-platform=android'),
  'release:external-evidence:signoff:android-dry-run must exercise the Android physical-platform orchestrator branch.'
);
requireValue(Boolean(scripts['release:external-evidence:validate']), 'package.json must expose release:external-evidence:validate.');
requireValue(Boolean(scripts['release:external-evidence:prereq-report:check']), 'package.json must expose release:external-evidence:prereq-report:check.');
requireValue(Boolean(scripts['release:external-evidence:workflow:check']), 'package.json must expose release:external-evidence:workflow:check.');
requireValue(Boolean(scripts['release:external-evidence:env-template:check']), 'package.json must expose release:external-evidence:env-template:check.');
requireValue(Boolean(scripts['release:external-evidence:input-status']), 'package.json must expose release:external-evidence:input-status.');
requireValue(Boolean(scripts['release:external-evidence:fill-inputs']), 'package.json must expose release:external-evidence:fill-inputs.');
requireValue(Boolean(scripts['release:external-evidence:github-secrets:check']), 'package.json must expose release:external-evidence:github-secrets:check.');
requireValue(Boolean(scripts['release:external-evidence:github-secrets:strict']), 'package.json must expose release:external-evidence:github-secrets:strict.');
requireValue(Boolean(scripts['release:external-evidence:github-secrets:sync']), 'package.json must expose release:external-evidence:github-secrets:sync.');
requireValue(Boolean(scripts['release:external-evidence:github-secrets:sync:contract']), 'package.json must expose release:external-evidence:github-secrets:sync:contract.');
requireValue(Boolean(scripts['release:external-evidence:run']), 'package.json must expose release:external-evidence:run.');
requireValue(Boolean(scripts['release:db-parity:dry-run']), 'package.json must expose release:db-parity:dry-run.');
requireValue(
  externalSignoffWorkflowContractScript.includes('workflow contract is pinned') &&
    externalSignoffWorkflowContractScript.includes('runs-on: ${{ fromJSON(inputs.runner_json) }}') &&
    externalSignoffWorkflowContractScript.includes('Validate release secrets for run mode') &&
	    externalSignoffWorkflowContractScript.includes('steps.evidence_redaction.outcome') &&
	    externalSignoffWorkflowContractScript.includes('App-External-Evidence-Status-*.json') &&
	    externalSignoffWorkflowContractScript.includes('App-External-Evidence-Handoff-*.json') &&
	    externalSignoffWorkflowContractScript.includes('App-External-Signoff-Prerequisites-*.json') &&
	    externalSignoffWorkflowContractScript.includes('App-Telemetry-Runtime-*.json') &&
	    externalSignoffWorkflowContractScript.includes('App-Goal-Completion-Audit-*.json'),
	  'release:external-evidence:workflow:check must pin workflow runner, run-mode prerequisite probe, generated redaction gate, status report artifact, handoff artifact, prerequisite report artifact, and goal audit artifact contract.'
	);
requireValue(
  externalSignoffEnvTemplateScript.includes('release.env.example') &&
    externalSignoffEnvTemplateScript.includes('Do not commit real secrets') &&
    externalSignoffEnvTemplateScript.includes('APP_RELEASE_EXTERNAL_SIGNOFF_RUN') &&
    externalSignoffEnvTemplateScript.includes('REPLACE_WITH_') &&
    externalSignoffEnvTemplateScript.includes('postgresql://') &&
    externalSignoffEnvTemplateScript.includes('mobile/.gitignore') &&
    externalSignoffEnvTemplateScript.includes('release.env.*.local') &&
    externalSignoffEnvTemplateScript.includes('release env template is complete and secret-safe'),
  'release:external-evidence:env-template:check must pin a complete, non-run-mode, gitignored, secret-safe release env template.'
);
requireValue(
  scripts['release:external-evidence:input-status']?.includes('check-release-external-signoff-input-status.mjs'),
  'release:external-evidence:input-status must pin the redacted local input status checker.'
);
requireValue(
  scripts['release:external-evidence:fill-inputs']?.includes('fill-release-external-signoff-inputs.mjs'),
  'release:external-evidence:fill-inputs must pin the local interactive input fill helper.'
);
requireValue(
  externalSignoffInputStatusScript.includes('values_redacted') &&
    externalSignoffInputStatusScript.includes('ready_for_validate') &&
    externalSignoffInputStatusScript.includes('placeholder_count') &&
    externalSignoffInputStatusScript.includes('missing_count') &&
    externalSignoffInputStatusScript.includes('unsupported_keys') &&
    externalSignoffInputStatusScript.includes('getExpoProjectIdStatus'),
  'release:external-evidence:input-status must report redacted readiness, placeholders, missing keys, unsupported keys, and EAS project id status.'
);
requireValue(
  externalSignoffFillInputsScript.includes('Secret-like values are not echoed') &&
    externalSignoffFillInputsScript.includes('--list-missing') &&
    externalSignoffFillInputsScript.includes('isValidExpoProjectId') &&
    externalSignoffFillInputsScript.includes('check-release-external-signoff-input-status.mjs'),
  'release:external-evidence:fill-inputs must provide a secret-safe interactive fill helper, EAS project id validation, list-missing mode, and input-status verification.'
);
requireValue(
  scripts['release:external-evidence:github-secrets:check']?.includes('check-release-github-secret-names.mjs') &&
    scripts['release:external-evidence:github-secrets:strict']?.includes('check-release-github-secret-names.mjs --strict'),
  'release:external-evidence:github-secrets scripts must pin the redacted GitHub secret-name checker and strict mode.'
);
requireValue(
  scripts['release:external-evidence:github-secrets:sync']?.includes('sync-release-github-secrets.mjs'),
  'release:external-evidence:github-secrets:sync must pin the redacted GitHub secret sync helper.'
);
requireValue(
  scripts['release:external-evidence:github-secrets:sync:contract']?.includes('check-release-github-secret-sync-contract.mjs'),
  'release:external-evidence:github-secrets:sync:contract must pin the GitHub secret sync dry-run contract checker.'
);
requireValue(
  githubSecretNamesScript.includes('values_redacted') &&
    githubSecretNamesScript.includes('ready_for_workflow_validate') &&
    githubSecretNamesScript.includes('missing_secret_name_count') &&
    githubSecretNamesScript.includes('APP_RELEASE_DATABASE_URL') &&
    githubSecretNamesScript.includes("const defaultWorkflowEnvironment = 'Production'") &&
    githubSecretNamesScript.includes('missing_configured_environments') &&
    githubSecretNamesScript.includes('encodeURIComponent(environment)'),
  'release:external-evidence:github-secrets checker must report redacted readiness, missing secret names, release DB secret name, Production environment scoping, and slash-safe environment lookup.'
);
requireValue(
  githubSecretsSyncScript.includes('values_redacted') &&
    githubSecretsSyncScript.includes("const environment = environmentArg?.slice('--env='.length) || 'Production'") &&
    githubSecretsSyncScript.includes("const apply = process.argv.includes('--apply')") &&
    githubSecretsSyncScript.includes("runGh(['secret', 'set', secret.secretName, '--repo', repo, '--env', environment]") &&
    githubSecretsSyncScript.includes("['DATABASE_URL', 'APP_RELEASE_DATABASE_URL']") &&
    githubSecretsSyncScript.includes('allowedEnvFileKeys') &&
    githubSecretsSyncScript.includes('unsupported --release-env-file key') &&
    githubSecretsSyncScript.includes("'APP_STORE_CONNECT_PRIVATE_KEY_PATH'") &&
    githubSecretsSyncScript.includes('secret_groups') &&
    githubSecretsSyncScript.includes('current_completion_blocker_secret_names') &&
    githubSecretsSyncScript.includes('evidence_refresh_secret_names') &&
    githubSecretsSyncScript.includes('ready_for_current_completion_sync_inputs') &&
    githubSecretsSyncScript.includes('ready_for_evidence_refresh_sync_inputs') &&
    githubSecretsSyncScript.includes('ready_for_sync_apply') &&
    githubSecretsSyncScript.includes('if (apply)') &&
    githubSecretsSyncScript.includes('ensureEnvironmentExists(environment)') &&
    githubSecretsSyncScript.includes('Dry-run only; pass --apply to verify the GitHub Environment and write secrets.'),
  'release:external-evidence:github-secrets:sync must default to dry-run, reject unsupported env-file keys, write only redacted Production environment secrets with --apply, map DATABASE_URL safely, convert ASC private key path to the CI secret, and group current-completion vs evidence-refresh readiness.'
);
requireValue(
  githubSecretsSyncContractScript.includes('dry-run is local-only') &&
    githubSecretsSyncContractScript.includes("PATH: ''") &&
    githubSecretsSyncContractScript.includes('ready_for_current_completion_sync_inputs') &&
    githubSecretsSyncContractScript.includes('ready_for_evidence_refresh_sync_inputs') &&
    githubSecretsSyncContractScript.includes('APP_RELEASE_DATABASE_URL') &&
    githubSecretsSyncContractScript.includes('APP_STORE_CONNECT_PRIVATE_KEY') &&
    githubSecretsSyncContractScript.includes('CONTROLLED_EXPO_TOKEN_DO_NOT_LEAK') &&
    githubSecretsSyncContractScript.includes('apply attempt without gh'),
  'release:external-evidence:github-secrets:sync:contract must prove local-only dry-run, redacted grouping, safe release DB/private-key mapping, and apply-only GitHub dependency.'
);
requireValue(
  releaseEnvTemplate.includes('APP_RELEASE_EXTERNAL_SIGNOFF_RUN=false') &&
    releaseEnvTemplate.includes('EXPO_TOKEN=REPLACE_WITH_EXPO_ACCESS_TOKEN') &&
    releaseEnvTemplate.includes('APP_STORE_CONNECT_PRIVATE_KEY_PATH=REPLACE_WITH_ABSOLUTE_PATH_TO_ASC_PRIVATE_KEY_P8') &&
    releaseEnvTemplate.includes('APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN=REPLACE_WITH_EXPO_PUSH_TOKEN_FROM_INSTALLED_APP') &&
    releaseEnvTemplate.includes('APP_TELEMETRY_RUNTIME_API_BASE_URL=REPLACE_WITH_RELEASE_API_BASE_URL') &&
    releaseEnvTemplate.includes('DATABASE_URL=REPLACE_WITH_RELEASE_OR_PRODUCTION_POSTGRES_URL') &&
    !releaseEnvTemplate.includes('postgresql://') &&
    !releaseEnvTemplate.includes('ExpoPushToken[') &&
    !releaseEnvTemplate.includes('Bearer '),
  'mobile/release.env.example must be present, default to dry-run-safe values, and contain placeholders instead of raw secrets.'
);
requireValue(
  mobileGitignore.includes('release.env.local') && mobileGitignore.includes('release.env.*.local'),
  'mobile/.gitignore must protect local release env files from accidental commit.'
);
requireValue(
    appReleaseSignoffWorkflow.includes('release:external-evidence:signoff') &&
    appReleaseSignoffWorkflow.includes('release:external-evidence:validate') &&
    appReleaseSignoffWorkflow.includes('release:external-evidence:run') &&
    appReleaseSignoffWorkflow.includes('github_environment:') &&
    appReleaseSignoffWorkflow.includes('environment: ${{ inputs.github_environment }}') &&
    appReleaseSignoffWorkflow.includes('release:evidence-redaction:check') &&
    appReleaseSignoffWorkflow.includes('--evidence-dir="${APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR}"') &&
    appReleaseSignoffWorkflow.includes('release:evidence-sanitization:check') &&
    appReleaseSignoffWorkflow.includes('release:external-evidence:handoff:contract') &&
    appReleaseSignoffWorkflow.includes('steps.evidence_redaction.outcome') &&
    appReleaseSignoffWorkflow.includes('App-External-Evidence-Status-*.json') &&
    appReleaseSignoffWorkflow.includes('App-External-Evidence-Handoff-*.json') &&
    appReleaseSignoffWorkflow.includes('App-External-Signoff-Prerequisites-*.json') &&
    appReleaseSignoffWorkflow.includes('APP_RELEASE_DATABASE_URL') &&
    appReleaseSignoffWorkflow.includes('APP_TELEMETRY_RUNTIME_API_BASE_URL') &&
    appReleaseSignoffWorkflow.includes('APP_NATIVE_CRASH_SENTRY_EVENT_ID'),
  'GitHub workflow must expose App release external signoff, evidence safety gates, and required release secret wiring.'
);
const externalEvidenceDryRunScript = scripts['release:external-evidence:dry-run'] ?? '';
requireValue(
  externalEvidenceDryRunScript.includes('physical-device:smoke -- --dry-run --platform=ios') &&
    externalEvidenceDryRunScript.includes('physical-device:smoke -- --dry-run --platform=android'),
  'release:external-evidence:dry-run must include iOS and Android physical-device dry-runs.'
);
requireValue(
  externalEvidenceDryRunScript.includes('release:db-parity:dry-run'),
  'release:external-evidence:dry-run must include release:db-parity:dry-run.'
);
requireValue(
  externalEvidenceDryRunScript.includes('telemetry:runtime:smoke -- --dry-run'),
  'release:external-evidence:dry-run must include telemetry:runtime:smoke dry-run.'
);
requireValue(Boolean(scripts['android:app:smoke']), 'package.json must expose android:app:smoke.');
requireValue(Boolean(scripts['android:maestro:smoke']), 'package.json must expose android:maestro:smoke.');
requireValue(Boolean(scripts['device-discovery:check']), 'package.json must expose device-discovery:check.');
requireValue(Boolean(scripts['physical-device:smoke']), 'package.json must expose physical-device:smoke.');
requireValue(Boolean(scripts['push-delivery:smoke']), 'package.json must expose push-delivery:smoke.');
requireValue(Boolean(scripts['selected-media:upload:smoke']), 'package.json must expose selected-media:upload:smoke.');
requireValue(Boolean(scripts['native-crash:runtime:smoke']), 'package.json must expose native-crash:runtime:smoke.');
requireValue(Boolean(scripts['telemetry:runtime:smoke']), 'package.json must expose telemetry:runtime:smoke.');
requireValue(Boolean(scripts['eas-ios-release:smoke']), 'package.json must expose eas-ios-release:smoke.');
requireValue(Boolean(scripts['eas-android-release:smoke']), 'package.json must expose eas-android-release:smoke.');
for (const scriptName of requiredPreflightScripts) {
  requireValue(
    scripts['release:preflight']?.includes(scriptName),
    `release:preflight must include ${scriptName}.`
  );
}
requireValue(docsText.includes('release:completion:audit'), 'core docs must mention release:completion:audit.');
requireValue(docsText.includes('release:completion:audit -- --json'), 'core docs must mention release:completion:audit -- --json.');
requireValue(docsText.includes('release:completion:audit:contract'), 'core docs must mention release:completion:audit:contract.');
requireValue(docsText.includes('app-release-completion-audit'), 'core docs must mention app-release-completion-audit.');
requireValue(docsText.includes('release:evidence-redaction:check'), 'core docs must mention release:evidence-redaction:check.');
requireValue(docsText.includes('release:evidence-sanitization:check'), 'core docs must mention release:evidence-sanitization:check.');
requireValue(docsText.includes('routes:check'), 'core docs must mention routes:check.');
requireValue(docsText.includes('features:check'), 'core docs must mention features:check.');
requireValue(docsText.includes('web:routes:smoke'), 'core docs must mention web:routes:smoke.');
requireValue(docsText.includes('release:external-evidence:validate'), 'core docs must mention release:external-evidence:validate.');
requireValue(docsText.includes('normalized blockers'), 'core docs must mention normalized blockers for external evidence status.');
requireValue(docsText.includes('release:external-evidence:handoff:check'), 'core docs must mention release:external-evidence:handoff:check.');
requireValue(docsText.includes('release:external-evidence:handoff:contract'), 'core docs must mention release:external-evidence:handoff:contract.');
requireValue(docsText.includes('App-External-Evidence-Handoff-*.json'), 'core docs must mention the external evidence handoff artifact.');
requireValue(docsText.includes('release:external-evidence:fixtures:check'), 'core docs must mention release:external-evidence:fixtures:check.');
requireValue(docsText.includes('release:external-evidence:prereq-report:check'), 'core docs must mention release:external-evidence:prereq-report:check.');
requireValue(docsText.includes('release:external-evidence:env-template:check'), 'core docs must mention release:external-evidence:env-template:check.');
requireValue(docsText.includes('release:external-evidence:input-status'), 'core docs must mention release:external-evidence:input-status.');
requireValue(docsText.includes('release:external-evidence:github-secrets:check'), 'core docs must mention release:external-evidence:github-secrets:check.');
requireValue(docsText.includes('release:external-evidence:github-secrets:strict'), 'core docs must mention release:external-evidence:github-secrets:strict.');
requireValue(docsText.includes('release:external-evidence:github-secrets:sync'), 'core docs must mention release:external-evidence:github-secrets:sync.');
requireValue(docsText.includes('release:external-evidence:github-secrets:sync:contract'), 'core docs must mention release:external-evidence:github-secrets:sync:contract.');
requireValue(docsText.includes('release:external-evidence:run'), 'core docs must mention release:external-evidence:run.');
requireValue(docsText.includes('telemetry:runtime:smoke'), 'core docs must mention telemetry:runtime:smoke.');
requireValue(docsText.includes('App-Telemetry-Runtime-*.json'), 'core docs must mention App-Telemetry-Runtime-*.json.');

const androidSdkRoot = firstExistingPath([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(os.homedir(), 'Library', 'Android', 'sdk'),
]);
const adbCommand = commandAvailable([androidSdkRoot && path.join(androidSdkRoot, 'platform-tools', 'adb'), 'adb'], ['version']);
const emulatorCommand = commandAvailable([androidSdkRoot && path.join(androidSdkRoot, 'emulator', 'emulator'), 'emulator'], ['-version']);
const sdkmanagerCommand = commandAvailableWithOptions(
  [
    androidSdkRoot && path.join(androidSdkRoot, 'cmdline-tools', 'latest', 'bin', 'sdkmanager'),
    androidSdkRoot && path.join(androidSdkRoot, 'cmdline-tools', 'bin', 'sdkmanager'),
    'sdkmanager',
  ],
  ['--version'],
  { env: buildJavaToolEnv() }
);

const easIosArtifact =
  existingPathFromEnv('APP_EAS_IOS_RELEASE_EVIDENCE_FILE') ||
  existingPathFromEnv('APP_EAS_IOS_BUILD_ARTIFACT') ||
  findEvidenceByPrefix('App-EAS-iOS-Release-', ['.json']);
const easAndroidArtifact =
  existingPathFromEnv('APP_EAS_ANDROID_RELEASE_EVIDENCE_FILE') ||
  existingPathFromEnv('APP_EAS_ANDROID_BUILD_ARTIFACT') ||
  findEvidenceByPrefix('App-EAS-Android-Release-', ['.json']);
const physicalDeviceEvidence =
  existingPathFromEnv('APP_PHYSICAL_DEVICE_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Physical-Device-', ['.json']);
const pushDeliveryEvidence =
  existingPathFromEnv('APP_PUSH_DELIVERY_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Push-Delivery-', ['.json']);
const uploadEvidence =
  existingPathFromEnv('APP_NATIVE_UPLOAD_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Native-Upload-', ['.json', '.md']);
const selectedMediaUploadEvidence =
  existingPathFromEnv('APP_SELECTED_MEDIA_UPLOAD_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Selected-Media-Upload-', ['.json']);
const testflightEvidence =
  existingPathFromEnv('APP_TESTFLIGHT_EVIDENCE_FILE') ||
  existingPathFromEnv('APP_EAS_IOS_RELEASE_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-EAS-iOS-Release-', ['.json']);
const releaseDbEvidence =
  existingPathFromEnv('APP_RELEASE_DB_PARITY_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Release-DB-Parity-', ['.json']);
const iosReleaseSimulatorEvidence =
  existingPathFromEnv('APP_IOS_RELEASE_SIMULATOR_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-iOS-Release-Simulator-', ['.json']);
const androidEmulatorEvidence =
  existingPathFromEnv('APP_ANDROID_EMULATOR_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Android-Emulator-', ['.json', '.md']);
const androidAppEvidence =
  existingPathFromEnv('APP_ANDROID_APP_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Android-App-', ['.json', '.md']);
const androidMaestroEvidence =
  existingPathFromEnv('APP_ANDROID_MAESTRO_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Android-Maestro-', ['.json', '.md']);
const nativeCrashEvidence =
  existingPathFromEnv('APP_NATIVE_CRASH_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Native-Crash-Runtime-', ['.json']);
const telemetryRuntimeEvidence =
  existingPathFromEnv('APP_TELEMETRY_RUNTIME_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Telemetry-Runtime-', ['.json']);
const nativeCrashSdkEvidence =
  existingPathFromEnv('APP_NATIVE_CRASH_SDK_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-Native-Crash-SDK-', ['.json', '.md']);
const otelEvidence =
  existingPathFromEnv('APP_OTEL_EVIDENCE_FILE') ||
  findEvidenceByPrefix('App-OTel-', ['.json', '.md']);

const hasNativeCrashSdk = Boolean(
  dependencyMap['@sentry/react-native'] ||
    dependencyMap['sentry-expo'] ||
    dependencyMap['@bugsnag/react-native'] ||
    dependencyMap['@react-native-firebase/crashlytics']
);
const sentryExpoPluginConfigured = hasPlugin(app.plugins, '@sentry/react-native/expo');
const sentryMetroConfigured = mobileFileIncludes('metro.config.js', [
  '@sentry/react-native/metro',
  'getSentryExpoConfig',
]);
const sentryCrashAdapterConfigured = mobileFileIncludes('src/platform/telemetry/nativeCrash.ts', [
  'enableNativeCrashHandling: true',
  'beforeSend',
  'sendDefaultPii: false',
]);
const sentryAndroidNativeConfigured =
  fs.existsSync(path.join(mobileRoot, 'android/sentry.properties')) &&
  mobileFileIncludes('android/app/build.gradle', ['@sentry/react-native/package.json', 'sentry.gradle']);
const iosProjectName = typeof app.name === 'string' && app.name.trim() ? app.name.trim() : 'Emorapy';
const iosProjectFile = `ios/${iosProjectName}.xcodeproj/project.pbxproj`;
const sentryIosGeneratedProjectPresent =
  fs.existsSync(path.join(mobileRoot, iosProjectFile)) ||
  fs.existsSync(path.join(mobileRoot, 'ios'));
const sentryIosNativePrebuildConfigured =
  fs.existsSync(path.join(mobileRoot, 'ios/sentry.properties')) &&
  mobileFileIncludes(iosProjectFile, [
    'sentry-xcode.sh',
    'sentry-xcode-debug-files.sh',
    'Upload Debug Symbols to Sentry',
  ]);
const sentryIosConfigPluginOrGeneratedOutputConfigured =
  sentryExpoPluginConfigured && (!sentryIosGeneratedProjectPresent || sentryIosNativePrebuildConfigured);
const hasOtelProvider = Object.keys(dependencyMap).some((name) => name.startsWith('@opentelemetry/'));
const hasOtelCollectorBaseline =
  mobileFileIncludes('src/platform/telemetry/client.ts', ['/telemetry/otlp/v1/traces', 'resourceSpans']) &&
  repoFileIncludes('backend/src/routes/app-telemetry.routes.ts', [
    '/telemetry/otlp/v1/traces',
    'appTelemetryOtlpTraceSchema',
  ]) &&
  repoFileIncludes('backend/src/services/app-telemetry.service.ts', ['recordOtlpTraces', 'otlpCollector']);
let androidEmulatorEvidenceBooted = false;
let androidAppEvidenceLaunched = false;
let androidMaestroEvidencePassed = false;
let nativeUploadEvidencePassed = false;
const physicalDeviceEvidencePassed = validatePhysicalDeviceEvidence(physicalDeviceEvidence, app);
const pushDeliveryEvidencePassed = validatePushDeliveryEvidence(pushDeliveryEvidence, app);
const selectedMediaUploadEvidencePassed = validateSelectedMediaUploadEvidence(selectedMediaUploadEvidence);
const releaseDbEvidencePassed = validateReleaseDbEvidence(releaseDbEvidence);
const iosReleaseSimulatorEvidencePassed = validateIosReleaseSimulatorEvidence(iosReleaseSimulatorEvidence, app);
const nativeCrashEvidencePassed = validateNativeCrashRuntimeEvidence(nativeCrashEvidence, app);
const telemetryRuntimeEvidencePassed = validateTelemetryRuntimeEvidence(telemetryRuntimeEvidence, app);
const easIosEvidencePassed = validateEasIosReleaseEvidence(easIosArtifact, app);
const testflightEvidencePassed = validateTestFlightEvidence(testflightEvidence, app);
const easAndroidEvidencePassed = validateEasAndroidReleaseEvidence(easAndroidArtifact, app);

if (androidEmulatorEvidence?.endsWith('.json')) {
  const evidence = readJson(androidEmulatorEvidence);
  if (evidence.app_android_package !== app.android?.package) {
    ignoreStaleEvidence(
      'Android emulator',
      androidEmulatorEvidence,
      `app_android_package=${evidence.app_android_package ?? 'missing'}, expected=${app.android?.package}`
    );
  } else {
    requireValue(
      evidence.type === 'app-android-emulator-runtime-smoke',
      'Android emulator evidence type must be app-android-emulator-runtime-smoke.'
    );
    requireValue(evidence.summary?.booted === true, 'Android emulator evidence must prove booted=true.');
    requireValue(evidence.summary?.blocked === false, 'Android emulator evidence must have blocked=false.');
    requireValue(evidence.device?.boot_completed === '1', 'Android emulator evidence must prove sys.boot_completed=1.');
    androidEmulatorEvidenceBooted = evidence.summary?.booted === true && evidence.summary?.blocked === false;
  }
}

if (androidAppEvidence?.endsWith('.json')) {
  const evidence = readJson(androidAppEvidence);
  if (evidence.app_android_package !== app.android?.package) {
    ignoreStaleEvidence(
      'Android app runtime',
      androidAppEvidence,
      `app_android_package=${evidence.app_android_package ?? 'missing'}, expected=${app.android?.package}`
    );
  } else {
    requireValue(
      evidence.type === 'app-android-apk-install-launch-smoke',
      'Android app evidence type must be app-android-apk-install-launch-smoke.'
    );
    requireValue(evidence.summary?.built === true, 'Android app evidence must prove built=true.');
    requireValue(evidence.summary?.installed === true, 'Android app evidence must prove installed=true.');
    requireValue(evidence.summary?.launched === true, 'Android app evidence must prove launched=true.');
    requireValue(evidence.summary?.blocked === false, 'Android app evidence must have blocked=false.');
    requireValue(Boolean(evidence.apk?.sha256), 'Android app evidence must include apk.sha256.');
    requireValue(Boolean(evidence.launch?.focused_window_confirmed), 'Android app evidence must confirm a focused app window.');
    androidAppEvidenceLaunched = evidence.summary?.launched === true && evidence.summary?.blocked === false;
  }
}

if (androidMaestroEvidence?.endsWith('.json')) {
  const evidence = readJson(androidMaestroEvidence);
  if (evidence.app_android_package !== app.android?.package) {
    ignoreStaleEvidence(
      'Android Maestro',
      androidMaestroEvidence,
      `app_android_package=${evidence.app_android_package ?? 'missing'}, expected=${app.android?.package}`
    );
  } else {
    requireValue(
      evidence.type === 'app-android-maestro-execution',
      'Android Maestro evidence type must be app-android-maestro-execution.'
    );
    requireValue(evidence.summary?.passed_flows === 7, 'Android Maestro evidence must prove 7 passed flows.');
    requireValue(evidence.summary?.failed_flows === 0, 'Android Maestro evidence must have zero failed flows.');
    requireValue(evidence.summary?.blocked === false, 'Android Maestro evidence must not be blocked.');
    requireValue(evidence.static_gate?.status === 'passed', 'Android Maestro evidence must include passed static gate.');
    requireValue(evidence.android_readiness?.status === 'passed', 'Android Maestro evidence must include passed Android readiness gate.');
    requireValue(evidence.app_runtime?.status === 'passed', 'Android Maestro evidence must include passed Android app runtime gate.');
    androidMaestroEvidencePassed =
      evidence.summary?.passed_flows === 7 &&
      evidence.summary?.failed_flows === 0 &&
      evidence.summary?.blocked === false;
  }
}

if (uploadEvidence?.endsWith('.json')) {
  const evidence = readJson(uploadEvidence);
  const staleAndroidUpload =
    evidence.platform === 'android' && evidence.app_android_package !== app.android?.package;
  const staleIosUpload =
    evidence.platform === 'ios' && evidence.app_ios_bundle_identifier !== app.ios?.bundleIdentifier;
  if (staleAndroidUpload || staleIosUpload) {
    ignoreStaleEvidence(
      'Native upload',
      uploadEvidence,
      `ios=${evidence.app_ios_bundle_identifier ?? 'missing'}, android=${evidence.app_android_package ?? 'missing'}, expected=${app.ios?.bundleIdentifier}/${app.android?.package}`
    );
  } else {
    requireValue(
      evidence.type === 'app-native-upload-picker-smoke',
      'Native upload evidence type must be app-native-upload-picker-smoke.'
    );
    requireValue(evidence.platform === 'android' || evidence.platform === 'ios', 'Native upload evidence platform must be android or ios.');
    requireValue(evidence.summary?.static_contract_passed === true, 'Native upload evidence must pass static contract.');
    requireValue(evidence.summary?.platform_boundary_passed === true, 'Native upload evidence must pass platform boundary gate.');
    requireValue(evidence.summary?.upload_unit_passed === true, 'Native upload evidence must pass upload adapter unit gate.');
    requireValue(evidence.summary?.app_runtime_passed === true, 'Native upload evidence must pass native app runtime gate.');
    requireValue(
      evidence.summary?.native_picker_cancel_flow_passed === true,
      'Native upload evidence must pass native picker cancel flow.'
    );
    requireValue(evidence.summary?.blocked === false, 'Native upload evidence must have blocked=false.');
    nativeUploadEvidencePassed = evidence.summary?.blocked === false;
  }
}

addCompletionCheck({
  id: 'eas_project_id',
  done: easProjectId.valid,
  blocker: 'mobile/app.json has no UUID-shaped extra.eas.projectId, so EAS Update URL and Expo push token project binding are not final.',
  docNeedles: ['EAS project id', 'extra.eas.projectId', 'UUID'],
});
addCompletionCheck({
  id: 'expo_token',
  done: hasEnv('EXPO_TOKEN'),
  blocker: 'EXPO_TOKEN is not set; non-interactive EAS build cannot run from this environment.',
  docNeedles: ['EXPO_TOKEN', 'Expo token'],
});
addCompletionCheck({
  id: 'apple_submission_credentials',
  done: hasAppleSubmissionCredentials(),
  blocker: 'Apple submission credentials are incomplete; ASC_APPLE_ID and EXPO_APPLE_APP_SPECIFIC_PASSWORD must both be present.',
  docNeedles: ['Apple credentials', 'Apple submission credentials'],
});
addCompletionCheck({
  id: 'app_store_connect_api_credentials',
  done: hasAppStoreConnectApiCredentials(),
  blocker: 'App Store Connect API credentials are incomplete; issuer id, key id, and private key or private key path must be present for TestFlight evidence.',
  docNeedles: ['App Store Connect API credentials', 'ASC API credentials'],
});
addCompletionCheck({
  id: 'eas_ios_build_artifact',
  done: Boolean(easIosArtifact && easIosEvidencePassed),
  blocker: 'No structured EAS iOS release build evidence was found.',
  docNeedles: ['EAS build artifact', 'EAS/TestFlight build artifact', 'eas-ios-release:smoke'],
  evidence: easIosArtifact
    ? `EAS iOS release evidence: ${path.relative(repoRoot, easIosArtifact)}`
    : undefined,
});
addCompletionCheck({
  id: 'testflight_evidence',
  done: Boolean(testflightEvidence && testflightEvidencePassed),
  blocker: 'No structured TestFlight evidence was found.',
  docNeedles: ['TestFlight', 'eas-ios-release:smoke'],
  evidence: testflightEvidence
    ? `TestFlight evidence: ${path.relative(repoRoot, testflightEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'physical_device_evidence',
  done: Boolean(physicalDeviceEvidence && physicalDeviceEvidencePassed),
  blocker: 'No structured physical device smoke evidence was found.',
  docNeedles: ['physical device', '真機', 'physical-device:smoke'],
  evidence: physicalDeviceEvidence
    ? `physical device evidence: ${path.relative(repoRoot, physicalDeviceEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'android_native_toolchain_evidence',
  done: Boolean(androidSdkRoot && adbCommand && emulatorCommand && sdkmanagerCommand),
  blocker: 'Android SDK root, adb, emulator, or sdkmanager is missing; Android native build/emulator evidence remains blocked.',
  docNeedles: ['Android SDK', 'Android emulator'],
  evidence:
    androidSdkRoot && adbCommand && emulatorCommand && sdkmanagerCommand
      ? `Android native toolchain: sdkRoot=${androidSdkRoot}; adb=${adbCommand}; emulator=${emulatorCommand}; sdkmanager=${sdkmanagerCommand}`
      : undefined,
});
addCompletionCheck({
  id: 'android_emulator_runtime_evidence',
  done: Boolean(androidEmulatorEvidence && androidEmulatorEvidenceBooted),
  blocker: 'No Android emulator runtime smoke evidence was found.',
  docNeedles: ['Android emulator runtime smoke', 'Android emulator boot smoke', 'Android AVD'],
  evidence: androidEmulatorEvidence
    ? `Android emulator runtime evidence: ${path.relative(repoRoot, androidEmulatorEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'android_app_runtime_evidence',
  done: Boolean(androidAppEvidence && androidAppEvidenceLaunched),
  blocker: 'No Android release APK install/launch smoke evidence was found.',
  docNeedles: ['Android release APK install/launch smoke', 'Android app runtime smoke', 'Android APK smoke'],
  evidence: androidAppEvidence
    ? `Android app runtime evidence: ${path.relative(repoRoot, androidAppEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'android_full_flow_evidence',
  done: Boolean(androidMaestroEvidence && androidMaestroEvidencePassed),
  blocker: 'No Android full Maestro flow smoke evidence was found.',
  docNeedles: ['Android full Maestro flow', 'Android full flow smoke', 'Android Maestro smoke'],
  evidence: androidMaestroEvidence
    ? `Android full flow evidence: ${path.relative(repoRoot, androidMaestroEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'ios_release_simulator_evidence',
  done: Boolean(iosReleaseSimulatorEvidence && iosReleaseSimulatorEvidencePassed),
  blocker: 'No structured iOS Release simulator build/install/launch evidence was found.',
  docNeedles: ['iOS Release simulator', 'Release simulator build', 'iOS simulator Release build'],
  evidence: iosReleaseSimulatorEvidence
    ? `iOS Release simulator evidence: ${path.relative(repoRoot, iosReleaseSimulatorEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'eas_android_build_artifact',
  done: Boolean(easAndroidArtifact && easAndroidEvidencePassed),
  blocker: 'No structured EAS Android release build evidence was found.',
  docNeedles: ['EAS Android artifact', 'EAS Android release', 'eas-android-release:smoke'],
  evidence: easAndroidArtifact
    ? `EAS Android release evidence: ${path.relative(repoRoot, easAndroidArtifact)}`
    : undefined,
});
addCompletionCheck({
  id: 'apns_or_provider_delivery_evidence',
  done: Boolean(pushDeliveryEvidence && pushDeliveryEvidencePassed),
  blocker: 'No structured APNs / Expo provider delivery evidence was found.',
  docNeedles: ['APNs', 'provider delivery', 'push-delivery:smoke'],
  evidence: pushDeliveryEvidence
    ? `push provider delivery evidence: ${path.relative(repoRoot, pushDeliveryEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'native_imagepicker_upload_evidence',
  done: Boolean(uploadEvidence && nativeUploadEvidencePassed),
  blocker: 'No native ImagePicker upload evidence was found.',
  docNeedles: ['ImagePicker', 'native upload evidence'],
  evidence: uploadEvidence
    ? `native ImagePicker upload evidence: ${path.relative(repoRoot, uploadEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'selected_media_backend_upload_evidence',
  done: Boolean(selectedMediaUploadEvidence && selectedMediaUploadEvidencePassed),
  blocker: 'No selected-media backend upload/delete evidence was found.',
  docNeedles: ['selected-media backend upload', 'selected-media ImagePicker upload'],
  evidence: selectedMediaUploadEvidence
    ? `selected-media backend upload evidence: ${path.relative(repoRoot, selectedMediaUploadEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'native_crash_sdk_configuration',
  done: Boolean(
    hasNativeCrashSdk &&
      nativeCrashSdkEvidence &&
      sentryExpoPluginConfigured &&
      sentryMetroConfigured &&
      sentryCrashAdapterConfigured &&
      sentryAndroidNativeConfigured
  ),
  blocker: hasNativeCrashSdk
    ? 'Native crash SDK dependency exists, but JS/Expo/Android native crash SDK configuration evidence is incomplete.'
    : 'No native crash SDK dependency plus configuration evidence was found.',
  docNeedles: ['native crash SDK', 'native crash SDK configuration'],
  evidence: nativeCrashSdkEvidence
    ? `native crash SDK configuration evidence: ${path.relative(repoRoot, nativeCrashSdkEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'sentry_ios_native_prebuild_configuration',
  done: Boolean(!hasNativeCrashSdk || sentryIosConfigPluginOrGeneratedOutputConfigured),
  blocker:
    'Sentry React Native is configured, but iOS has neither the Expo config plugin source of truth nor valid generated Sentry prebuild output.',
  docNeedles: ['Sentry native configuration', 'prebuilt iOS project'],
  evidence: sentryIosNativePrebuildConfigured
    ? 'Sentry iOS native prebuild configuration is present in mobile/ios.'
    : sentryExpoPluginConfigured
      ? 'Sentry iOS config plugin is present; mobile/ios is generated and ignored, so generated prebuild output is verified only when present.'
    : undefined,
});
addCompletionCheck({
  id: 'native_crash_runtime_evidence',
  done: Boolean(hasNativeCrashSdk && nativeCrashEvidence && nativeCrashEvidencePassed),
  blocker: hasNativeCrashSdk
    ? 'Native crash SDK is configured, but no structured production environment native crash runtime evidence was found.'
    : 'No native crash SDK dependency plus production environment native crash runtime evidence was found.',
  docNeedles: ['production environment native crash runtime evidence', 'release / production environment match'],
  evidence: nativeCrashEvidence
    ? `native crash runtime evidence: ${path.relative(repoRoot, nativeCrashEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'otel_provider_evidence',
  done: Boolean(hasOtelProvider && otelEvidence),
  blocker: 'No true OpenTelemetry provider dependency plus evidence was found.',
  docNeedles: ['OTel', 'OpenTelemetry'],
  evidence: otelEvidence ? `OpenTelemetry provider evidence: ${path.relative(repoRoot, otelEvidence)}` : undefined,
});
addCompletionCheck({
  id: 'otel_collector_baseline',
  done: Boolean(hasOtelCollectorBaseline),
  blocker: 'No Emorapy OTLP JSON trace ingest baseline was found.',
  docNeedles: ['OTLP collector', '/telemetry/otlp/v1/traces'],
  evidence: hasOtelCollectorBaseline
    ? 'Emorapy OTLP JSON trace ingest baseline is wired from mobile exporter to backend safe telemetry persistence.'
    : undefined,
});
addCompletionCheck({
  id: 'telemetry_runtime_evidence',
  done: Boolean(telemetryRuntimeEvidence && telemetryRuntimeEvidencePassed),
  blocker: 'No structured App telemetry runtime ingest evidence was found.',
  docNeedles: ['telemetry runtime evidence', 'telemetry:runtime:smoke', 'App-Telemetry-Runtime-*.json'],
  evidence: telemetryRuntimeEvidence
    ? `telemetry runtime evidence: ${path.relative(repoRoot, telemetryRuntimeEvidence)}`
    : undefined,
});
addCompletionCheck({
  id: 'release_production_db_parity',
  done: Boolean(releaseDbEvidence && releaseDbEvidencePassed),
  blocker: 'No release/production DB parity evidence file was found.',
  docNeedles: ['release-production DB parity', 'release DB parity', 'production DB parity'],
  evidence: releaseDbEvidence
    ? `release DB parity evidence: ${path.relative(repoRoot, releaseDbEvidence)}`
    : undefined,
});

if (!easIosArtifact) warnings.push('Set APP_EAS_IOS_RELEASE_EVIDENCE_FILE or add App-EAS-iOS-Release-* evidence once an EAS iOS production build exists.');
if (!testflightEvidence) warnings.push('Set APP_TESTFLIGHT_EVIDENCE_FILE or add App-EAS-iOS-Release-* evidence after TestFlight App Store Connect verification.');
if (!easAndroidArtifact) warnings.push('Set APP_EAS_ANDROID_RELEASE_EVIDENCE_FILE or add App-EAS-Android-Release-* evidence once an EAS Android production build exists.');
if (!physicalDeviceEvidence) warnings.push('Set APP_PHYSICAL_DEVICE_EVIDENCE_FILE or add App-Physical-Device-* evidence after device smoke.');
if (!pushDeliveryEvidence) warnings.push('Set APP_PUSH_DELIVERY_EVIDENCE_FILE or add App-Push-Delivery-* evidence after provider delivery smoke.');
if (!iosReleaseSimulatorEvidence) warnings.push('Set APP_IOS_RELEASE_SIMULATOR_EVIDENCE_FILE or add App-iOS-Release-Simulator-* evidence after local iOS Release simulator build/install/launch.');
if (!selectedMediaUploadEvidence) warnings.push('Run selected-media:upload:smoke against local API + local DB and add App-Selected-Media-Upload-* evidence.');
if (!nativeCrashEvidence) warnings.push('Set APP_NATIVE_CRASH_EVIDENCE_FILE or add App-Native-Crash-Runtime-* evidence after production environment native crash runtime smoke.');
if (!telemetryRuntimeEvidence) warnings.push('Set APP_TELEMETRY_RUNTIME_EVIDENCE_FILE or add App-Telemetry-Runtime-* evidence after telemetry runtime smoke.');
if (!releaseDbEvidence) warnings.push('Set APP_RELEASE_DB_PARITY_EVIDENCE_FILE or add App-Release-DB-Parity-* evidence after target DB verification.');

function buildAuditRecord() {
  const passed = completionChecks.filter((entry) => entry.status === 'passed').length;
  const blockedChecks = completionChecks.filter((entry) => entry.status === 'blocked');
  const blocked = blockedChecks.length;
  const complete = failures.length === 0 && blocked === 0;
  const handoffBlockerIds = [
    ...new Set(blockedChecks.flatMap((entry) => entry.handoff_blocker_ids ?? [])),
  ];

  return {
    type: 'app-release-completion-audit',
    generated_at: new Date().toISOString(),
    strict,
    complete,
    summary: {
      passed,
      blocked,
      failures: failures.length,
      warnings: warnings.length,
      verified: verified.length,
    },
    checks: completionChecks,
    blocker_ids: blockedChecks.map((entry) => entry.id),
    handoff_blocker_ids: handoffBlockerIds,
    verified,
    warnings,
    blockers,
    failures,
  };
}

if (json) {
  const audit = buildAuditRecord();
  console.log(JSON.stringify(audit, null, 2));
  if (audit.failures.length > 0 || (strict && !audit.complete)) {
    process.exit(1);
  }
  process.exit(0);
}

if (failures.length > 0) {
  console.error(`[release-completion-audit] failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const auditLog = (message) => {
  if (strict && blockers.length > 0) {
    console.error(message);
  } else {
    console.log(message);
  }
};

if (verified.length > 0) {
  auditLog('[release-completion-audit] verified:');
  verified.forEach((item) => auditLog(`- ${item}`));
}

if (warnings.length > 0) {
  auditLog('[release-completion-audit] evidence hints:');
  warnings.forEach((warning) => auditLog(`- ${warning}`));
}

if (blockers.length > 0) {
  auditLog('[release-completion-audit] release completion blockers:');
  blockers.forEach((blocker) => auditLog(`- ${blocker}`));
  auditLog(
    `[release-completion-audit] ${strict ? 'failed' : 'not complete'}: App release sign-off still requires external credentials, artifacts, or device/provider evidence.`
  );
  if (strict) process.exit(1);
} else {
  auditLog('[release-completion-audit] ok: App release completion evidence is present.');
}

auditLog('[release-completion-audit] ok: blockers are explicit and core docs are aligned.');
