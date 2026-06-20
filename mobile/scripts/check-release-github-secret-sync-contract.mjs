import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const syncScript = path.join(scriptDir, 'sync-release-github-secrets.mjs');

const controlledValues = [
  'CONTROLLED_EXPO_TOKEN_DO_NOT_LEAK',
  'controlled-owner@example.invalid',
  'CONTROLLED_APP_SPECIFIC_PASSWORD_DO_NOT_LEAK',
  'ExpoPushToken[CONTROLLED_PUSH_TOKEN_DO_NOT_LEAK]',
  'controlled-sentry-org',
  'controlled-sentry-project',
  'CONTROLLED_SENTRY_AUTH_TOKEN_DO_NOT_LEAK',
  'CONTROLLED_SENTRY_EVENT_ID_DO_NOT_LEAK',
  'https://telemetry-runtime-secret.example.invalid/api/v1',
  'postgresql://secret_user:secret_password@release-db.example.invalid:5432/emorapy',
  'CONTROLLED_ASC_ISSUER_ID_DO_NOT_LEAK',
  'CONTROLLED_ASC_KEY_ID_DO_NOT_LEAK',
  'CONTROLLED_IOS_DEVICE_UDID_DO_NOT_LEAK',
  '/tmp/controlled-signed-app-path-do-not-leak/Emorapy.app',
  'CONTROLLED_ANDROID_SERIAL_DO_NOT_LEAK',
  'CONTROLLED_ASC_PRIVATE_KEY_PATH_DO_NOT_LEAK',
  'CONTROLLED_ASC_PRIVATE_KEY_BODY_DO_NOT_LEAK',
];

function fail(message) {
  console.error(`[release-github-secret-sync-contract] ${message}`);
  process.exit(1);
}

function relative(filePath) {
  return path.relative(repoRoot, filePath);
}

function runSync(args, env = {}) {
  return spawnSync(process.execPath, [syncScript, ...args], {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      PATH: '',
      ...env,
    },
  });
}

