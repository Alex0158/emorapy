import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const apply = process.argv.includes('--apply');
const json = process.argv.includes('--json');
const repoArg = process.argv.find((arg) => arg.startsWith('--repo='));
const environmentArg = process.argv.find((arg) => arg.startsWith('--env='));
const releaseEnvFileArg = process.argv.find((arg) => arg.startsWith('--release-env-file='));
const repo = repoArg?.slice('--repo='.length) || 'Alex0158/mother-bear-court';
const environment = environmentArg?.slice('--env='.length) || 'Production';
const envFile = releaseEnvFileArg
  ? path.resolve(mobileRoot, releaseEnvFileArg.slice('--release-env-file='.length))
  : path.join(mobileRoot, 'release.env.local');

const mappings = [
  ['EXPO_TOKEN', 'EXPO_TOKEN'],
  ['ASC_APPLE_ID', 'ASC_APPLE_ID'],
  ['EXPO_APPLE_APP_SPECIFIC_PASSWORD', 'EXPO_APPLE_APP_SPECIFIC_PASSWORD'],
  ['APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN', 'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN'],
  ['APP_SENTRY_ORG', 'APP_SENTRY_ORG'],
  ['APP_SENTRY_PROJECT', 'APP_SENTRY_PROJECT'],
  ['APP_SENTRY_AUTH_TOKEN', 'APP_SENTRY_AUTH_TOKEN'],
  ['APP_NATIVE_CRASH_SENTRY_EVENT_ID', 'APP_NATIVE_CRASH_SENTRY_EVENT_ID'],
  ['APP_TELEMETRY_RUNTIME_API_BASE_URL', 'APP_TELEMETRY_RUNTIME_API_BASE_URL'],
  ['DATABASE_URL', 'APP_RELEASE_DATABASE_URL'],
  ['APP_STORE_CONNECT_ISSUER_ID', 'APP_STORE_CONNECT_ISSUER_ID'],
  ['APP_STORE_CONNECT_KEY_ID', 'APP_STORE_CONNECT_KEY_ID'],
  ['APP_IOS_DEVICE_UDID', 'APP_IOS_DEVICE_UDID'],
  ['APP_IOS_DEVICE_APP_PATH', 'APP_IOS_DEVICE_APP_PATH'],
  ['APP_ANDROID_DEVICE_SERIAL', 'APP_ANDROID_DEVICE_SERIAL'],
];
const allowedEnvFileKeys = new Set([
  'DEVELOPER_DIR',
  'APP_RELEASE_EXTERNAL_SIGNOFF_RUN',
  'APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR',
  'APP_PHYSICAL_DEVICE_PLATFORM',
  'APP_EAS_IOS_REQUIRE_TESTFLIGHT',
  'APP_STORE_CONNECT_APP_ID',
  'APP_PUSH_DELIVERY_ACCESS_TOKEN',
  'APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT',
  'APP_STORE_CONNECT_PRIVATE_KEY',
  'APP_STORE_CONNECT_PRIVATE_KEY_PATH',
  ...mappings.map(([sourceKey]) => sourceKey),
]);

function fail(message) {
  if (json) {
    console.log(
      JSON.stringify(
        {
          type: 'app-release-github-secret-sync-status',
          generated_at: new Date().toISOString(),
          values_redacted: true,
          repo,
          environment,
          apply,
          ok: false,
          error: message,
        },
        null,
        2
      )
    );
  } else {
    console.error(`[release-github-secret-sync] ${message}`);
  }
  process.exit(1);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) fail(`--release-env-file path does not exist: ${path.relative(repoRoot, filePath)}`);
  const entries = new Map();
  const text = fs.readFileSync(filePath, 'utf8');
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(normalized);
    if (!match) fail(`invalid --release-env-file line ${index + 1}; expected KEY=value without shell expansion`);
    const [, key, rawValue] = match;
    if (!allowedEnvFileKeys.has(key)) fail(`unsupported --release-env-file key: ${key}`);
    entries.set(key, rawValue.trim());
  }
  return entries;
}

