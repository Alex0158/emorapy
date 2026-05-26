import fs from 'node:fs';
import path from 'node:path';

export function valueAtPath(value, pathExpression) {
  return pathExpression.split('.').reduce((current, key) => current?.[key], value);
}

export function validateEvidenceAgainstPolicy(evidence, policy) {
  const errors = [];
  if (policy.expectedType && evidence.type !== policy.expectedType) {
    errors.push(`type must be ${policy.expectedType}`);
  }
  for (const check of policy.required ?? []) {
    const actual = valueAtPath(evidence, check.path);
    if (actual !== check.equals) {
      errors.push(`${check.path} must be ${JSON.stringify(check.equals)}`);
    }
  }
  for (const check of policy.oneOf ?? []) {
    const actual = valueAtPath(evidence, check.path);
    if (!check.values.includes(actual)) {
      errors.push(`${check.path} must be one of ${check.values.map((value) => JSON.stringify(value)).join(', ')}`);
    }
  }
  for (const check of policy.numberAtLeast ?? []) {
    const actual = valueAtPath(evidence, check.path);
    if (!Number.isFinite(actual) || actual < check.min) {
      errors.push(`${check.path} must be at least ${check.min}`);
    }
  }
  for (const check of policy.sameValue ?? []) {
    const actual = valueAtPath(evidence, check.path);
    const expected = valueAtPath(evidence, check.equalsPath);
    if (actual !== expected) {
      errors.push(`${check.path} must match ${check.equalsPath}`);
    }
  }
  for (const check of policy.requiredEmptyArrays ?? []) {
    const actual = valueAtPath(evidence, check);
    if (!Array.isArray(actual) || actual.length !== 0) {
      errors.push(`${check} must be an empty array`);
    }
  }
  for (const check of policy.requiredTruthy ?? []) {
    if (!valueAtPath(evidence, check)) {
      errors.push(`${check} must be present`);
    }
  }
  return errors;
}

