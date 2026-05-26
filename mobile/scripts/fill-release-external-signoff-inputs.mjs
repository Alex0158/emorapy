import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { isValidExpoProjectId } from './lib/release-app-config.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const releaseEnvFileArg = process.argv.find((arg) => arg.startsWith('--release-env-file='));
const envFilePath = releaseEnvFileArg
  ? path.resolve(mobileRoot, releaseEnvFileArg.slice('--release-env-file='.length))
  : path.join(mobileRoot, 'release.env.local');
const templatePath = path.join(mobileRoot, 'release.env.example');
const appJsonPath = path.join(mobileRoot, 'app.json');

const hiddenKeys = new Set([
  'EXPO_TOKEN',
  'EXPO_APPLE_APP_SPECIFIC_PASSWORD',
  'APP_STORE_CONNECT_ISSUER_ID',
  'APP_STORE_CONNECT_KEY_ID',
  'APP_IOS_DEVICE_UDID',
  'APP_ANDROID_DEVICE_SERIAL',
  'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN',
  'APP_PUSH_DELIVERY_ACCESS_TOKEN',
  'APP_SENTRY_ORG',
  'APP_SENTRY_PROJECT',
  'APP_SENTRY_AUTH_TOKEN',
  'APP_NATIVE_CRASH_SENTRY_EVENT_ID',
  'DATABASE_URL',
]);
const requiredKeys = [
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

function fail(message) {
  console.error(`[release-input-fill] ${message}`);
  process.exit(1);
}

function printUsage() {
  console.log(`usage: npm --prefix mobile run release:external-evidence:fill-inputs -- [--release-env-file=release.env.local] [--list-missing]

Interactively fills the gitignored App release sign-off env file and, when missing,
mobile/app.json expo.extra.eas.projectId. Secret-like values are not echoed.

Options:
  --release-env-file=<path>  Local env file path relative to mobile/ unless absolute.
  --list-missing            Print redacted missing/placeholder key status and exit.
  --help                    Show this help text.`);
}

function parseEnv(text, filePath) {
  const lines = text.split(/\r?\n/);
  const entries = new Map();
  for (const [index, rawLine] of lines.entries()) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const normalized = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(normalized);
    if (!match) {
      fail(`invalid line ${index + 1} in ${path.relative(repoRoot, filePath)}; expected KEY=value`);
    }
    const [, key, value] = match;
    entries.set(key, value.trim());
  }
  return { lines, entries };
}

function stripQuotes(value) {
  const text = String(value ?? '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function isPlaceholder(value) {
  return !String(value ?? '').trim() || String(value).trim().startsWith('REPLACE_WITH_');
}

function formatValue(value) {
  const text = String(value ?? '');
  if (text === '' || /^[A-Za-z0-9_./:@=+\-]+$/.test(text)) return text;
  return JSON.stringify(text);
}

async function promptVisible(label, defaultValue = '') {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const rl = createInterface({ input, output });
  try {
    return await rl.question(`${label}${suffix}: `);
  } finally {
    rl.close();
  }
}

async function promptHidden(label, defaultValue = '') {
  if (!input.isTTY || !output.isTTY) {
    fail(`cannot hide input for ${label}; run in an interactive terminal`);
  }

  return new Promise((resolve, reject) => {
    let buffer = '';
    let done = false;
    const cleanup = () => {
      if (input.isTTY) input.setRawMode(false);
      input.off('data', onData);
      input.pause();
    };
    const finish = (value) => {
      if (done) return;
      done = true;
      cleanup();
      output.write('\n');
      resolve(value || defaultValue);
    };
    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') {
          cleanup();
          output.write('\n');
          reject(new Error('cancelled'));
          return;
        }
        if (char === '\r' || char === '\n') {
          finish(buffer);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          buffer = buffer.slice(0, -1);
          continue;
        }
        buffer += char;
      }
    };

    output.write(`${label}${defaultValue ? ' [hidden]' : ''}: `);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

function writeEnvFile(entries, order) {
  const outputLines = [];
  const writtenKeys = new Set();
  for (const rawLine of entries.lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      outputLines.push(rawLine);
      continue;
    }
    const normalized = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(normalized);
    if (!match) continue;
    const [, key] = match;
    const value = order.get(key);
    writtenKeys.add(key);
    outputLines.push(value === undefined ? rawLine : `${key}=${value}`);
  }
  for (const [key, value] of order.entries()) {
    if (!writtenKeys.has(key)) {
      outputLines.push(`${key}=${value}`);
    }
  }
  fs.writeFileSync(envFilePath, `${outputLines.join('\n')}\n`);
}

