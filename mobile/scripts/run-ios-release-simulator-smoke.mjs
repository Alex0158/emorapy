import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const options = {
  deviceName: process.env.APP_IOS_SIMULATOR_NAME || 'iPhone 17',
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
  skipPrebuild: process.argv.includes('--skip-prebuild'),
};

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--device=')) {
    options.deviceName = arg.slice('--device='.length);
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else if (arg === '--skip-prebuild') {
    options.skipPrebuild = true;
  } else {
    console.error(`[ios-release-simulator-smoke] unknown argument: ${arg}`);
    process.exit(1);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function firstExistingPath(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

function buildEnv() {
  const developerDir = firstExistingPath([
    process.env.DEVELOPER_DIR,
    '/Applications/Xcode.app/Contents/Developer',
  ]);
  return {
    ...process.env,
    ...(developerDir ? { DEVELOPER_DIR: developerDir } : {}),
    SENTRY_DISABLE_AUTO_UPLOAD: process.env.SENTRY_DISABLE_AUTO_UPLOAD ?? 'true',
  };
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
    exit_code: result.status ?? 1,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    duration_ms: Date.now() - startedAt,
  };
}

function tail(text, max = 6000) {
  if (!text) return '';
  return text.length > max ? text.slice(text.length - max) : text;
}

function summarizeCommand(result) {
  return {
    command: result.command,
    args: result.args,
    exit_code: result.exit_code,
    signal: result.signal,
    duration_ms: result.duration_ms,
    stdout_tail: tail(result.stdout),
    stderr_tail: tail(result.stderr),
  };
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-iOS-Release-Simulator-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function getSimulatorByName(name, env) {
  const result = runCommand('xcrun', ['simctl', 'list', 'devices', '--json'], { env });
  if (result.exit_code !== 0) return { result, simulator: null };
  const parsed = JSON.parse(result.stdout);
  for (const [runtime, devices] of Object.entries(parsed.devices ?? {})) {
    const simulator = devices.find((device) => device.name === name && device.isAvailable !== false);
    if (simulator) return { result, simulator: { ...simulator, runtime } };
  }
  return { result, simulator: null };
}

function getBootedSimulator(name, env) {
  const result = runCommand('xcrun', ['simctl', 'list', 'devices', '--json'], { env });
  if (result.exit_code !== 0) return { result, simulator: null };
  const parsed = JSON.parse(result.stdout);
  for (const [runtime, devices] of Object.entries(parsed.devices ?? {})) {
    const simulator = devices.find(
      (device) => device.name === name && device.state === 'Booted' && device.isAvailable !== false
    );
    if (simulator) return { result, simulator: { ...simulator, runtime } };
  }
  return { result, simulator: null };
}

function hasSentryBuildPhases() {
  const projectPath = path.join(mobileRoot, 'ios', 'Emorapy.xcodeproj', 'project.pbxproj');
  if (!fs.existsSync(projectPath)) return false;
  const source = fs.readFileSync(projectPath, 'utf8');
  return source.includes('sentry-xcode.sh') && source.includes('Upload Debug Symbols to Sentry');
}

function readPackageVersions() {
  const packageJson = readJson(path.join(mobileRoot, 'package.json'));
  const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  return {
    'expo-notifications': deps['expo-notifications'] ?? null,
    'react-native': deps['react-native'] ?? null,
    'react-native-worklets': deps['react-native-worklets'] ?? null,
    '@sentry/react-native': deps['@sentry/react-native'] ?? null,
  };
}

function main() {
  const startedAt = new Date().toISOString();
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  const env = buildEnv();
  const commands = {};

  const simulatorBefore = getSimulatorByName(options.deviceName, env);
  commands.simulator_list_before = simulatorBefore.result;
  if (!simulatorBefore.simulator) {
    throw new Error(`iOS simulator ${options.deviceName} was not found.`);
  }

  if (!options.skipPrebuild) {
    commands.prebuild = runCommand(
      'npx',
      ['expo', 'prebuild', '--platform', 'ios', '--clean', '--no-install'],
      { env }
    );
  }

  commands.expo_install_check = runCommand('npx', ['expo', 'install', '--check'], { env });

  if ((!commands.prebuild || commands.prebuild.exit_code === 0) && commands.expo_install_check.exit_code === 0) {
    commands.release_build = runCommand(
      'npx',
      ['expo', 'run:ios', '--configuration', 'Release', '--device', options.deviceName, '--no-bundler'],
      { env }
    );
  } else {
    commands.release_build = {
      command: 'npx',
      args: ['expo', 'run:ios', '--configuration', 'Release', '--device', options.deviceName, '--no-bundler'],
      exit_code: 1,
      signal: null,
      stdout: '',
      stderr: commands.prebuild?.exit_code !== 0 ? 'not run because prebuild failed' : 'not run because expo install check failed',
      duration_ms: 0,
    };
  }

  const simulatorAfter = getBootedSimulator(options.deviceName, env);
  commands.simulator_list_after = simulatorAfter.result;
  const simulator = simulatorAfter.simulator ?? simulatorBefore.simulator;
  const udid = simulator?.udid ?? null;

  commands.get_app_container = udid
    ? runCommand('xcrun', ['simctl', 'get_app_container', udid, app.ios?.bundleIdentifier, 'app'], { env })
    : {
        command: 'xcrun',
        args: ['simctl', 'get_app_container', options.deviceName, app.ios?.bundleIdentifier, 'app'],
        exit_code: 1,
        signal: null,
        stdout: '',
        stderr: 'simulator udid unavailable',
        duration_ms: 0,
      };

  commands.simulator_launch = udid
    ? runCommand('xcrun', ['simctl', 'launch', udid, app.ios?.bundleIdentifier], { env })
    : {
        command: 'xcrun',
        args: ['simctl', 'launch', options.deviceName, app.ios?.bundleIdentifier],
        exit_code: 1,
        signal: null,
        stdout: '',
        stderr: 'simulator udid unavailable',
        duration_ms: 0,
      };

  const sentryPhasesPresent = hasSentryBuildPhases();
  const appContainerPath = commands.get_app_container.stdout.trim();
  const simulatorInstalled = commands.get_app_container.exit_code === 0 && appContainerPath.endsWith('.app');
  const simulatorLaunched = commands.simulator_launch.exit_code === 0;
  const prebuildPassed = !commands.prebuild || commands.prebuild.exit_code === 0;
  const dependencyPassed = commands.expo_install_check.exit_code === 0;
  const buildPassed = commands.release_build.exit_code === 0;
  const passed = prebuildPassed && dependencyPassed && buildPassed && sentryPhasesPresent && simulatorInstalled && simulatorLaunched;

  const evidence = {
    schema: 'cj.app.ios_release_simulator_evidence.v1',
    created_at: new Date().toISOString(),
    status: passed ? 'passed' : 'blocked',
    scope: 'iOS Release simulator build, install, and launch',
    command: `SENTRY_DISABLE_AUTO_UPLOAD=true DEVELOPER_DIR=${env.DEVELOPER_DIR ?? ''} npx expo run:ios --configuration Release --device "${options.deviceName}" --no-bundler`,
    working_directory: 'mobile',
    platform: {
      os: 'ios',
      runtime: simulator?.runtime ?? null,
      simulator_name: options.deviceName,
      simulator_udid: udid,
    },
    app: {
      bundle_identifier: app.ios?.bundleIdentifier ?? null,
      version: app.version ?? null,
      build_number: app.ios?.buildNumber ?? null,
      configuration: 'Release',
      artifact_kind: appContainerPath ? path.basename(appContainerPath) : 'Release-iphonesimulator app',
    },
    dependency_alignment: {
      expo_install_check: commands.expo_install_check.exit_code === 0 ? 'passed' : 'failed',
      key_versions: readPackageVersions(),
    },
    checks: [
      { name: 'cocoapods_install', status: fs.existsSync(path.join(mobileRoot, 'ios', 'Pods', 'Manifest.lock')) ? 'passed' : 'failed' },
      { name: 'metro_bundle', status: buildPassed ? 'passed' : 'failed' },
      { name: 'xcode_release_build', status: buildPassed ? 'passed' : 'failed' },
      { name: 'sentry_xcode_bundle_phase', status: sentryPhasesPresent ? 'passed' : 'failed' },
      { name: 'sentry_debug_symbols_phase', status: sentryPhasesPresent ? 'passed' : 'failed' },
      { name: 'simulator_install', status: simulatorInstalled ? 'passed' : 'failed' },
      { name: 'simulator_launch', status: simulatorLaunched ? 'passed' : 'failed' },
    ],
    warnings: [
      'SENTRY_DISABLE_AUTO_UPLOAD=true was used so local simulator evidence does not require provider credentials.',
      'This simulator evidence does not replace EAS iOS, TestFlight, physical device, provider delivery, or native crash runtime evidence.',
    ],
    commands: Object.fromEntries(
      Object.entries(commands).map(([name, result]) => [name, summarizeCommand(result)])
    ),
    summary: {
      prebuild_passed: prebuildPassed,
      dependency_alignment_passed: dependencyPassed,
      release_build_passed: buildPassed,
      sentry_phases_present: sentryPhasesPresent,
      simulator_installed: simulatorInstalled,
      simulator_launched: simulatorLaunched,
    },
    does_not_replace: [
      'EAS iOS production store build evidence',
      'TestFlight App Store Connect evidence',
      'physical device smoke evidence',
      'APNs or Expo provider delivery evidence',
      'native crash runtime evidence',
      'release or production DB parity evidence',
    ],
  };

  const evidencePath = writeEvidence(evidence);
  console.log(`[ios-release-simulator-smoke] evidence written: ${evidencePath}`);

  if (!passed) {
    console.error('[ios-release-simulator-smoke] failed: iOS Release simulator smoke did not complete.');
    process.exit(1);
  }

  console.log(`[ios-release-simulator-smoke] ok: ${app.ios?.bundleIdentifier} installed and launched on ${options.deviceName}`);
}

try {
  main();
} catch (error) {
  const record = {
    schema: 'cj.app.ios_release_simulator_evidence.v1',
    created_at: new Date().toISOString(),
    status: 'blocked',
    scope: 'iOS Release simulator build, install, and launch',
    working_directory: 'mobile',
    platform: {
      os: 'ios',
      simulator_name: options.deviceName,
    },
    app: {},
    dependency_alignment: {
      expo_install_check: 'failed',
    },
    checks: [],
    summary: {
      failure: error instanceof Error ? error.message : String(error),
    },
    does_not_replace: [
      'EAS iOS production store build evidence',
      'TestFlight App Store Connect evidence',
      'physical device smoke evidence',
      'APNs or Expo provider delivery evidence',
      'native crash runtime evidence',
      'release or production DB parity evidence',
    ],
  };
  const evidencePath = writeEvidence(record);
  console.error(`[ios-release-simulator-smoke] evidence written: ${evidencePath}`);
  console.error(`[ios-release-simulator-smoke] failed: ${record.summary.failure}`);
  process.exit(1);
}
