import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { getExpoProjectIdStatus } from './lib/release-app-config.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const defaultEnvFile = path.join(mobileRoot, 'release.env.local');

const json = process.argv.includes('--json');
const releaseEnvFileArg = process.argv.find((arg) => arg.startsWith('--release-env-file='));
const envFile = releaseEnvFileArg
  ? path.resolve(mobileRoot, releaseEnvFileArg.slice('--release-env-file='.length))
  : defaultEnvFile;

const requiredInputKeys = [
  'EXPO_TOKEN',
  'ASC_APPLE_ID',
  'EXPO_APPLE_APP_SPECIFIC_PASSWORD',
  'APP_STORE_CONNECT_ISSUER_ID',
  'APP_STORE_CONNECT_KEY_ID',
  'APP_STORE_CONNECT_PRIVATE_KEY_PATH',
  'APP_IOS_DEVICE_UDID',
  'APP_IOS_DEVICE_APP_PATH',
  'APP_ANDROID_DEVICE_SERIAL',
  'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN',
  'APP_SENTRY_ORG',
  'APP_SENTRY_PROJECT',
  'APP_SENTRY_AUTH_TOKEN',
  'APP_NATIVE_CRASH_SENTRY_EVENT_ID',
  'APP_TELEMETRY_RUNTIME_API_BASE_URL',
  'DATABASE_URL',
];
const allowedInputKeys = new Set([
  'DEVELOPER_DIR',
  'APP_RELEASE_EXTERNAL_SIGNOFF_RUN',
  'APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR',
  'APP_PHYSICAL_DEVICE_PLATFORM',
  'APP_EAS_IOS_REQUIRE_TESTFLIGHT',
  'APP_STORE_CONNECT_APP_ID',
  'APP_PUSH_DELIVERY_ACCESS_TOKEN',
  'APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT',
  ...requiredInputKeys,
]);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, entries: new Map() };
  const entries = new Map();
  const text = fs.readFileSync(filePath, 'utf8');
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(normalized);
    if (!match) {
      entries.set(`__INVALID_LINE_${index + 1}`, '');
      continue;
    }
    const [, key, value] = match;
    entries.set(key, value.trim());
  }
  return { exists: true, entries };
}

function isPlaceholder(value) {
  return String(value ?? '').trim().startsWith('REPLACE_WITH_');
}

function readAppJson() {
  return JSON.parse(fs.readFileSync(path.join(mobileRoot, 'app.json'), 'utf8')).expo;
}

const { exists: envFileExists, entries } = parseEnvFile(envFile);
const missingKeys = [];
const placeholderKeys = [];
const filledKeys = [];
const invalidLines = [...entries.keys()].filter((key) => key.startsWith('__INVALID_LINE_'));
const unsupportedKeys = [...entries.keys()].filter(
  (key) => !key.startsWith('__INVALID_LINE_') && !allowedInputKeys.has(key)
);

for (const key of requiredInputKeys) {
  const envValue = process.env[key]?.trim();
  const fileValue = entries.get(key);
  const value = envValue || fileValue;
  if (!value) {
    missingKeys.push(key);
  } else if (isPlaceholder(value)) {
    placeholderKeys.push(key);
  } else {
    filledKeys.push(key);
  }
}

let easProjectId = { present: false, valid: false, format: 'missing' };
try {
  easProjectId = getExpoProjectIdStatus(readAppJson());
} catch {
  easProjectId = { present: false, valid: false, format: 'unreadable_app_json' };
}

const status = {
  type: 'app-external-signoff-input-status',
  generated_at: new Date().toISOString(),
  env_file: path.relative(repoRoot, envFile),
  env_file_exists: envFileExists,
  values_redacted: true,
  app: {
    eas_project_id_present: easProjectId.present,
    eas_project_id_valid: easProjectId.valid,
    eas_project_id_format: easProjectId.format,
  },
  summary: {
    required_key_count: requiredInputKeys.length,
    filled_count: filledKeys.length,
    placeholder_count: placeholderKeys.length,
    missing_count: missingKeys.length,
    invalid_line_count: invalidLines.length,
    unsupported_key_count: unsupportedKeys.length,
    ready_for_validate:
      envFileExists &&
      easProjectId.valid &&
      filledKeys.length === requiredInputKeys.length &&
      placeholderKeys.length === 0 &&
      missingKeys.length === 0 &&
      invalidLines.length === 0 &&
      unsupportedKeys.length === 0,
  },
  filled_keys: filledKeys,
  placeholder_keys: placeholderKeys,
  missing_keys: missingKeys,
  invalid_lines: invalidLines,
  unsupported_keys: unsupportedKeys,
};

if (json) {
  console.log(JSON.stringify(status, null, 2));
} else {
  console.log(`[release-input-status] env_file=${status.env_file} exists=${status.env_file_exists}`);
  console.log(
    `[release-input-status] eas_project_id_valid=${status.app.eas_project_id_valid} filled=${status.summary.filled_count}/${status.summary.required_key_count} placeholders=${status.summary.placeholder_count} missing=${status.summary.missing_count} invalid_lines=${status.summary.invalid_line_count} unsupported_keys=${status.summary.unsupported_key_count}`
  );
  if (placeholderKeys.length) console.log(`[release-input-status] placeholder_keys=${placeholderKeys.join(',')}`);
  if (missingKeys.length) console.log(`[release-input-status] missing_keys=${missingKeys.join(',')}`);
  if (invalidLines.length) console.log(`[release-input-status] invalid_lines=${invalidLines.join(',')}`);
  if (unsupportedKeys.length) console.log(`[release-input-status] unsupported_keys=${unsupportedKeys.join(',')}`);
  console.log(`[release-input-status] ready_for_validate=${status.summary.ready_for_validate}`);
}

if (invalidLines.length || unsupportedKeys.length) process.exitCode = 1;