function readAppJson() {
  if (!fs.existsSync(appJsonPath)) fail(`missing ${path.relative(repoRoot, appJsonPath)}`);
  return JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
}

function writeAppJson(app) {
  fs.writeFileSync(appJsonPath, `${JSON.stringify(app, null, 2)}\n`);
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  if (!fs.existsSync(templatePath)) {
    fail(`missing ${path.relative(repoRoot, templatePath)}`);
  }

  if (process.argv.includes('--list-missing')) {
    const status = runStatusCheck();
    console.log(
      `[release-input-fill] env_file=${status.env_file} eas_project_id_valid=${status.app.eas_project_id_valid} filled=${status.summary.filled_count}/${status.summary.required_key_count} placeholders=${status.summary.placeholder_count} missing=${status.summary.missing_count} ready_for_validate=${status.summary.ready_for_validate}`
    );
    if (status.placeholder_keys.length) {
      console.log(`[release-input-fill] placeholder_keys=${status.placeholder_keys.join(',')}`);
    }
    if (status.missing_keys.length) {
      console.log(`[release-input-fill] missing_keys=${status.missing_keys.join(',')}`);
    }
    return;
  }

  const template = parseEnv(fs.readFileSync(templatePath, 'utf8'), templatePath);
  const existing = fs.existsSync(envFilePath)
    ? parseEnv(fs.readFileSync(envFilePath, 'utf8'), envFilePath)
    : { lines: fs.readFileSync(templatePath, 'utf8').split(/\r?\n/), entries: new Map() };
  const replacements = new Map();
  const app = readAppJson();

  const currentProjectId = String(app?.expo?.extra?.eas?.projectId ?? '').trim();
  if (!isValidExpoProjectId(currentProjectId)) {
    const answer = stripQuotes(
      await promptVisible(`EAS project id for ${path.relative(repoRoot, appJsonPath)}`, currentProjectId)
    );
    if (!isValidExpoProjectId(answer)) {
      fail('EAS project id must be a UUID-shaped value');
    }
    app.expo = app.expo || {};
    app.expo.extra = app.expo.extra || {};
    app.expo.extra.eas = app.expo.extra.eas || {};
    app.expo.extra.eas.projectId = answer;
    writeAppJson(app);
    console.log(`[release-input-fill] updated ${path.relative(repoRoot, appJsonPath)} extra.eas.projectId`);
  }

  for (const [key, rawValue] of template.entries) {
    const existingValue = existing.entries.get(key);
    if (requiredKeys.includes(key)) {
      if (!isPlaceholder(existingValue)) {
        replacements.set(key, formatValue(stripQuotes(existingValue)));
        continue;
      }
      const promptLabel = `${key} for ${path.relative(repoRoot, envFilePath)}`;
      const value = hiddenKeys.has(key)
        ? await promptHidden(promptLabel)
        : await promptVisible(promptLabel, '');
      const stripped = stripQuotes(value);
      if (!stripped || isPlaceholder(stripped)) {
        fail(`${key} is required`);
      }
      replacements.set(key, formatValue(stripped));
      continue;
    }

    if (!isPlaceholder(existingValue)) {
      replacements.set(key, formatValue(stripQuotes(existingValue)));
      continue;
    }

    if (!isPlaceholder(rawValue) && rawValue !== '') {
      replacements.set(key, formatValue(stripQuotes(rawValue)));
      continue;
    }
  }

  writeEnvFile(existing, replacements);
  console.log(`[release-input-fill] wrote ${path.relative(repoRoot, envFilePath)}`);

  const status = runStatusCheck();
  console.log(
    `[release-input-fill] ready_for_validate=${status.summary.ready_for_validate} filled=${status.summary.filled_count}/${status.summary.required_key_count} placeholders=${status.summary.placeholder_count} missing=${status.summary.missing_count}`
  );
}

function runStatusCheck() {
  const check = spawnSync(
    process.execPath,
    [path.join(scriptDir, 'check-release-external-signoff-input-status.mjs'), '--json', `--release-env-file=${envFilePath}`],
    { cwd: mobileRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  if (check.status !== 0) {
    process.stdout.write(check.stdout || '');
    process.stderr.write(check.stderr || '');
    fail('input-status check failed');
  }

  return JSON.parse(check.stdout);
}

main().catch((error) => {
  if (error?.message === 'cancelled') fail('cancelled by user');
  fail(error?.stack || error?.message || String(error));
});
