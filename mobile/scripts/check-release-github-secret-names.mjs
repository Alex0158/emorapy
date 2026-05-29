import { execFileSync } from 'node:child_process';
import process from 'node:process';

const json = process.argv.includes('--json');
const strict = process.argv.includes('--strict');
const repoArg = process.argv.find((arg) => arg.startsWith('--repo='));
const environmentArgs = process.argv
  .filter((arg) => arg.startsWith('--env='))
  .map((arg) => arg.slice('--env='.length))
  .filter(Boolean);
const repo = repoArg?.slice('--repo='.length) || 'Alex0158/mother-bear-court';
const defaultWorkflowEnvironment = 'Production';

const currentCompletionRepoSecrets = [
  'EXPO_TOKEN',
  'ASC_APPLE_ID',
  'EXPO_APPLE_APP_SPECIFIC_PASSWORD',
  'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN',
  'APP_SENTRY_ORG',
  'APP_SENTRY_PROJECT',
  'APP_SENTRY_AUTH_TOKEN',
  'APP_NATIVE_CRASH_SENTRY_EVENT_ID',
];

const evidenceRefreshRepoSecrets = [
  'APP_TELEMETRY_RUNTIME_API_BASE_URL',
  'APP_RELEASE_DATABASE_URL',
];

const requiredRepoSecrets = [...currentCompletionRepoSecrets, ...evidenceRefreshRepoSecrets];

const requiredTestFlightSecrets = [
  'APP_STORE_CONNECT_ISSUER_ID',
  'APP_STORE_CONNECT_KEY_ID',
  'APP_STORE_CONNECT_PRIVATE_KEY',
];

const requiredIosDeviceSecrets = ['APP_IOS_DEVICE_UDID', 'APP_IOS_DEVICE_APP_PATH'];
const requiredAndroidDeviceSecrets = ['APP_ANDROID_DEVICE_SERIAL'];

function runGh(args) {
  try {
    return {
      ok: true,
      stdout: execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString() || '',
      error: error.stderr?.toString().trim() || error.message,
    };
  }
}

function parseListOutput(output) {
  return new Set(
    output
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean)
  );
}

function listRepoSecrets() {
  const result = runGh(['secret', 'list', '--repo', repo]);
  return {
    ok: result.ok,
    error: result.error,
    names: result.ok ? parseListOutput(result.stdout) : new Set(),
  };
}

function listEnvironmentNames() {
  const result = runGh([
    'api',
    `repos/${repo}/environments`,
    '--jq',
    '.environments[]?.name',
  ]);
  return {
    ok: result.ok,
    error: result.error,
    names: result.ok
      ? result.stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : [],
  };
}

function listEnvironmentSecrets(environment) {
  const encodedEnvironment = encodeURIComponent(environment);
  const result = runGh([
    'api',
    `repos/${repo}/environments/${encodedEnvironment}/secrets`,
    '--jq',
    '.secrets[]?.name',
  ]);
  return {
    environment,
    ok: result.ok,
    error: result.error,
    names: result.ok
      ? new Set(
          result.stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        )
      : new Set(),
  };
}

function toSortedArray(set) {
  return [...set].sort();
}

function summarizeSecretNames(names, presentNames) {
  const missing = names.filter((name) => !presentNames.has(name));
  return {
    required_secret_name_count: names.length,
    present_secret_name_count: names.length - missing.length,
    missing_secret_name_count: missing.length,
    required_secret_names: names,
    missing_secret_names: missing,
  };
}

const repoSecrets = listRepoSecrets();
const environmentNameLookup = environmentArgs.length ? null : listEnvironmentNames();
const environmentNames = environmentArgs.length ? environmentArgs : [defaultWorkflowEnvironment];
const environmentSecretResults = environmentNames.map(listEnvironmentSecrets);

const allSecretNames = new Set(repoSecrets.names);
for (const result of environmentSecretResults) {
  for (const name of result.names) allSecretNames.add(name);
}

const requiredSecretNames = [
  ...requiredRepoSecrets,
  ...requiredTestFlightSecrets,
  ...requiredIosDeviceSecrets,
  ...requiredAndroidDeviceSecrets,
];
const missingSecretNames = requiredSecretNames.filter((name) => !allSecretNames.has(name));
const currentCompletionSecretNames = [
  ...currentCompletionRepoSecrets,
  ...requiredTestFlightSecrets,
  ...requiredIosDeviceSecrets,
  ...requiredAndroidDeviceSecrets,
];
const evidenceRefreshSecretNames = evidenceRefreshRepoSecrets;
const currentCompletionSecretStatus = summarizeSecretNames(currentCompletionSecretNames, allSecretNames);
const evidenceRefreshSecretStatus = summarizeSecretNames(evidenceRefreshSecretNames, allSecretNames);
const failedEnvironmentChecks = environmentSecretResults.filter((result) => !result.ok);
const missingConfiguredEnvironments =
  environmentNameLookup?.ok === true
    ? environmentNames.filter((environment) => !environmentNameLookup.names.includes(environment))
    : [];