function unquote(value) {
  const trimmed = String(value ?? '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readValue(entries, key) {
  return unquote(process.env[key] || entries.get(key) || '');
}

function isPlaceholder(value) {
  return value.startsWith('REPLACE_WITH_');
}

function runGh(args, options = {}) {
  const result = spawnSync('gh', args, {
    input: options.input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || result.stdout?.trim() || `gh exited ${result.status}`;
    fail(stderr);
  }
  return result.stdout || '';
}

function ensureEnvironmentExists(targetEnvironment) {
  const names = runGh(['api', `repos/${repo}/environments`, '--jq', '.environments[]?.name'])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!names.includes(targetEnvironment)) {
    fail(`GitHub Environment is not configured: ${targetEnvironment}`);
  }
}

const entries = parseEnvFile(envFile);
const missingKeys = [];
const placeholderKeys = [];
const secrets = [];

for (const [sourceKey, secretName] of mappings) {
  const value = readValue(entries, sourceKey);
  if (!value) {
    missingKeys.push(sourceKey);
  } else if (isPlaceholder(value)) {
    placeholderKeys.push(sourceKey);
  } else {
    secrets.push({ sourceKey, secretName, value });
  }
}

const privateKeyPath = readValue(entries, 'APP_STORE_CONNECT_PRIVATE_KEY_PATH');
const privateKeyInline = readValue(entries, 'APP_STORE_CONNECT_PRIVATE_KEY');
if (privateKeyInline && !isPlaceholder(privateKeyInline)) {
  secrets.push({
    sourceKey: 'APP_STORE_CONNECT_PRIVATE_KEY',
    secretName: 'APP_STORE_CONNECT_PRIVATE_KEY',
    value: privateKeyInline,
  });
} else if (privateKeyPath && !isPlaceholder(privateKeyPath)) {
  const resolvedKeyPath = path.resolve(mobileRoot, privateKeyPath);
  if (!fs.existsSync(resolvedKeyPath)) {
    missingKeys.push('APP_STORE_CONNECT_PRIVATE_KEY_PATH(file)');
  } else {
    secrets.push({
      sourceKey: 'APP_STORE_CONNECT_PRIVATE_KEY_PATH',
      secretName: 'APP_STORE_CONNECT_PRIVATE_KEY',
      value: fs.readFileSync(resolvedKeyPath, 'utf8'),
    });
  }
} else if (privateKeyPath && isPlaceholder(privateKeyPath)) {
  placeholderKeys.push('APP_STORE_CONNECT_PRIVATE_KEY_PATH');
} else {
  missingKeys.push('APP_STORE_CONNECT_PRIVATE_KEY_PATH');
}

if (missingKeys.length || placeholderKeys.length) {
  const status = {
    type: 'app-release-github-secret-sync-status',
    generated_at: new Date().toISOString(),
    values_redacted: true,
    repo,
    environment,
    apply,
    ok: false,
    env_file: path.relative(repoRoot, envFile),
    missing_keys: missingKeys,
    placeholder_keys: placeholderKeys,
    secret_names_to_set: secrets.map((secret) => secret.secretName).sort(),
  };
  if (json) console.log(JSON.stringify(status, null, 2));
  else {
    console.log(`[release-github-secret-sync] values_redacted=true apply=${apply} environment=${environment}`);
    if (missingKeys.length) console.log(`[release-github-secret-sync] missing_keys=${missingKeys.join(',')}`);
    if (placeholderKeys.length) console.log(`[release-github-secret-sync] placeholder_keys=${placeholderKeys.join(',')}`);
  }
  process.exit(1);
}

ensureEnvironmentExists(environment);

const secretNames = secrets.map((secret) => secret.secretName).sort();
if (apply) {
  for (const secret of secrets) {
    runGh(['secret', 'set', secret.secretName, '--repo', repo, '--env', environment], {
      input: secret.value,
    });
  }
}

const status = {
  type: 'app-release-github-secret-sync-status',
  generated_at: new Date().toISOString(),
  values_redacted: true,
  repo,
  environment,
  apply,
  ok: true,
  env_file: path.relative(repoRoot, envFile),
  secret_count: secretNames.length,
  secret_names: secretNames,
  message: apply ? 'GitHub Environment secrets were written.' : 'Dry-run only; pass --apply to write secrets.',
};

if (json) {
  console.log(JSON.stringify(status, null, 2));
} else {
  console.log(`[release-github-secret-sync] values_redacted=true apply=${apply} environment=${environment}`);
  console.log(`[release-github-secret-sync] secret_count=${secretNames.length}`);
  console.log(`[release-github-secret-sync] secret_names=${secretNames.join(',')}`);
  console.log(`[release-github-secret-sync] ${status.message}`);
}