export function buildReleaseEvidencePolicies(app) {
  return {
    eas_ios_release: {
      expectedType: 'app-eas-ios-release-evidence',
      required: [
        { path: 'app_ios_bundle_identifier', equals: app.ios?.bundleIdentifier },
        { path: 'app_version', equals: app.version },
        { path: 'app_build_number', equals: app.ios?.buildNumber },
        { path: 'summary.run_mode', equals: 'run' },
        { path: 'summary.eas_query_passed', equals: true },
        { path: 'summary.build_found', equals: true },
        { path: 'summary.platform_ios', equals: true },
        { path: 'summary.status_finished', equals: true },
        { path: 'summary.distribution_store', equals: true },
        { path: 'summary.profile_production', equals: true },
        { path: 'summary.app_identifier_matches', equals: true },
        { path: 'summary.app_version_matches', equals: true },
        { path: 'summary.build_number_matches', equals: true },
        { path: 'summary.artifact_url_present', equals: true },
        { path: 'summary.artifact_head_passed', equals: true },
        { path: 'summary.blocked', equals: false },
      ],
      requiredTruthy: ['eas_build.id_sha256', 'eas_build.artifact.url_sha256'],
    },
    testflight: {
      expectedType: 'app-eas-ios-release-evidence',
      required: [
        { path: 'app_ios_bundle_identifier', equals: app.ios?.bundleIdentifier },
        { path: 'app_version', equals: app.version },
        { path: 'app_build_number', equals: app.ios?.buildNumber },
        { path: 'summary.run_mode', equals: 'run' },
        { path: 'summary.testflight_query_required', equals: true },
        { path: 'summary.testflight_query_passed', equals: true },
        { path: 'summary.testflight_build_found', equals: true },
        { path: 'summary.testflight_version_matches', equals: true },
        { path: 'summary.testflight_build_number_matches', equals: true },
        { path: 'summary.testflight_processing_valid', equals: true },
        { path: 'summary.testflight_not_expired', equals: true },
        { path: 'summary.blocked', equals: false },
      ],
      requiredTruthy: ['testflight.build_id_sha256'],
    },
    eas_android_release: {
      expectedType: 'app-eas-android-release-evidence',
      required: [
        { path: 'app_android_package', equals: app.android?.package },
        { path: 'app_version', equals: app.version },
        { path: 'app_version_code', equals: String(app.android?.versionCode) },
        { path: 'summary.run_mode', equals: 'run' },
        { path: 'summary.eas_query_passed', equals: true },
        { path: 'summary.build_found', equals: true },
        { path: 'summary.platform_android', equals: true },
        { path: 'summary.status_finished', equals: true },
        { path: 'summary.distribution_store', equals: true },
        { path: 'summary.profile_production', equals: true },
        { path: 'summary.app_identifier_matches', equals: true },
        { path: 'summary.app_version_matches', equals: true },
        { path: 'summary.version_code_matches', equals: true },
        { path: 'summary.artifact_url_present', equals: true },
        { path: 'summary.artifact_head_passed', equals: true },
        { path: 'summary.blocked', equals: false },
      ],
      requiredTruthy: ['eas_build.id_sha256', 'eas_build.artifact.url_sha256'],
    },
    physical_device: {
      expectedType: 'app-physical-device-smoke',
      required: [
        { path: 'app_android_package', equals: app.android?.package },
        { path: 'app_ios_bundle_identifier', equals: app.ios?.bundleIdentifier },
        { path: 'device.is_physical', equals: true },
        { path: 'summary.device_connected', equals: true },
        { path: 'summary.device_is_physical', equals: true },
        { path: 'summary.static_gate_passed', equals: true },
        { path: 'summary.platform_readiness_passed', equals: true },
        { path: 'summary.app_runtime_passed', equals: true },
        { path: 'summary.maestro_smoke_passed', equals: true },
        { path: 'summary.blocked', equals: false },
      ],
      oneOf: [
        { path: 'platform', values: ['ios', 'android'] },
      ],
      requiredTruthy: ['device.identifier_sha256'],
    },
    push_delivery: {
      expectedType: 'app-push-provider-delivery-smoke',
      required: [
        { path: 'provider', equals: 'expo' },
        { path: 'app_android_package', equals: app.android?.package },
        { path: 'app_ios_bundle_identifier', equals: app.ios?.bundleIdentifier },
        { path: 'push_token.redacted', equals: true },
        { path: 'payload.source_path', equals: '/notifications' },
        { path: 'summary.run_mode', equals: 'run' },
        { path: 'summary.provider_send_passed', equals: true },
        { path: 'summary.ticket_accepted', equals: true },
        { path: 'summary.receipt_checked', equals: true },
        { path: 'summary.receipt_ok', equals: true },
        { path: 'summary.blocked', equals: false },
      ],
      requiredTruthy: ['push_token.sha256'],
    },
    native_crash_runtime: {
      expectedType: 'app-native-crash-runtime-evidence',
      required: [
        { path: 'provider', equals: 'sentry' },
        { path: 'app_android_package', equals: app.android?.package },
        { path: 'app_ios_bundle_identifier', equals: app.ios?.bundleIdentifier },
        { path: 'summary.run_mode', equals: 'run' },
        { path: 'summary.provider_query_passed', equals: true },
        { path: 'summary.event_found', equals: true },
        { path: 'summary.release_matches', equals: true },
        { path: 'summary.environment_matches', equals: true },
        { path: 'summary.native_runtime_observed', equals: true },
        { path: 'summary.crash_event_observed', equals: true },
        { path: 'summary.blocked', equals: false },
      ],
      requiredTruthy: ['sentry.event_id_sha256'],
    },
    telemetry_runtime: {
      expectedType: 'app-telemetry-runtime-evidence',
      required: [
        { path: 'provider', equals: 'backend' },
        { path: 'app_android_package', equals: app.android?.package },
        { path: 'app_ios_bundle_identifier', equals: app.ios?.bundleIdentifier },
        { path: 'app_version', equals: app.version },
        { path: 'app_build_number', equals: app.ios?.buildNumber },
        { path: 'app_version_code', equals: String(app.android?.versionCode) },
        { path: 'api.non_local', equals: true },
        { path: 'api.raw_url_redacted', equals: true },
        { path: 'summary.run_mode', equals: 'run' },
        { path: 'summary.api_non_local', equals: true },
        { path: 'summary.event_ingest_passed', equals: true },
        { path: 'summary.otlp_ingest_passed', equals: true },
        { path: 'summary.safe_payload', equals: true },
        { path: 'summary.blocked', equals: false },
      ],
      numberAtLeast: [
        { path: 'summary.event_accepted_count', min: 1 },
        { path: 'summary.otlp_accepted_spans', min: 1 },
      ],
      requiredTruthy: [
        'api.host_sha256',
        'request.request_id_sha256',
        'request.session_id_sha256',
        'event.request_id_sha256',
        'otlp.trace_id_sha256',
        'otlp.span_id_sha256',
      ],
    },
    release_db_parity: {
      expectedType: 'app-release-db-parity-evidence',
      required: [
        { path: 'check', equals: 'release-db-parity' },
        { path: 'ok', equals: true },
        { path: 'report.check', equals: 'release-db-parity' },
        { path: 'report.ok', equals: true },
        { path: 'target.database.local', equals: false },
      ],
      oneOf: [
        { path: 'target.classification', values: ['release', 'production'] },
        { path: 'target.database.provider', values: ['postgresql', 'postgres'] },
      ],
      numberAtLeast: [
        { path: 'report.requiredMigrationCount', min: 14 },
        { path: 'report.appliedRequiredMigrationCount', min: 14 },
      ],
      sameValue: [
        { path: 'report.appliedRequiredMigrationCount', equalsPath: 'report.requiredMigrationCount' },
      ],
      requiredEmptyArrays: [
        'report.missingRequiredMigrations',
        'report.incompleteRequiredMigrations',
        'report.failedMigrations',
      ],
      requiredTruthy: ['report.requiredMigrationCount', 'report.appliedRequiredMigrationCount'],
    },
  };
}

export function summarizeEvidenceCandidate(filePath, policy, repoRoot) {
  if (!filePath) {
    return {
      state: 'missing',
      file: null,
      evidence_type: null,
      blocked: null,
      run_mode: null,
      validation_errors: [],
    };
  }

  const relativePath = path.relative(repoRoot, filePath);
  try {
    const evidence = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const blocked = evidence.summary?.blocked;
    const validationErrors = validateEvidenceAgainstPolicy(evidence, policy);
    const state = blocked === true
        ? 'blocked_candidate'
        : validationErrors.length === 0
          ? 'candidate_pass'
          : 'invalid_candidate';
    return {
      state,
      file: relativePath,
      evidence_type: typeof evidence.type === 'string' ? evidence.type : null,
      blocked: typeof blocked === 'boolean' ? blocked : null,
      run_mode: evidence.summary?.run_mode ?? null,
      validation_errors: validationErrors,
    };
  } catch (error) {
    return {
      state: 'unreadable_candidate',
      file: relativePath,
      evidence_type: null,
      blocked: null,
      run_mode: null,
      validation_errors: ['candidate JSON must be readable'],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
