import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const allowedReleaseEnvFileKeys = new Set([
  'DEVELOPER_DIR',
  'ANDROID_HOME',
  'ANDROID_SDK_ROOT',
  'APP_RELEASE_EXTERNAL_SIGNOFF_RUN',
  'APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR',
  'APP_PHYSICAL_DEVICE_PLATFORM',
  'APP_EAS_IOS_REQUIRE_TESTFLIGHT',
  'APP_EAS_PROJECT_FULL_NAME',
  'APP_EAS_IOS_RELEASE_SMOKE_RUN',
  'APP_EAS_IOS_BUILD_ID',
  'APP_EAS_IOS_SKIP_ARTIFACT_HEAD',
  'APP_EAS_IOS_RELEASE_TIMEOUT_MS',
  'APP_EAS_ANDROID_RELEASE_SMOKE_RUN',
  'APP_EAS_ANDROID_BUILD_ID',
  'APP_EAS_ANDROID_SKIP_ARTIFACT_HEAD',
  'APP_EAS_ANDROID_RELEASE_TIMEOUT_MS',
  'EXPO_TOKEN',
  'ASC_APPLE_ID',
  'EXPO_APPLE_APP_SPECIFIC_PASSWORD',
  'APP_STORE_CONNECT_ISSUER_ID',
  'ASC_ISSUER_ID',
  'APP_STORE_CONNECT_KEY_ID',
  'ASC_KEY_ID',
  'APP_STORE_CONNECT_PRIVATE_KEY',
  'ASC_PRIVATE_KEY',
  'APP_STORE_CONNECT_PRIVATE_KEY_PATH',
  'ASC_PRIVATE_KEY_PATH',
  'APP_STORE_CONNECT_APP_ID',
  'ASC_APP_ID',
  'APP_PHYSICAL_DEVICE_ID',
  'APP_IOS_DEVICE_UDID',
  'APP_IOS_DEVICE_APP_PATH',
  'APP_ANDROID_DEVICE_SERIAL',
  'APP_PUSH_DELIVERY_SMOKE_RUN',
  'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN',
  'APP_PUSH_DELIVERY_ACCESS_TOKEN',
  'EXPO_PUSH_ACCESS_TOKEN',
  'APP_PUSH_DELIVERY_SEND_ENDPOINT',
  'APP_PUSH_DELIVERY_RECEIPTS_ENDPOINT',
  'APP_PUSH_DELIVERY_RECEIPT_ATTEMPTS',
  'APP_PUSH_DELIVERY_RECEIPT_INTERVAL_MS',
  'APP_PUSH_DELIVERY_TIMEOUT_MS',
  'APP_NATIVE_CRASH_RUNTIME_SMOKE_RUN',
  'APP_SENTRY_BASE_URL',
  'APP_SENTRY_ORG',
  'SENTRY_ORG',
  'APP_SENTRY_PROJECT',
  'SENTRY_PROJECT',
  'APP_SENTRY_AUTH_TOKEN',
  'SENTRY_AUTH_TOKEN',
  'APP_NATIVE_CRASH_SENTRY_EVENT_ID',
  'SENTRY_EVENT_ID',
  'APP_NATIVE_CRASH_EXPECTED_RELEASE',
  'APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT',
  'EXPO_PUBLIC_SENTRY_ENVIRONMENT',
  'APP_ENV',
  'APP_NATIVE_CRASH_RUNTIME_TIMEOUT_MS',
  'APP_TELEMETRY_RUNTIME_SMOKE_RUN',
  'APP_TELEMETRY_RUNTIME_API_BASE_URL',
  'APP_TELEMETRY_RUNTIME_TIMEOUT_MS',
  'DATABASE_URL',
]);

export function parseReleaseEnvValue(rawValue) {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function resolveExistingReleaseEnvFile(input, roots = [process.cwd()]) {
  if (path.isAbsolute(input)) return fs.existsSync(input) ? input : null;
  return roots
    .map((root) => path.resolve(root, input))
    .find((candidate) => fs.existsSync(candidate)) ?? null;
}

export function loadReleaseEnvFile(rawPath, options = {}) {
  const {
    roots = [process.cwd()],
    allowedKeys = allowedReleaseEnvFileKeys,
  } = options;
  const resolvedPath = resolveExistingReleaseEnvFile(rawPath, roots);
  if (!resolvedPath) {
    throw new Error(`--release-env-file path does not exist: ${rawPath}`);
  }

  const text = fs.readFileSync(resolvedPath, 'utf8');
  const loadedKeys = [];
  const keptExistingKeys = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(normalized);
    if (!match) {
      throw new Error(`invalid --release-env-file line ${index + 1}; expected KEY=value without shell expansion`);
    }
    const [, key, rawValue] = match;
    if (!allowedKeys.has(key)) {
      throw new Error(`unsupported --release-env-file key: ${key}`);
    }
    if (Object.prototype.hasOwnProperty.call(process.env, key) && process.env[key] !== '') {
      keptExistingKeys.push(key);
      continue;
    }
    process.env[key] = parseReleaseEnvValue(rawValue);
    loadedKeys.push(key);
  }

  return {
    filePath: resolvedPath,
    loadedKeys: loadedKeys.length,
    keptExistingKeys: keptExistingKeys.length,
  };
}

export function loadReleaseEnvFilesFromArgs(args, options = {}) {
  const loadedEnvFiles = [];
  for (const arg of args) {
    if (arg.startsWith('--env-file=')) {
      throw new Error('--env-file is reserved by Node/npm; use --release-env-file=<path>');
    }
    if (!arg.startsWith('--release-env-file=')) continue;
    const rawPath = arg.slice('--release-env-file='.length);
    if (!rawPath) throw new Error('--release-env-file requires a path');
    loadedEnvFiles.push(loadReleaseEnvFile(rawPath, options));
  }
  return loadedEnvFiles;
}

export function collectReleaseEnvFileArgs(args) {
  return args.filter((arg) => arg.startsWith('--release-env-file='));
}
