import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'emorapy-release-evidence-sanitize-'));
const emptyBin = path.join(tempRoot, 'empty-bin');
fs.mkdirSync(emptyBin, { recursive: true });

const cases = [
  {
    name: 'eas-ios',
    script: 'run-eas-ios-release-smoke.mjs',
    args: ['--run', '--build-id=eas-ios-build-secret'],
    env: {
      EXPO_TOKEN: 'expo-token-secret',
      PATH: emptyBin,
    },
    prefix: 'App-EAS-iOS-Release-',
    needles: ['expo-token-secret', 'eas-ios-build-secret'],
  },
  {
    name: 'eas-android',
    script: 'run-eas-android-release-smoke.mjs',
    args: ['--run', '--build-id=eas-android-build-secret'],
    env: {
      EXPO_TOKEN: 'expo-token-secret',
      PATH: emptyBin,
    },
    prefix: 'App-EAS-Android-Release-',
    needles: ['expo-token-secret', 'eas-android-build-secret'],
  },
  {
    name: 'push-delivery',
    script: 'run-push-delivery-smoke.mjs',
    args: [
      '--run',
      '--expo-push-token=not-a-token-secret',
      '--access-token=push-access-secret',
    ],
    env: {},
    prefix: 'App-Push-Delivery-',
    needles: ['not-a-token-secret', 'push-access-secret', 'Bearer push-access-secret'],
  },
  {
    name: 'native-crash-runtime',
    script: 'run-native-crash-runtime-smoke.mjs',
    args: [
      '--run',
      '--sentry-base-url=http://127.0.0.1:9',
      '--sentry-org=cj-org',
      '--sentry-project=emorapy-mobile',
      '--sentry-auth-token=sentry-token-secret',
      '--sentry-event-id=native-event-secret',
    ],
    env: {},
    prefix: 'App-Native-Crash-Runtime-',
    needles: ['sentry-token-secret', 'native-event-secret', 'Bearer sentry-token-secret'],
  },
];

function fail(message) {
  console.error(`[release-evidence-sanitization-check] ${message}`);
  process.exitCode = 1;
}

function evidenceFilesFor(dir, prefix) {
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith('.json'))
    .sort();
}

function assertNoNeedles(name, combinedOutput, needles) {
  const leaked = needles.filter((needle) => combinedOutput.includes(needle));
  if (leaked.length > 0) {
    fail(`${name} leaked sensitive values: ${leaked.join(', ')}`);
  }
}

function runRedactionExtraDirChecks() {
  const cleanDir = path.join(tempRoot, 'redaction-clean-extra-dir');
  fs.mkdirSync(cleanDir, { recursive: true });
  fs.writeFileSync(
    path.join(cleanDir, 'App-External-Signoff-Prerequisites-Clean.json'),
    `${JSON.stringify(
      {
        type: 'app-external-signoff-prerequisites',
        ok: false,
        summary: {
          report_contains_secrets: false,
        },
        missing_prerequisites: [{ id: 'expo_token', message: 'EXPO_TOKEN must be present.' }],
      },
      null,
      2
    )}\n`
  );

  const cleanResult = spawnSync(
    process.execPath,
    [path.join(scriptDir, 'check-release-evidence-redaction.mjs'), `--evidence-dir=${cleanDir}`],
    {
      cwd: mobileRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  if (cleanResult.status !== 0) {
    fail(`redaction extra-dir clean report unexpectedly failed: ${cleanResult.stderr || cleanResult.stdout}`);
  }

  const leakDir = path.join(tempRoot, 'redaction-leak-extra-dir');
  fs.mkdirSync(leakDir, { recursive: true });
  const leakNeedles = [
    'controlled-bearer-token-secret',
    'ExpoPushToken[controlled-push-token-secret]',
    'postgresql://user:pass@release-db.example.com:5432/cj',
  ];
  fs.writeFileSync(
    path.join(leakDir, 'App-External-Signoff-Prerequisites-Leak.json'),
    `${JSON.stringify(
      {
        type: 'app-external-signoff-prerequisites',
        ok: false,
        authorization: `Bearer ${leakNeedles[0]}`,
        push_token: leakNeedles[1],
        database_url: leakNeedles[2],
      },
      null,
      2
    )}\n`
  );

  const leakResult = spawnSync(
    process.execPath,
    [path.join(scriptDir, 'check-release-evidence-redaction.mjs'), `--evidence-dir=${leakDir}`],
    {
      cwd: mobileRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  if (leakResult.status === 0) {
    fail('redaction extra-dir leak report unexpectedly passed.');
  }
  const leakOutput = `${leakResult.stdout || ''}\n${leakResult.stderr || ''}`;
  if (!leakOutput.includes('redaction-leak-extra-dir') || !leakOutput.includes('contains raw bearer token')) {
    fail('redaction extra-dir leak report failed without proving the injected report was scanned.');
  }
  assertNoNeedles('redaction extra-dir leak report', leakOutput, leakNeedles);
}

try {
  for (const testCase of cases) {
    const caseDir = path.join(tempRoot, testCase.name);
    fs.mkdirSync(caseDir, { recursive: true });
    const result = spawnSync(
      process.execPath,
      [
        path.join(scriptDir, testCase.script),
        ...testCase.args,
        `--evidence-dir=${caseDir}`,
      ],
      {
        cwd: mobileRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...testCase.env,
        },
      }
    );

    if (result.status === 0) {
      fail(`${testCase.name} unexpectedly passed; blocked evidence was expected for sanitization check.`);
      continue;
    }

    const files = evidenceFilesFor(caseDir, testCase.prefix);
    if (files.length !== 1) {
      fail(`${testCase.name} expected exactly one ${testCase.prefix} evidence file, found ${files.length}.`);
      continue;
    }

    const raw = fs.readFileSync(path.join(caseDir, files[0]), 'utf8');
    const combinedOutput = `${raw}\n${result.stdout || ''}\n${result.stderr || ''}`;
    assertNoNeedles(testCase.name, combinedOutput, testCase.needles);
  }

  runRedactionExtraDirChecks();

  if (process.exitCode) {
    process.exit(process.exitCode);
  }

  console.log(
    `[release-evidence-sanitization-check] ok: ${cases.length} blocked evidence paths and redaction extra-dir checks do not leak controlled secrets`
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
