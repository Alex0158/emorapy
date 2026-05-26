import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const evidenceRoot = path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證');
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001/api/v1';

const options = {
  apiBaseUrl: process.env.APP_SMOKE_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
  dryRun: false,
  evidenceDir: evidenceRoot,
  run: process.env.APP_SELECTED_MEDIA_UPLOAD_RUN === 'true',
  timeoutMs: Number(process.env.APP_SELECTED_MEDIA_UPLOAD_TIMEOUT_MS || process.env.APP_SMOKE_TIMEOUT_MS || 30_000),
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--run') {
    options.run = true;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg.startsWith('--api-base-url=')) {
    options.apiBaseUrl = arg.slice('--api-base-url='.length);
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else if (arg.startsWith('--timeout-ms=')) {
    options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
  } else if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  } else {
    console.error(`[selected-media-upload-smoke] unknown argument: ${arg}`);
    process.exit(1);
  }
}

if (options.dryRun) options.run = false;

function printHelp() {
  console.log(`Usage: npm --prefix mobile run selected-media:upload:smoke -- [options]

Options:
  --run                    Execute against a local backend and local DB.
  --dry-run                Print planned checks without network calls.
  --api-base-url=<url>     API base URL. Default: ${DEFAULT_API_BASE_URL}.
  --evidence-dir=<dir>     Directory for App-Selected-Media-Upload-*.json.
  --timeout-ms=<ms>        True-service smoke request timeout.

Required for --run:
  APP_SMOKE_BACKEND_DATABASE_URL must be set and must point to localhost / 127.* / ::1.

This runner verifies the backend multipart upload/delete contract using a synthetic PNG fixture through the App upload adapter path. It does not prove a physical device media provider, a user-selected native picker asset, or profile media authorization.
`);
}

function isLocalHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '::1' || normalized.startsWith('127.');
}

function classifyUrl(urlString) {
  if (!urlString) return { present: false, local: false, provider: null };
  try {
    const url = new URL(urlString);
    return {
      present: true,
      local: url.protocol === 'file:' || isLocalHostname(url.hostname),
      provider: url.protocol.replace(':', '') || null,
    };
  } catch {
    return { present: true, local: false, provider: 'unknown' };
  }
}

function normalizeBaseUrl(input) {
  return new URL(input).toString().replace(/\/$/, '');
}

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function tail(text, max = 5000) {
  if (!text) return '';
  return text.length > max ? text.slice(text.length - max) : text;
}

function sanitizeText(text) {
  return tail(text)
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[redacted-database-url]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-openai-key]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]');
}

function runCommand(command, args = [], extra = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...extra,
  });
  return {
    command,
    args,
    status: result.status ?? 1,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    duration_ms: Date.now() - startedAt,
  };
}

function summarizeCommand(result) {
  return {
    command: result.command,
    args: result.args,
    exit_code: result.status,
    signal: result.signal,
    duration_ms: result.duration_ms,
    stderr_tail: sanitizeText(result.stderr),
  };
}

function findLatestEvidence(prefix) {
  if (!fs.existsSync(evidenceRoot)) return null;
  const match = fs
    .readdirSync(evidenceRoot)
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith('.json'))
    .sort()
    .reverse()[0];
  return match ? path.join(evidenceRoot, match) : null;
}

