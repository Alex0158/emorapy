import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getExpoProjectIdStatus } from './lib/release-app-config.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const strict = process.argv.includes('--strict');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(projectRoot, relativePath), 'utf8'));
}

function runCommand(command, args = [], options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function commandOutput(command, args = [], options = {}) {
  const result = runCommand(command, args, options);
  return result.status === 0 ? result.stdout.trim() : null;
}

function withJavaEnv(env = process.env) {
  const javaHome = '/opt/homebrew/opt/openjdk@17';
  if (!fs.existsSync(javaHome)) return env;
  return {
    ...env,
    JAVA_HOME: javaHome,
    PATH: `${path.join(javaHome, 'bin')}:${env.PATH ?? ''}`,
    MAESTRO_CLI_NO_ANALYTICS: '1',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
  };
}

function commandOutputFromCandidates(candidates, args = [], options = {}) {
  for (const command of candidates) {
    const result = runCommand(command, args, {
      ...options,
      env: withJavaEnv(options.env ?? process.env),
    });
    if (result.status === 0) {
      return { command, output: result.stdout.trim() };
    }
  }
  return null;
}

function parseSimulatorList(output) {
  if (!output) return [];
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('==') && !line.startsWith('--'));
}

function parseAvailableDevices(output) {
  return parseSimulatorList(output).filter((line) => /\([0-9A-F-]{36}\)\s+\((Booted|Shutdown)\)/i.test(line));
}

function parseIosRuntimes(output) {
  return parseSimulatorList(output).filter((line) => /^iOS\b/.test(line) && !/unavailable/i.test(line));
}

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

const app = readJson('app.json').expo ?? {};
const easProjectId = getExpoProjectIdStatus(app);
const blockers = [];
const warnings = [];
const info = [];

const activeDeveloperDir = commandOutput('xcode-select', ['-p']);
const xcodeDeveloperDir = '/Applications/Xcode.app/Contents/Developer';
const xcodeExists = fs.existsSync(xcodeDeveloperDir);
const developerDirOverride = process.env.DEVELOPER_DIR?.trim();
const effectiveDeveloperDir = developerDirOverride || activeDeveloperDir;
const effectiveDeveloperEnv = effectiveDeveloperDir
  ? { ...process.env, DEVELOPER_DIR: effectiveDeveloperDir }
  : process.env;

if (activeDeveloperDir) {
  info.push(`active developer dir: ${activeDeveloperDir}`);
} else {
  blockers.push('xcode-select is not available; iOS simulator smoke cannot run.');
}

if (developerDirOverride) {
  info.push(`DEVELOPER_DIR override: ${developerDirOverride}`);
}

if (xcodeExists) {
  const xcodeVersion = commandOutput('xcodebuild', ['-version'], {
    env: { ...process.env, DEVELOPER_DIR: xcodeDeveloperDir },
  });
  info.push(`full Xcode found: ${xcodeVersion?.replace(/\n/g, ', ') ?? xcodeDeveloperDir}`);
} else {
  blockers.push('full Xcode is not installed at /Applications/Xcode.app; iOS simulator smoke cannot run.');
}

if (activeDeveloperDir?.includes('/CommandLineTools') && !developerDirOverride) {
  blockers.push(`active developer directory is ${activeDeveloperDir}; use DEVELOPER_DIR=${xcodeDeveloperDir} or select full Xcode before native simulator evidence.`);
}

if (developerDirOverride && developerDirOverride !== xcodeDeveloperDir) {
  warnings.push(`DEVELOPER_DIR is set to ${developerDirOverride}; expected ${xcodeDeveloperDir} for the current native readiness baseline.`);
}

const activeSimctl = commandOutput('xcrun', ['--find', 'simctl'], { env: effectiveDeveloperEnv });
const xcodeEnv = xcodeExists ? { ...process.env, DEVELOPER_DIR: xcodeDeveloperDir } : process.env;
const xcodeSimctl = xcodeExists ? commandOutput('xcrun', ['--find', 'simctl'], { env: xcodeEnv }) : null;

if (activeSimctl) {
  info.push(`effective simctl: ${activeSimctl}`);
} else if (xcodeSimctl) {
  info.push(`simctl available through DEVELOPER_DIR override: ${xcodeSimctl}`);
} else {
  blockers.push('xcrun simctl is not available; iOS simulator/device smoke evidence cannot be generated.');
}

if (xcodeSimctl || activeSimctl) {
  const simctlEnv = xcodeSimctl ? xcodeEnv : process.env;
  const runtimes = parseIosRuntimes(commandOutput('xcrun', ['simctl', 'list', 'runtimes'], { env: simctlEnv }));
  const devices = parseAvailableDevices(commandOutput('xcrun', ['simctl', 'list', 'devices', 'available'], { env: simctlEnv }));

  if (runtimes.length > 0) {
    info.push(`iOS simulator runtimes: ${runtimes.slice(0, 3).join(' | ')}${runtimes.length > 3 ? ` (+${runtimes.length - 3} more)` : ''}`);
  } else {
    blockers.push('no available iOS simulator runtime is installed; install an iOS platform runtime in Xcode before simulator evidence.');
  }

  if (devices.length > 0) {
    info.push(`available iOS simulator devices: ${devices.slice(0, 3).join(' | ')}${devices.length > 3 ? ` (+${devices.length - 3} more)` : ''}`);
  } else {
    blockers.push('no available iOS simulator device exists; create/download one in Xcode before Maestro native execution.');
  }
}

const maestroCandidates = ['maestro'];
const homebrewMaestro = '/opt/homebrew/opt/maestro/bin/maestro';
if (fs.existsSync(homebrewMaestro)) {
  maestroCandidates.push(homebrewMaestro);
}
const maestroVersion = commandOutputFromCandidates(maestroCandidates, ['--version']);
if (maestroVersion) {
  info.push(`maestro: ${maestroVersion.output.split('\n').pop()} (${maestroVersion.command})`);
} else {
  blockers.push('Maestro CLI is not installed or not on PATH; native Maestro flow execution cannot run.');
}

const easVersion = commandOutput('eas', ['--version']);
if (easVersion) {
  info.push(`eas: ${easVersion}`);
} else {
  warnings.push('EAS CLI is not installed or not on PATH; EAS build evidence cannot be generated locally.');
}

if (!easProjectId.valid) {
  warnings.push('app.json has no UUID-shaped extra.eas.projectId; Expo push token retrieval and EAS Update URL remain setup tasks.');
}

if (!hasEnv('EXPO_TOKEN')) {
  warnings.push('EXPO_TOKEN is not set; CI EAS build cannot run non-interactively from this environment.');
}

if (!hasEnv('ASC_APPLE_ID') || !hasEnv('EXPO_APPLE_APP_SPECIFIC_PASSWORD')) {
  warnings.push('Apple submission credentials are incomplete; ASC_APPLE_ID and EXPO_APPLE_APP_SPECIFIC_PASSWORD must both be present for non-interactive submit.');
}

if (info.length > 0) {
  console.log('[native-readiness] info:');
  info.forEach((item) => console.log(`- ${item}`));
}

if (warnings.length > 0) {
  console.warn('[native-readiness] warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (blockers.length > 0) {
  console.warn('[native-readiness] blockers:');
  blockers.forEach((blocker) => console.warn(`- ${blocker}`));
  console.warn(`[native-readiness] ${strict ? 'failed' : 'not ready'}: native launch / Maestro execution evidence is blocked.`);
  if (strict) process.exit(1);
} else {
  console.log('[native-readiness] ok: local native launch and Maestro execution prerequisites are present');
}