function parseJson(label, result) {
  if (!result.stdout.trim()) {
    fail(`${label} produced empty stdout; stderr=${result.stderr.trim()}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`${label} did not produce JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertNoControlledLeaks(label, text) {
  for (const value of controlledValues) {
    if (text.includes(value)) {
      fail(`${label} leaked controlled value: ${value}`);
    }
  }
}

function writeEnvFile(filePath, entries) {
  const lines = [];
  for (const [key, value] of entries) {
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function buildFullEnvEntries(privateKeyPath) {
  return [
    ['EXPO_TOKEN', controlledValues[0]],
    ['ASC_APPLE_ID', controlledValues[1]],
    ['EXPO_APPLE_APP_SPECIFIC_PASSWORD', controlledValues[2]],
    ['APP_STORE_CONNECT_ISSUER_ID', controlledValues[10]],
    ['APP_STORE_CONNECT_KEY_ID', controlledValues[11]],
    ['APP_STORE_CONNECT_PRIVATE_KEY_PATH', privateKeyPath],
    ['APP_IOS_DEVICE_UDID', controlledValues[12]],
    ['APP_IOS_DEVICE_APP_PATH', controlledValues[13]],
    ['APP_ANDROID_DEVICE_SERIAL', controlledValues[14]],
    ['APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN', controlledValues[3]],
    ['APP_SENTRY_ORG', controlledValues[4]],
    ['APP_SENTRY_PROJECT', controlledValues[5]],
    ['APP_SENTRY_AUTH_TOKEN', controlledValues[6]],
    ['APP_NATIVE_CRASH_SENTRY_EVENT_ID', controlledValues[7]],
    ['APP_TELEMETRY_RUNTIME_API_BASE_URL', controlledValues[8]],
    ['DATABASE_URL', controlledValues[9]],
  ];
}

function buildPartialEnvEntries() {
  return [
    ['EXPO_TOKEN', 'REPLACE_WITH_EXPO_ACCESS_TOKEN'],
    ['ASC_APPLE_ID', 'REPLACE_WITH_ASC_APPLE_ID'],
    ['EXPO_APPLE_APP_SPECIFIC_PASSWORD', 'REPLACE_WITH_APP_SPECIFIC_PASSWORD'],
    ['APP_STORE_CONNECT_ISSUER_ID', 'REPLACE_WITH_ASC_ISSUER_ID'],
    ['APP_STORE_CONNECT_KEY_ID', 'REPLACE_WITH_ASC_KEY_ID'],
    ['APP_STORE_CONNECT_PRIVATE_KEY_PATH', 'REPLACE_WITH_ABSOLUTE_PATH_TO_ASC_PRIVATE_KEY_P8'],
    ['APP_IOS_DEVICE_UDID', 'REPLACE_WITH_TRUSTED_IOS_DEVICE_UDID'],
    ['APP_IOS_DEVICE_APP_PATH', 'REPLACE_WITH_SIGNED_IOS_APP_PATH'],
    ['APP_ANDROID_DEVICE_SERIAL', 'REPLACE_WITH_TRUSTED_ANDROID_DEVICE_SERIAL'],
    ['APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN', 'REPLACE_WITH_EXPO_PUSH_TOKEN_FROM_INSTALLED_APP'],
    ['APP_SENTRY_ORG', 'REPLACE_WITH_SENTRY_ORG'],
    ['APP_SENTRY_PROJECT', 'REPLACE_WITH_SENTRY_PROJECT'],
    ['APP_SENTRY_AUTH_TOKEN', 'REPLACE_WITH_SENTRY_AUTH_TOKEN'],
    ['APP_NATIVE_CRASH_SENTRY_EVENT_ID', 'REPLACE_WITH_CONTROLLED_NATIVE_CRASH_EVENT_ID'],
    ['APP_TELEMETRY_RUNTIME_API_BASE_URL', controlledValues[8]],
    ['DATABASE_URL', controlledValues[9]],
  ];
}

function assertFullDryRun(status) {
  if (status.type !== 'app-release-github-secret-sync-status') fail('full dry-run type mismatch.');
  if (status.ok !== true) fail('full dry-run must be ok=true.');
  if (status.apply !== false) fail('full dry-run must have apply=false.');
  if (status.repo !== 'Alex0158/emorapy-controlled') {
    fail('full dry-run must resolve repo from EMORAPY_GITHUB_REPO when --repo is not passed.');
  }
  if (status.summary?.required_secret_name_count !== 16) fail('full dry-run must require 16 secret names.');
  if (status.summary?.secret_name_to_set_count !== 16) fail('full dry-run must set 16 secret names.');
  if (status.summary?.ready_for_current_completion_sync_inputs !== true) {
    fail('full dry-run current completion group must be ready.');
  }
  if (status.summary?.ready_for_evidence_refresh_sync_inputs !== true) {
    fail('full dry-run evidence refresh group must be ready.');
  }
  if (status.summary?.ready_for_sync_apply !== true) fail('full dry-run must be ready for sync apply.');
  if (status.secret_count !== 16) fail('full dry-run secret_count must be 16.');
  if (!status.secret_names?.includes('APP_RELEASE_DATABASE_URL')) {
    fail('full dry-run must map DATABASE_URL to APP_RELEASE_DATABASE_URL.');
  }
  if (!status.secret_names?.includes('APP_STORE_CONNECT_PRIVATE_KEY')) {
    fail('full dry-run must map ASC private key path to APP_STORE_CONNECT_PRIVATE_KEY.');
  }
  if (status.secret_names?.includes('DATABASE_URL')) {
    fail('full dry-run must not expose DATABASE_URL as a GitHub secret name.');
  }
  if (status.secret_groups?.current_completion_blocker_secret_names?.ready_for_sync_inputs !== true) {
    fail('full dry-run current completion secret group must be ready.');
  }
  if (status.secret_groups?.evidence_refresh_secret_names?.ready_for_sync_inputs !== true) {
    fail('full dry-run evidence refresh secret group must be ready.');
  }
  if (!String(status.message || '').includes('Dry-run only; pass --apply')) {
    fail('full dry-run message must explain that --apply is required before writing secrets.');
  }
}

function assertPartialDryRun(status) {
  if (status.type !== 'app-release-github-secret-sync-status') fail('partial dry-run type mismatch.');
  if (status.ok !== false) fail('partial dry-run must be ok=false.');
  if (status.summary?.secret_name_to_set_count !== 2) fail('partial dry-run must only set refresh secret names.');
  if (status.summary?.current_completion_secret_name_to_set_count !== 0) {
    fail('partial dry-run must not mark current completion secrets as set.');
  }
  if (status.summary?.evidence_refresh_secret_name_to_set_count !== 2) {
    fail('partial dry-run evidence refresh group must have two secret names to set.');
  }
  if (status.summary?.ready_for_current_completion_sync_inputs !== false) {
    fail('partial dry-run current completion group must not be ready.');
  }
  if (status.summary?.ready_for_evidence_refresh_sync_inputs !== true) {
    fail('partial dry-run evidence refresh group must be ready.');
  }
  if (status.summary?.ready_for_sync_apply !== false) fail('partial dry-run must not be ready for apply.');
  const current = status.secret_groups?.current_completion_blocker_secret_names;
  const refresh = status.secret_groups?.evidence_refresh_secret_names;
  if (!current?.placeholder_keys?.includes('APP_STORE_CONNECT_PRIVATE_KEY_PATH')) {
    fail('partial dry-run current completion group must include ASC private key path placeholder.');
  }
  if (refresh?.ready_for_sync_inputs !== true) {
    fail('partial dry-run refresh group must be ready.');
  }
  if (!status.secret_names_to_set?.includes('APP_RELEASE_DATABASE_URL')) {
    fail('partial dry-run must map refresh DATABASE_URL to APP_RELEASE_DATABASE_URL.');
  }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'emorapy-github-secret-sync-contract-'));
try {
  const privateKeyPath = path.join(tempRoot, 'controlled-asc-key.p8');
  fs.writeFileSync(privateKeyPath, `-----BEGIN PRIVATE KEY-----\n${controlledValues[16]}\n-----END PRIVATE KEY-----\n`);

  const fullEnvPath = path.join(tempRoot, 'release.full.env.local');
  const partialEnvPath = path.join(tempRoot, 'release.partial.env.local');
  writeEnvFile(fullEnvPath, buildFullEnvEntries(privateKeyPath));
  writeEnvFile(partialEnvPath, buildPartialEnvEntries());

  const fullDryRun = runSync(['--json', `--release-env-file=${fullEnvPath}`], {
    EMORAPY_GITHUB_REPO: 'Alex0158/emorapy-controlled',
  });
  if (fullDryRun.status !== 0) {
    fail(`full dry-run must exit 0 without gh on PATH; status=${fullDryRun.status} stderr=${fullDryRun.stderr.trim()}`);
  }
  assertNoControlledLeaks('full dry-run stdout/stderr', `${fullDryRun.stdout}\n${fullDryRun.stderr}`);
  const fullStatus = parseJson('full dry-run', fullDryRun);
  assertFullDryRun(fullStatus);

  const applyAttempt = runSync(['--apply', '--json', `--release-env-file=${fullEnvPath}`]);
  if (applyAttempt.status === 0) fail('apply attempt without gh on PATH must not pass.');
  assertNoControlledLeaks('apply attempt stdout/stderr', `${applyAttempt.stdout}\n${applyAttempt.stderr}`);
  const applyStatus = parseJson('apply attempt', applyAttempt);
  if (applyStatus.ok !== false || applyStatus.apply !== true) {
    fail('apply attempt without gh must return ok=false and apply=true.');
  }

  const partialDryRun = runSync(['--json', `--release-env-file=${partialEnvPath}`]);
  if (partialDryRun.status === 0) fail('partial dry-run with placeholders must exit non-zero.');
  assertNoControlledLeaks('partial dry-run stdout/stderr', `${partialDryRun.stdout}\n${partialDryRun.stderr}`);
  const partialStatus = parseJson('partial dry-run', partialDryRun);
  assertPartialDryRun(partialStatus);

  console.log(
    `[release-github-secret-sync-contract] ok: dry-run is local-only, JSON grouping is stable, apply needs GitHub, and controlled values stay redacted (${relative(fullEnvPath)})`
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