const blocked =
  !repoSecrets.ok ||
  failedEnvironmentChecks.length > 0 ||
  (environmentNameLookup && !environmentNameLookup.ok) ||
  missingConfiguredEnvironments.length > 0;

const status = {
  type: 'app-release-github-secret-name-status',
  generated_at: new Date().toISOString(),
  repo,
  values_redacted: true,
  repo_secret_name_check: {
    ok: repoSecrets.ok,
    error: repoSecrets.error,
    present_names: toSortedArray(repoSecrets.names),
  },
  workflow_environment_scope: {
    default_environment: defaultWorkflowEnvironment,
    requested_environments: environmentNames,
    all_environment_name_lookup_ok: environmentNameLookup ? environmentNameLookup.ok : null,
    all_environment_name_lookup_error: environmentNameLookup ? environmentNameLookup.error : null,
    configured_environment_names: environmentNameLookup ? environmentNameLookup.names : null,
    missing_configured_environments: missingConfiguredEnvironments,
  },
  environment_secret_name_checks: environmentSecretResults.map((result) => ({
    environment: result.environment,
    ok: result.ok,
    error: result.error,
    present_names: toSortedArray(result.names),
  })),
  summary: {
    required_secret_name_count: requiredSecretNames.length,
    present_secret_name_count: requiredSecretNames.length - missingSecretNames.length,
    missing_secret_name_count: missingSecretNames.length,
    current_completion_required_secret_name_count: currentCompletionSecretStatus.required_secret_name_count,
    current_completion_present_secret_name_count: currentCompletionSecretStatus.present_secret_name_count,
    current_completion_missing_secret_name_count: currentCompletionSecretStatus.missing_secret_name_count,
    evidence_refresh_required_secret_name_count: evidenceRefreshSecretStatus.required_secret_name_count,
    evidence_refresh_present_secret_name_count: evidenceRefreshSecretStatus.present_secret_name_count,
    evidence_refresh_missing_secret_name_count: evidenceRefreshSecretStatus.missing_secret_name_count,
    environment_count: environmentSecretResults.length,
    missing_configured_environment_count: missingConfiguredEnvironments.length,
    blocked,
    strict,
    ready_for_current_completion_workflow_inputs:
      !blocked && currentCompletionSecretStatus.missing_secret_name_count === 0,
    ready_for_evidence_refresh_workflow_inputs: !blocked && evidenceRefreshSecretStatus.missing_secret_name_count === 0,
    ready_for_workflow_validate: !blocked && missingSecretNames.length === 0,
  },
  required_secret_names: requiredSecretNames,
  missing_secret_names: missingSecretNames,
  secret_groups: {
    current_completion_blocker_secret_names: {
      description:
        'GitHub secret names still required for current App release completion blockers, excluding mobile/app.json extra.eas.projectId.',
      ...currentCompletionSecretStatus,
    },
    evidence_refresh_secret_names: {
      description:
        'GitHub secret names for telemetry runtime and release DB parity evidence refreshes.',
      ...evidenceRefreshSecretStatus,
    },
  },
};

if (json) {
  console.log(JSON.stringify(status, null, 2));
} else {
  console.log(`[release-github-secret-names] repo=${repo} values_redacted=true`);
  if (!repoSecrets.ok) console.log(`[release-github-secret-names] repo_secret_check_error=${repoSecrets.error}`);
  if (environmentNameLookup && !environmentNameLookup.ok) {
    console.log(`[release-github-secret-names] environment_name_lookup_error=${environmentNameLookup.error}`);
  }
  if (missingConfiguredEnvironments.length) {
    console.log(
      `[release-github-secret-names] missing_configured_environments=${missingConfiguredEnvironments.join(',')}`
    );
  }
  for (const result of failedEnvironmentChecks) {
    console.log(`[release-github-secret-names] environment_secret_check_error ${result.environment}: ${result.error}`);
  }
  console.log(
    `[release-github-secret-names] present=${status.summary.present_secret_name_count}/${status.summary.required_secret_name_count} missing=${status.summary.missing_secret_name_count} environments=${status.summary.environment_count} ready_for_workflow_validate=${status.summary.ready_for_workflow_validate}`
  );
  console.log(
    `[release-github-secret-names] current_completion_secrets present=${status.summary.current_completion_present_secret_name_count}/${status.summary.current_completion_required_secret_name_count} missing=${status.summary.current_completion_missing_secret_name_count} ready=${status.summary.ready_for_current_completion_workflow_inputs}`
  );
  console.log(
    `[release-github-secret-names] evidence_refresh_secrets present=${status.summary.evidence_refresh_present_secret_name_count}/${status.summary.evidence_refresh_required_secret_name_count} missing=${status.summary.evidence_refresh_missing_secret_name_count} ready=${status.summary.ready_for_evidence_refresh_workflow_inputs}`
  );
  if (missingSecretNames.length) {
    console.log(`[release-github-secret-names] missing_secret_names=${missingSecretNames.join(',')}`);
  }
}

if (blocked) process.exitCode = 1;
if (strict && missingSecretNames.length > 0) process.exitCode = 1;
