import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const flowDir = path.join(mobileRoot, 'maestro');

const allFlows = fs
  .readdirSync(flowDir)
  .filter((entry) => entry.endsWith('.yaml'))
  .sort();

const options = {
  dryRun: false,
  selectedFlows: [],
  skipBuild: process.argv.includes('--skip-build'),
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--skip-build') {
    options.skipBuild = true;
  } else if (arg.startsWith('--flow=')) {
    options.selectedFlows.push(arg.slice('--flow='.length));
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else {
    console.error(`[android-maestro-smoke] unknown argument: ${arg}`);
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

function selectFlows() {
  if (options.selectedFlows.length === 0) return allFlows;
  const missing = options.selectedFlows.filter((flow) => !allFlows.includes(flow));
  if (missing.length > 0) {
    console.error(`[android-maestro-smoke] unknown flow(s): ${missing.join(', ')}`);
    console.error(`[android-maestro-smoke] available flows: ${allFlows.join(', ')}`);
    process.exit(1);
  }
  return options.selectedFlows;
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-Android-Maestro-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
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

const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
const appId = app.android?.package;
const flows = selectFlows();
const maestroCommand = resolveMaestroCommand();

if (!appId) {
  console.error('[android-maestro-smoke] app.json expo.android.package is required.');
  process.exit(1);
}

const commands = [
  ['node', ['scripts/check-maestro-flows.mjs']],
  ['node', ['scripts/check-android-readiness.mjs', '--strict']],
  ['node', ['scripts/run-android-app-smoke.mjs', ...(options.skipBuild ? ['--skip-build'] : [])]],
  ...flows.map((flow) => [maestroCommand, ['test', path.join('maestro', flow)]]),
];

if (options.dryRun) {
  console.log(`[android-maestro-smoke] dry-run appId=${appId}`);
  commands.forEach(([command, args]) => console.log(`- ${[command, ...args].join(' ')}`));
  process.exit(0);
}

const startedAt = new Date().toISOString();
const staticGate = runCommand('node', ['scripts/check-maestro-flows.mjs']);
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
const flowResults = [];

if (staticGate.status === 0 && androidReadiness.status === 0) {
  appRuntime = runCommand('node', ['scripts/run-android-app-smoke.mjs', ...(options.skipBuild ? ['--skip-build'] : [])], {
    env: withJavaEnv(),
  });
}

if (staticGate.status === 0 && androidReadiness.status === 0 && appRuntime.status === 0) {
  for (const flow of flows) {
    const result = runCommand(maestroCommand, ['test', path.join('maestro', flow)], {
      env: withJavaEnv(),
    });
    flowResults.push({
      flow,
      status: result.status === 0 ? 'passed' : 'failed',
      exit_code: result.status,
      signal: result.signal,
      duration_ms: result.duration_ms,
      stdout_tail: tail(result.stdout),
      stderr_tail: tail(result.stderr),
    });
    if (result.status !== 0) break;
  }
}

const summary = {
  requested_flows: flows.length,
  passed_flows: flowResults.filter((flow) => flow.status === 'passed').length,
  failed_flows: flowResults.filter((flow) => flow.status === 'failed').length,
  blocked:
    staticGate.status !== 0 ||
    androidReadiness.status !== 0 ||
    appRuntime.status !== 0 ||
    flowResults.some((flow) => flow.status === 'failed') ||
    flowResults.length !== flows.length,
};

const evidence = {
  type: 'app-android-maestro-execution',
  app_android_package: appId,
  generated_at: new Date().toISOString(),
  started_at: startedAt,
  working_directory: mobileRoot,
  node_version: process.version,
  maestro_command: maestroCommand,
  summary,
  static_gate: {
    status: staticGate.status === 0 ? 'passed' : 'failed',
    ...summarizeCommand(staticGate),
  },
  android_readiness: {
    status: androidReadiness.status === 0 ? 'passed' : 'failed',
    ...summarizeCommand(androidReadiness),
  },
  app_runtime: {
    status: appRuntime.status === 0 ? 'passed' : 'failed',
    ...summarizeCommand(appRuntime),
  },
  flows: flowResults,
};

const evidencePath = writeEvidence(evidence);
console.log(`[android-maestro-smoke] evidence written: ${evidencePath}`);

if (summary.blocked) {
  console.error('[android-maestro-smoke] failed: Android Maestro smoke did not complete.');
  process.exit(1);
}

console.log(`[android-maestro-smoke] ok: ${summary.passed_flows}/${summary.requested_flows} flow(s) passed`);