function parseJsonReport(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    const firstBrace = stdout.indexOf('{');
    const lastBrace = stdout.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
    try {
      return JSON.parse(stdout.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

function hasPassedStep(report, name) {
  return Array.isArray(report?.steps) && report.steps.some((step) => step.name === name && step.status === 'passed');
}

function buildTrueServiceSummary(result) {
  const report = parseJsonReport(result.stdout);
  const requiredSteps = [
    'safety.run_target',
    'safety.bootstrap_local_users',
    'core.version',
    'm5.upload_case_create',
    'm5.evidence_upload',
    'm5.evidence_delete',
  ];
  const steps = Object.fromEntries(requiredSteps.map((name) => [name, hasPassedStep(report, name)]));
  return {
    command: summarizeCommand(result),
    parsed: Boolean(report),
    ok: report?.ok === true,
    blocked: report?.blocked === true,
    mode: report?.mode ?? null,
    scope: report?.scope ?? null,
    required_steps: steps,
    upload_case_id: report?.steps?.find((step) => step.name === 'm5.upload_case_create')?.caseId ?? null,
    evidence_id: report?.steps?.find((step) => step.name === 'm5.evidence_upload')?.evidenceId ?? null,
  };
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-Selected-Media-Upload-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function buildEvidence({
  apiSafety,
  dbSafety,
  platformBoundary,
  uploadUnit,
  trueService,
  startedAt,
}) {
  const trueServiceUploadPassed =
    trueService?.parsed === true &&
    trueService?.ok === true &&
    trueService?.required_steps?.['m5.upload_case_create'] === true &&
    trueService?.required_steps?.['m5.evidence_upload'] === true &&
    trueService?.required_steps?.['m5.evidence_delete'] === true;

  const blocked =
    apiSafety.local !== true ||
    dbSafety.local !== true ||
    platformBoundary?.status !== 0 ||
    uploadUnit?.status !== 0 ||
    trueServiceUploadPassed !== true;

  return {
    type: 'app-selected-media-backend-upload-smoke',
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    working_directory: mobileRoot,
    node_version: process.version,
    api: {
      local: apiSafety.local,
      provider: apiSafety.provider,
    },
    database: {
      source: 'APP_SMOKE_BACKEND_DATABASE_URL',
      present: dbSafety.present,
      local: dbSafety.local,
      provider: dbSafety.provider,
    },
    native_upload_picker_evidence: findLatestEvidence('App-Native-Upload-')
      ? path.relative(repoRoot, findLatestEvidence('App-Native-Upload-'))
      : null,
    summary: {
      platform_boundary_passed: platformBoundary?.status === 0,
      upload_unit_passed: uploadUnit?.status === 0,
      true_service_upload_passed: trueServiceUploadPassed,
      synthetic_fixture_upload: true,
      blocked,
    },
    platform_boundary: platformBoundary
      ? { status: platformBoundary.status === 0 ? 'passed' : 'failed', ...summarizeCommand(platformBoundary) }
      : { status: 'not_run' },
    upload_unit: uploadUnit
      ? { status: uploadUnit.status === 0 ? 'passed' : 'failed', ...summarizeCommand(uploadUnit) }
      : { status: 'not_run' },
    true_service: trueService ?? { status: 'not_run' },
    does_not_prove: [
      'physical device media provider authorization',
      'a user-selected native ImagePicker asset reaching backend',
      'profile media authorization',
      'APNs or push provider delivery',
    ],
  };
}

options.apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl);
const apiSafety = classifyUrl(options.apiBaseUrl);
const dbSafety = classifyUrl(process.env.APP_SMOKE_BACKEND_DATABASE_URL);

const plannedCommands = [
  ['node', ['scripts/check-platform-boundaries.mjs']],
  ['npx', ['jest', '--runInBand', 'src/platform/upload/native.test.js']],
  ['node', [
    'scripts/app-true-service-smoke.mjs',
    '--run',
    '--scope=m5',
    '--bootstrap-local-users',
    `--api-base-url=${options.apiBaseUrl}`,
    `--timeout-ms=${options.timeoutMs}`,
  ]],
];

if (!options.run) {
  console.log(`[selected-media-upload-smoke] dry-run apiLocal=${apiSafety.local} dbLocal=${dbSafety.local}`);
  console.log('[selected-media-upload-smoke] APP_SMOKE_BACKEND_DATABASE_URL must be set to a local DB before --run.');
  plannedCommands.forEach(([command, args]) => console.log(`- ${[command, ...args].join(' ')}`));
  process.exit(0);
}

const startedAt = new Date().toISOString();
let platformBoundary = null;
let uploadUnit = null;
let trueService = null;

if (apiSafety.local && dbSafety.local) {
  platformBoundary = runCommand('node', ['scripts/check-platform-boundaries.mjs']);
}

if (platformBoundary?.status === 0) {
  uploadUnit = runCommand('npx', ['jest', '--runInBand', 'src/platform/upload/native.test.js']);
}

if (uploadUnit?.status === 0) {
  const result = runCommand('node', [
    'scripts/app-true-service-smoke.mjs',
    '--run',
    '--scope=m5',
    '--bootstrap-local-users',
    `--api-base-url=${options.apiBaseUrl}`,
    `--timeout-ms=${options.timeoutMs}`,
  ], {
    env: {
      ...process.env,
      APP_SMOKE_SCOPE: 'm5',
      APP_SMOKE_BOOTSTRAP_LOCAL_USERS: 'true',
      APP_TRUE_SERVICE_SMOKE_RUN: 'true',
    },
  });
  trueService = buildTrueServiceSummary(result);
}

const evidence = buildEvidence({
  apiSafety,
  dbSafety,
  platformBoundary,
  uploadUnit,
  trueService,
  startedAt,
});
const evidencePath = writeEvidence(evidence);
console.log(`[selected-media-upload-smoke] evidence written: ${evidencePath}`);

if (evidence.summary.blocked) {
  console.error('[selected-media-upload-smoke] failed: selected-media backend upload smoke did not complete.');
  process.exit(1);
}

console.log('[selected-media-upload-smoke] ok: synthetic selected-media backend upload/delete contract passed through the App upload path');
