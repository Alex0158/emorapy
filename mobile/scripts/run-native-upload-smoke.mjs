import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const options = {
  dryRun: false,
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
  flow: '70-native-upload-picker-smoke.yaml',
  platform: 'android',
  skipBuild: process.argv.includes('--skip-build'),
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--skip-build') {
    options.skipBuild = true;
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else if (arg.startsWith('--flow=')) {
    options.flow = arg.slice('--flow='.length);
  } else if (arg.startsWith('--platform=')) {
    options.platform = arg.slice('--platform='.length);
  } else {
    console.error(`[native-upload-smoke] unknown argument: ${arg}`);
    process.exit(1);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function withJavaEnv(env = process.env) {
  const homebrewJavaHome = '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';
  const javaHome = env.JAVA_HOME || (fs.existsSync(path.join(homebrewJavaHome, 'bin/java')) ? homebrewJavaHome : null);
  const nextEnv = javaHome
    ? {
        ...env,
        JAVA_HOME: javaHome,
        PATH: `${path.join(javaHome, 'bin')}:${env.PATH ?? ''}`,
      }
    : env;

  return {
    ...nextEnv,
    MAESTRO_CLI_NO_ANALYTICS: '1',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
  };
}

function commandSucceeds(command, args = []) {
  return runCommand(command, args, { env: withJavaEnv() }).status === 0;
}

function resolveMaestroCommand() {
  const candidates = [];
  const homebrewMaestro = '/opt/homebrew/opt/maestro/bin/maestro';
  if (fs.existsSync(homebrewMaestro)) candidates.push(homebrewMaestro);
  candidates.push('maestro');
  return candidates.find((candidate) => commandSucceeds(candidate, ['--version'])) ?? 'maestro';
}

function tail(text, max = 6000) {
  if (!text) return '';
  return text.length > max ? text.slice(text.length - max) : text;
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function summarizeCommand(result) {
  return {
    command: result.command,
    args: result.args,
    exit_code: result.status,
    signal: result.signal,
    duration_ms: result.duration_ms,
    stdout_tail: tail(result.stdout),
    stderr_tail: tail(result.stderr),
  };
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-Native-Upload-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function verifyStaticContract(flowPath) {
  const issues = [];
  const modalSource = fs.readFileSync(path.join(mobileRoot, 'app', 'modal.tsx'), 'utf8');
  const uploadSource = fs.readFileSync(path.join(mobileRoot, 'src', 'platform', 'upload', 'native.ts'), 'utf8');
  const flowSource = fs.readFileSync(flowPath, 'utf8');

  for (const id of ['modal.screen', 'modal.upload.pick', 'modal.upload.cancelled']) {
    if (!modalSource.includes(`testID="${id}`) && !modalSource.includes(`testID={\`modal.upload.`)) {
      issues.push(`modal.tsx missing selector ${id}`);
    }
    if (!flowSource.includes(`id: ${id}`)) {
      issues.push(`${path.relative(mobileRoot, flowPath)} missing selector ${id}`);
    }
  }

  if (!uploadSource.includes('pickImageWithStatus')) {
    issues.push('upload adapter must expose pickImageWithStatus for native runtime result evidence.');
  }

  return {
    status: issues.length === 0 ? 0 : 1,
    signal: null,
    stdout: issues.length === 0 ? 'native upload static contract ok\n' : '',
    stderr: issues.join('\n'),
    duration_ms: 0,
    command: 'static-native-upload-contract',
    args: [],
  };
}

const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
const flowPath = path.join(mobileRoot, 'maestro-side-effects', options.flow);
const maestroCommand = resolveMaestroCommand();

if (!fs.existsSync(flowPath)) {
  console.error(`[native-upload-smoke] missing flow: ${path.relative(mobileRoot, flowPath)}`);
  process.exit(1);
}

if (options.platform !== 'android') {
  console.error('[native-upload-smoke] only --platform=android is wired in this runner today.');
  process.exit(1);
}

const commands = [
  ['static-native-upload-contract', []],
  ['node', ['scripts/check-platform-boundaries.mjs']],
  ['npx', ['jest', '--runInBand', 'src/platform/upload/native.test.js']],
  ['node', ['scripts/check-android-readiness.mjs', '--strict']],
  ['node', ['scripts/run-android-app-smoke.mjs', ...(options.skipBuild ? ['--skip-build'] : [])]],
  [maestroCommand, ['test', path.relative(mobileRoot, flowPath)]],
];

if (options.dryRun) {
  console.log(`[native-upload-smoke] dry-run platform=${options.platform}`);
  commands.forEach(([command, args]) => console.log(`- ${[command, ...args].join(' ')}`));
  process.exit(0);
}

const startedAt = new Date().toISOString();
const staticContract = verifyStaticContract(flowPath);
const platformBoundary = runCommand('node', ['scripts/check-platform-boundaries.mjs']);
const uploadUnit = runCommand('npx', ['jest', '--runInBand', 'src/platform/upload/native.test.js']);
const androidReadiness = runCommand('node', ['scripts/check-android-readiness.mjs', '--strict']);
let appRuntime = {
  command: 'node',
  args: ['scripts/run-android-app-smoke.mjs', ...(options.skipBuild ? ['--skip-build'] : [])],
  status: 1,
  signal: null,
  stdout: '',
  stderr: 'not run',
  duration_ms: 0,
};
let pickerFlow = {
  command: maestroCommand,
  args: ['test', path.relative(mobileRoot, flowPath)],
  status: 1,
  signal: null,
  stdout: '',
  stderr: 'not run',
  duration_ms: 0,
};

if (
  staticContract.status === 0 &&
  platformBoundary.status === 0 &&
  uploadUnit.status === 0 &&
  androidReadiness.status === 0
) {
  appRuntime = runCommand('node', ['scripts/run-android-app-smoke.mjs', ...(options.skipBuild ? ['--skip-build'] : [])], {
    env: withJavaEnv(),
  });
}

if (appRuntime.status === 0) {
  pickerFlow = runCommand(maestroCommand, ['test', path.relative(mobileRoot, flowPath)], {
    env: withJavaEnv(),
  });
}

const summary = {
  platform: options.platform,
  static_contract_passed: staticContract.status === 0,
  platform_boundary_passed: platformBoundary.status === 0,
  upload_unit_passed: uploadUnit.status === 0,
  android_readiness_passed: androidReadiness.status === 0,
  app_runtime_passed: appRuntime.status === 0,
  native_picker_cancel_flow_passed: pickerFlow.status === 0,
  blocked:
    staticContract.status !== 0 ||
    platformBoundary.status !== 0 ||
    uploadUnit.status !== 0 ||
    androidReadiness.status !== 0 ||
    appRuntime.status !== 0 ||
    pickerFlow.status !== 0,
};

const evidence = {
  type: 'app-native-upload-picker-smoke',
  platform: options.platform,
  app_android_package: app.android?.package,
  app_ios_bundle_identifier: app.ios?.bundleIdentifier,
  generated_at: new Date().toISOString(),
  started_at: startedAt,
  working_directory: mobileRoot,
  node_version: process.version,
  maestro_command: maestroCommand,
  flow: path.relative(mobileRoot, flowPath),
  summary,
  static_contract: {
    status: staticContract.status === 0 ? 'passed' : 'failed',
    ...summarizeCommand(staticContract),
  },
  platform_boundary: {
    status: platformBoundary.status === 0 ? 'passed' : 'failed',
    ...summarizeCommand(platformBoundary),
  },
  upload_unit: {
    status: uploadUnit.status === 0 ? 'passed' : 'failed',
    ...summarizeCommand(uploadUnit),
  },
  android_readiness: {
    status: androidReadiness.status === 0 ? 'passed' : 'failed',
    ...summarizeCommand(androidReadiness),
  },
  app_runtime: {
    status: appRuntime.status === 0 ? 'passed' : 'failed',
    ...summarizeCommand(appRuntime),
  },
  native_picker_cancel_flow: {
    status: pickerFlow.status === 0 ? 'passed' : 'failed',
    ...summarizeCommand(pickerFlow),
  },
};

const evidencePath = writeEvidence(evidence);
console.log(`[native-upload-smoke] evidence written: ${evidencePath}`);

if (summary.blocked) {
  console.error('[native-upload-smoke] failed: native upload picker smoke did not complete.');
  process.exit(1);
}

console.log('[native-upload-smoke] ok: native ImagePicker opened and returned to the App without creating a false upload success');
