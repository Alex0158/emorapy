import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseXctracePhysicalDevices } from './lib/release-device-discovery.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const options = {
  platform: process.env.APP_PHYSICAL_DEVICE_PLATFORM || 'ios',
  device: process.env.APP_PHYSICAL_DEVICE_ID || process.env.APP_IOS_DEVICE_UDID || process.env.APP_ANDROID_DEVICE_SERIAL || null,
  appPath: process.env.APP_IOS_DEVICE_APP_PATH || null,
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
  flow: '00-public-navigation-smoke.yaml',
  dryRun: false,
  skipBuild: false,
  skipInstall: false,
  skipLaunch: false,
  skipMaestro: false,
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--skip-build') {
    options.skipBuild = true;
  } else if (arg === '--skip-install') {
    options.skipInstall = true;
  } else if (arg === '--skip-launch') {
    options.skipLaunch = true;
  } else if (arg === '--skip-maestro') {
    options.skipMaestro = true;
  } else if (arg.startsWith('--platform=')) {
    options.platform = arg.slice('--platform='.length);
  } else if (arg.startsWith('--device=')) {
    options.device = arg.slice('--device='.length);
  } else if (arg.startsWith('--app-path=')) {
    options.appPath = path.resolve(process.cwd(), arg.slice('--app-path='.length));
  } else if (arg.startsWith('--flow=')) {
    options.flow = arg.slice('--flow='.length);
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else {
    console.error(`[physical-device-smoke] unknown argument: ${arg}`);
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

function firstExistingPath(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

function buildJavaEnv(env = process.env) {
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
  return runCommand(command, args, { env: buildJavaEnv() }).status === 0;
}

function resolveMaestroCommand() {
  const candidates = [];
  const homebrewMaestro = '/opt/homebrew/opt/maestro/bin/maestro';
  if (fs.existsSync(homebrewMaestro)) candidates.push(homebrewMaestro);
  candidates.push('maestro');
  return candidates.find((candidate) => commandSucceeds(candidate, ['--version'])) ?? 'maestro';
}

function tail(text, max = 6000, sensitive = []) {
  if (!text) return '';
  let value = text.length > max ? text.slice(text.length - max) : text;
  for (const item of sensitive.filter(Boolean)) {
    value = value.split(item).join('<device>');
  }
  return value;
}

function hashIdentifier(value) {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex');
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function sha256Path(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');
  }

  if (stat.isDirectory()) {
    const hash = createHash('sha256');
    const root = targetPath;
    const visit = (directory) => {
      const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        const relativePath = path.relative(root, entryPath);
        hash.update(relativePath);
        if (entry.isDirectory()) {
          visit(entryPath);
        } else if (entry.isFile()) {
          hash.update(fs.readFileSync(entryPath));
        }
      }
    };
    visit(root);
    return hash.digest('hex');
  }

  throw new Error(`Cannot hash unsupported path type: ${targetPath}`);
}

function byteSizePath(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return stat.size;
  if (stat.isDirectory()) {
    return fs
      .readdirSync(targetPath, { withFileTypes: true })
      .reduce((total, entry) => total + byteSizePath(path.join(targetPath, entry.name)), 0);
  }
  return 0;
}

function summarizeCommand(result, sensitive = []) {
  return {
    command: result.command,
    args: result.args.map((arg) => (sensitive.includes(arg) ? '<device>' : arg)),
    exit_code: result.status,
    signal: result.signal,
    duration_ms: result.duration_ms,
    stdout_tail: tail(result.stdout, 6000, sensitive),
    stderr_tail: tail(result.stderr, 6000, sensitive),
  };
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-Physical-Device-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function parseAdbDevices(output) {
  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return { serial, state };
    });
}

function adb(adbCommand, args = []) {
  return runCommand(adbCommand, args);
}

function getAndroidProperty(adbCommand, serial, property) {
  const result = adb(adbCommand, ['-s', serial, 'shell', 'getprop', property]);
  return result.status === 0 ? result.stdout.trim() : '';
}

function resolveAndroidTools() {
  const sdkRoot = firstExistingPath([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  ]);
  if (!sdkRoot) throw new Error('Android SDK root was not found.');

  const adbPath = path.join(sdkRoot, 'platform-tools', 'adb');
  if (!fs.existsSync(adbPath)) throw new Error(`adb was not found at ${adbPath}`);

  return { sdkRoot, adb: adbPath };
}

function resolveAndroidPhysicalDevice(adbCommand) {
  const devices = parseAdbDevices(adb(adbCommand, ['devices']).stdout).filter((device) => device.state === 'device');
  const candidates = options.device ? devices.filter((device) => device.serial === options.device) : devices;

  for (const device of candidates) {
    const qemu = getAndroidProperty(adbCommand, device.serial, 'ro.kernel.qemu');
    const bootCompleted = getAndroidProperty(adbCommand, device.serial, 'sys.boot_completed');
    const isPhysical = qemu !== '1' && !device.serial.startsWith('emulator-');
    if (isPhysical && bootCompleted === '1') {
      return {
        serial: device.serial,
        qemu,
        bootCompleted,
        model: getAndroidProperty(adbCommand, device.serial, 'ro.product.model'),
        manufacturer: getAndroidProperty(adbCommand, device.serial, 'ro.product.manufacturer'),
        release: getAndroidProperty(adbCommand, device.serial, 'ro.build.version.release'),
        sdk: getAndroidProperty(adbCommand, device.serial, 'ro.build.version.sdk'),
        abi: getAndroidProperty(adbCommand, device.serial, 'ro.product.cpu.abi'),
      };
    }
  }

  if (options.device && devices.length > 0) {
    throw new Error('Requested Android device is connected, but it is not a booted physical device.');
  }
  throw new Error('No booted Android physical device was found through adb. Emulators do not satisfy physical-device release evidence.');
}

function ensureAndroidNativeProject(env) {
  const gradlewPath = path.join(mobileRoot, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  if (fs.existsSync(gradlewPath)) return null;
  return runCommand('npx', ['expo', 'prebuild', '--platform', 'android', '--non-interactive'], { env });
}

function buildAndroidReleaseApk(env) {
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  return runCommand(gradlew, [':app:assembleRelease', '--no-daemon'], {
    cwd: path.join(mobileRoot, 'android'),
    env: {
      ...env,
      NODE_ENV: 'production',
      SENTRY_DISABLE_AUTO_UPLOAD: env.SENTRY_DISABLE_AUTO_UPLOAD ?? 'true',
    },
  });
}

function packageIsInstalled(adbCommand, serial, packageName) {
  const result = adb(adbCommand, ['-s', serial, 'shell', 'pm', 'list', 'packages', packageName]);
  return result.status === 0 && result.stdout.includes(`package:${packageName}`);
}

function resolveAndroidLaunchActivity(adbCommand, serial, packageName) {
  const result = adb(adbCommand, ['-s', serial, 'shell', 'cmd', 'package', 'resolve-activity', '--brief', packageName]);
  const lines = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();
  return {
    result,
    activity: lines.find((line) => line.startsWith(`${packageName}/`)) ?? `${packageName}/.MainActivity`,
  };
}

function runAndroidPhysicalSmoke(app, flowPath, maestroCommand) {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const packageName = app.android?.package;
  if (!packageName) throw new Error('app.json is missing expo.android.package.');

  const commands = {};
  commands.static_gate = runCommand('node', ['scripts/check-maestro-flows.mjs']);
  commands.android_readiness = runCommand('node', ['scripts/check-android-readiness.mjs', '--strict']);

  const tools = resolveAndroidTools();
  const env = buildJavaEnv({
    ...process.env,
    ANDROID_HOME: tools.sdkRoot,
    ANDROID_SDK_ROOT: tools.sdkRoot,
  });
  commands.adb_start = adb(tools.adb, ['start-server']);
  const device = resolveAndroidPhysicalDevice(tools.adb);
  const sensitive = [device.serial];

  if (!options.skipBuild) {
    const prebuild = ensureAndroidNativeProject(env);
    if (prebuild) {
      commands.prebuild = prebuild;
      if (prebuild.status !== 0) throw new Error('Expo Android prebuild failed.');
    }

    commands.build = buildAndroidReleaseApk(env);
    if (commands.build.status !== 0) throw new Error('Android release APK build failed.');
  }

  const apkPath = path.join(mobileRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (!fs.existsSync(apkPath)) throw new Error(`Android release APK was not found at ${apkPath}`);

  let installed = packageIsInstalled(tools.adb, device.serial, packageName);
  if (!options.skipInstall) {
    commands.install = adb(tools.adb, ['-s', device.serial, 'install', '-r', apkPath]);
    installed = commands.install.status === 0 && packageIsInstalled(tools.adb, device.serial, packageName);
  }

  let launched = false;
  let launchActivity = `${packageName}/.MainActivity`;
  if (!options.skipLaunch && installed) {
    const resolvedActivity = resolveAndroidLaunchActivity(tools.adb, device.serial, packageName);
    commands.resolve_activity = resolvedActivity.result;
    launchActivity = resolvedActivity.activity;
    commands.launch = adb(tools.adb, ['-s', device.serial, 'shell', 'am', 'start', '-n', launchActivity]);
    wait(5000);
    commands.pidof = adb(tools.adb, ['-s', device.serial, 'shell', 'pidof', packageName]);
    commands.activity = adb(tools.adb, ['-s', device.serial, 'shell', 'dumpsys', 'activity', 'activities']);
    commands.window = adb(tools.adb, ['-s', device.serial, 'shell', 'dumpsys', 'window']);
    launched =
      commands.launch.status === 0 &&
      commands.pidof.status === 0 &&
      commands.activity.stdout.includes(`${packageName}/.MainActivity`) &&
      (commands.activity.stdout.includes('topResumedActivity') || commands.activity.stdout.includes('ResumedActivity')) &&
      commands.window.stdout.includes(packageName);
  }

  let maestroFlow = {
    command: maestroCommand,
    args: ['test', '--device', device.serial, '-p', 'android', path.relative(mobileRoot, flowPath)],
    status: 1,
    signal: null,
    stdout: '',
    stderr: 'not run',
    duration_ms: 0,
  };
  if (!options.skipMaestro && launched) {
    maestroFlow = runCommand(maestroCommand, ['test', '--device', device.serial, '-p', 'android', path.relative(mobileRoot, flowPath)], {
      env: buildJavaEnv(),
    });
  }
  commands.maestro_flow = maestroFlow;

  const maestroPassed = !options.skipMaestro && maestroFlow.status === 0;
  const summary = {
    platform: 'android',
    device_connected: true,
    device_is_physical: true,
    static_gate_passed: commands.static_gate.status === 0,
    platform_readiness_passed: commands.android_readiness.status === 0,
    app_runtime_passed: installed && launched,
    maestro_smoke_passed: maestroPassed,
    maestro_smoke_required_for_release: true,
    blocked:
      commands.static_gate.status !== 0 ||
      commands.android_readiness.status !== 0 ||
      !installed ||
      !launched ||
      !maestroPassed,
    duration_ms: Date.now() - startedAtMs,
  };

  return {
    type: 'app-physical-device-smoke',
    platform: 'android',
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    working_directory: mobileRoot,
    node_version: process.version,
    app_android_package: packageName,
    app_ios_bundle_identifier: app.ios?.bundleIdentifier,
    flow: path.relative(mobileRoot, flowPath),
    device: {
      identifier_sha256: hashIdentifier(device.serial),
      serial_redacted: true,
      is_physical: true,
      boot_completed: device.bootCompleted,
      manufacturer: device.manufacturer,
      model: device.model,
      android_release: device.release,
      android_sdk: device.sdk,
      cpu_abi: device.abi,
      emulator_property_qemu: device.qemu,
    },
    apk: {
      path: path.relative(repoRoot, apkPath),
      bytes: fs.statSync(apkPath).size,
      sha256: sha256Path(apkPath),
    },
    launch: {
      activity: launchActivity,
      skipped: options.skipLaunch,
    },
    summary,
    commands: Object.fromEntries(
      Object.entries(commands).map(([name, result]) => [name, summarizeCommand(result, sensitive)])
    ),
  };
}

function resolveIosDevice(xcodeEnv) {
  const result = runCommand('xcrun', ['xctrace', 'list', 'devices'], { env: xcodeEnv });
  if (result.status !== 0) throw new Error('Unable to inspect connected iOS devices through xcrun xctrace.');
  const connected = parseXctracePhysicalDevices(result.stdout);
  if (options.device) {
    const requested = connected.find((device) => device.identifier === options.device);
    if (!requested) {
      throw new Error('Requested iOS device is not a connected physical device in xcrun xctrace. Use the physical device UDID after connecting, unlocking, and trusting the device.');
    }
    return requested;
  }
  if (connected.length === 0) {
    throw new Error('No connected iOS physical device was found. Set APP_IOS_DEVICE_UDID or pass --device=<udid> after connecting and trusting an iPhone.');
  }
  return connected[0];
}

function runIosPhysicalSmoke(app, flowPath, maestroCommand) {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const bundleIdentifier = app.ios?.bundleIdentifier;
  if (!bundleIdentifier) throw new Error('app.json is missing expo.ios.bundleIdentifier.');

  const xcodeDeveloperDir = '/Applications/Xcode.app/Contents/Developer';
  const xcodeEnv = { ...process.env, DEVELOPER_DIR: process.env.DEVELOPER_DIR || xcodeDeveloperDir };
  const commands = {};
  commands.static_gate = runCommand('node', ['scripts/check-maestro-flows.mjs']);
  commands.native_readiness = runCommand('node', ['scripts/check-native-readiness.mjs', '--strict'], { env: xcodeEnv });

  const device = resolveIosDevice(xcodeEnv);
  const sensitive = [device.identifier];
  const hasAppPath = Boolean(options.appPath && fs.existsSync(options.appPath));

  let installed = options.skipInstall;
  if (!options.skipInstall) {
    if (!hasAppPath) {
      throw new Error('iOS physical smoke requires --app-path=<signed .app> or --skip-install when the App is already installed.');
    }
    commands.install = runCommand('xcrun', ['devicectl', 'device', 'install', 'app', '--device', device.identifier, options.appPath], {
      env: xcodeEnv,
    });
    installed = commands.install.status === 0;
  }

  let launched = options.skipLaunch;
  if (!options.skipLaunch && installed) {
    commands.launch = runCommand(
      'xcrun',
      ['devicectl', 'device', 'process', 'launch', '--device', device.identifier, '--terminate-existing', bundleIdentifier],
      { env: xcodeEnv }
    );
    launched = commands.launch.status === 0;
  }

  let maestroFlow = {
    command: maestroCommand,
    args: ['test', '--device', device.identifier, '-p', 'ios', path.relative(mobileRoot, flowPath)],
    status: 1,
    signal: null,
    stdout: '',
    stderr: 'not run',
    duration_ms: 0,
  };
  if (!options.skipMaestro && launched) {
    maestroFlow = runCommand(maestroCommand, ['test', '--device', device.identifier, '-p', 'ios', path.relative(mobileRoot, flowPath)], {
      env: buildJavaEnv(xcodeEnv),
    });
  }
  commands.maestro_flow = maestroFlow;

  const maestroPassed = !options.skipMaestro && maestroFlow.status === 0;
  const summary = {
    platform: 'ios',
    device_connected: true,
    device_is_physical: true,
    static_gate_passed: commands.static_gate.status === 0,
    platform_readiness_passed: commands.native_readiness.status === 0,
    app_runtime_passed: installed && launched,
    maestro_smoke_passed: maestroPassed,
    maestro_smoke_required_for_release: true,
    blocked:
      commands.static_gate.status !== 0 ||
      commands.native_readiness.status !== 0 ||
      !installed ||
      !launched ||
      !maestroPassed,
    duration_ms: Date.now() - startedAtMs,
  };

  return {
    type: 'app-physical-device-smoke',
    platform: 'ios',
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    working_directory: mobileRoot,
    node_version: process.version,
    app_android_package: app.android?.package,
    app_ios_bundle_identifier: bundleIdentifier,
    flow: path.relative(mobileRoot, flowPath),
    device: {
      identifier_sha256: hashIdentifier(device.identifier),
      udid_redacted: true,
      is_physical: true,
      name: device.name,
      state: device.state,
    },
    ios_app: {
      install_skipped: options.skipInstall,
      app_path: hasAppPath ? path.relative(repoRoot, options.appPath) : null,
      bytes: hasAppPath ? byteSizePath(options.appPath) : null,
      sha256: hasAppPath ? sha256Path(options.appPath) : null,
    },
    summary,
    commands: Object.fromEntries(
      Object.entries(commands).map(([name, result]) => [name, summarizeCommand(result, sensitive)])
    ),
  };
}

function dryRun(app, flowPath, maestroCommand) {
  const commands =
    options.platform === 'android'
      ? [
          ['node', ['scripts/check-maestro-flows.mjs']],
          ['node', ['scripts/check-android-readiness.mjs', '--strict']],
          ['adb', ['devices']],
          ['gradle', [':app:assembleRelease']],
          ['adb', ['install', '-r', 'android/app/build/outputs/apk/release/app-release.apk']],
          [maestroCommand, ['test', '--device', '<physical-device>', '-p', 'android', path.relative(mobileRoot, flowPath)]],
        ]
      : [
          ['node', ['scripts/check-maestro-flows.mjs']],
          ['node', ['scripts/check-native-readiness.mjs', '--strict']],
          ['xcrun', ['xctrace', 'list', 'devices']],
          ['xcrun', ['devicectl', 'device', 'install', 'app', '--device', '<ios-device>', options.appPath ?? '<signed .app>']],
          ['xcrun', ['devicectl', 'device', 'process', 'launch', '--device', '<ios-device>', app.ios?.bundleIdentifier ?? '<bundle-id>']],
          [maestroCommand, ['test', '--device', '<ios-device>', '-p', 'ios', path.relative(mobileRoot, flowPath)]],
        ];

  console.log(`[physical-device-smoke] dry-run platform=${options.platform}`);
  commands.forEach(([command, args]) => console.log(`- ${[command, ...args].join(' ')}`));
}

function main() {
  if (!['android', 'ios'].includes(options.platform)) {
    throw new Error('--platform must be android or ios.');
  }

  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  const flowPath = path.join(mobileRoot, 'maestro', options.flow);
  if (!fs.existsSync(flowPath)) throw new Error(`Maestro flow was not found: ${path.relative(mobileRoot, flowPath)}`);

  const maestroCommand = resolveMaestroCommand();

  if (options.dryRun) {
    dryRun(app, flowPath, maestroCommand);
    return null;
  }

  return options.platform === 'android'
    ? runAndroidPhysicalSmoke(app, flowPath, maestroCommand)
    : runIosPhysicalSmoke(app, flowPath, maestroCommand);
}

try {
  const evidence = main();
  if (!evidence) process.exit(0);

  const evidencePath = writeEvidence(evidence);
  console.log(`[physical-device-smoke] evidence written: ${evidencePath}`);

  if (evidence.summary.blocked) {
    console.error('[physical-device-smoke] failed: physical device smoke did not complete.');
    process.exit(1);
  }

  console.log(`[physical-device-smoke] ok: ${evidence.platform} physical device smoke passed`);
} catch (error) {
  const app = fs.existsSync(path.join(mobileRoot, 'app.json'))
    ? readJson(path.join(mobileRoot, 'app.json')).expo ?? {}
    : {};
  const record = {
    type: 'app-physical-device-smoke',
    platform: options.platform,
    generated_at: new Date().toISOString(),
    app_android_package: app.android?.package,
    app_ios_bundle_identifier: app.ios?.bundleIdentifier,
    summary: {
      platform: options.platform,
      device_connected: false,
      device_is_physical: false,
      static_gate_passed: false,
      platform_readiness_passed: false,
      app_runtime_passed: false,
      maestro_smoke_passed: false,
      maestro_smoke_required_for_release: true,
      blocked: true,
      failure: error instanceof Error ? error.message : String(error),
    },
  };
  const evidencePath = writeEvidence(record);
  console.error(`[physical-device-smoke] evidence written: ${evidencePath}`);
  console.error(`[physical-device-smoke] failed: ${record.summary.failure}`);
  process.exit(1);
}
