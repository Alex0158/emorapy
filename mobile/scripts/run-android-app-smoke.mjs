import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const options = {
  serial: process.env.APP_ANDROID_DEVICE_SERIAL || null,
  timeoutMs: Number(process.env.APP_ANDROID_APP_SMOKE_TIMEOUT_MS || 60000),
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
  skipBuild: process.argv.includes('--skip-build'),
};

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--serial=')) {
    options.serial = arg.slice('--serial='.length);
  } else if (arg.startsWith('--timeout-ms=')) {
    options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else if (arg === '--skip-build') {
    options.skipBuild = true;
  } else {
    console.error(`[android-app-smoke] unknown argument: ${arg}`);
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
    exit_code: result.status ?? 1,
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
  if (!javaHome) return env;
  return {
    ...env,
    JAVA_HOME: javaHome,
    PATH: `${path.join(javaHome, 'bin')}:${env.PATH ?? ''}`,
  };
}

function resolveAndroidTools() {
  const sdkRoot = firstExistingPath([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  ]);
  if (!sdkRoot) {
    throw new Error('Android SDK root was not found.');
  }

  return {
    sdkRoot,
    adb: path.join(sdkRoot, 'platform-tools', 'adb'),
  };
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function tail(text, max = 6000) {
  if (!text) return '';
  return text.length > max ? text.slice(text.length - max) : text;
}

function parseDevices(output) {
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

function getProperty(adbCommand, serial, property) {
  const result = adb(adbCommand, ['-s', serial, 'shell', 'getprop', property]);
  return result.exit_code === 0 ? result.stdout.trim() : '';
}

function resolveBootedSerial(adbCommand) {
  if (options.serial) return options.serial;
  const devices = parseDevices(adb(adbCommand, ['devices']).stdout);
  const booted = devices.find(
    (device) => device.state === 'device' && getProperty(adbCommand, device.serial, 'sys.boot_completed') === '1'
  );
  return booted?.serial ?? null;
}

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function packageIsInstalled(adbCommand, serial, packageName) {
  const result = adb(adbCommand, ['-s', serial, 'shell', 'pm', 'list', 'packages', packageName]);
  return result.exit_code === 0 && result.stdout.includes(`package:${packageName}`);
}

function resolveLaunchActivity(adbCommand, serial, packageName) {
  const result = adb(adbCommand, ['-s', serial, 'shell', 'cmd', 'package', 'resolve-activity', '--brief', packageName]);
  if (result.exit_code !== 0) return { result, activity: null };
  const activity = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .findLast((line) => line.startsWith(`${packageName}/`));
  return { result, activity: activity ?? null };
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-Android-App-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function summarizeCommand(commandResult) {
  return {
    command: commandResult.command,
    args: commandResult.args,
    exit_code: commandResult.exit_code,
    signal: commandResult.signal,
    duration_ms: commandResult.duration_ms,
    stdout_tail: tail(commandResult.stdout),
    stderr_tail: tail(commandResult.stderr),
  };
}

function ensureNativeProject(env) {
  const gradlewPath = path.join(mobileRoot, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  if (fs.existsSync(gradlewPath)) return null;

  return runCommand('npx', ['expo', 'prebuild', '--platform', 'android', '--non-interactive'], { env });
}

function buildReleaseApk(env) {
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

function main() {
  const startedAtMs = Date.now();
  const startedAt = new Date().toISOString();
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  const packageName = app.android?.package;
  if (!packageName) {
    throw new Error('app.json is missing expo.android.package.');
  }

  const tools = resolveAndroidTools();
  if (!fs.existsSync(tools.adb)) {
    throw new Error(`adb was not found at ${tools.adb}`);
  }

  const env = buildJavaEnv({
    ...process.env,
    ANDROID_HOME: tools.sdkRoot,
    ANDROID_SDK_ROOT: tools.sdkRoot,
  });

  const commandRecords = {};
  commandRecords.adb_start = adb(tools.adb, ['start-server']);

  const serial = resolveBootedSerial(tools.adb);
  if (!serial) {
    throw new Error('No booted Android device/emulator was found. Run android:emulator:smoke or boot an AVD first.');
  }

  if (!options.skipBuild) {
    const prebuild = ensureNativeProject(env);
    if (prebuild) {
      commandRecords.prebuild = prebuild;
      if (prebuild.exit_code !== 0) {
        throw new Error('Expo Android prebuild failed.');
      }
    }

    commandRecords.build = buildReleaseApk(env);
    if (commandRecords.build.exit_code !== 0) {
      throw new Error('Android release APK build failed.');
    }
  }

  const apkPath = path.join(mobileRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (!fs.existsSync(apkPath)) {
    throw new Error(`Android release APK was not found at ${apkPath}`);
  }

  commandRecords.install = adb(tools.adb, ['-s', serial, 'install', '-r', apkPath]);
  const installed = commandRecords.install.exit_code === 0 && packageIsInstalled(tools.adb, serial, packageName);

  const resolvedActivity = resolveLaunchActivity(tools.adb, serial, packageName);
  commandRecords.resolve_activity = resolvedActivity.result;
  const launchActivity = resolvedActivity.activity ?? `${packageName}/.MainActivity`;
  commandRecords.launch = adb(tools.adb, ['-s', serial, 'shell', 'am', 'start', '-n', launchActivity]);
  wait(5000);

  commandRecords.pidof = adb(tools.adb, ['-s', serial, 'shell', 'pidof', packageName]);
  commandRecords.activity = adb(tools.adb, ['-s', serial, 'shell', 'dumpsys', 'activity', 'activities']);
  commandRecords.window = adb(tools.adb, ['-s', serial, 'shell', 'dumpsys', 'window']);

  const activityOutput = commandRecords.activity.stdout;
  const windowOutput = commandRecords.window.stdout;
  const launched =
    commandRecords.launch.exit_code === 0 &&
    commandRecords.pidof.exit_code === 0 &&
    activityOutput.includes(`${packageName}/.MainActivity`) &&
    (activityOutput.includes('topResumedActivity') || activityOutput.includes('ResumedActivity')) &&
    windowOutput.includes(packageName);

  const record = {
    type: 'app-android-apk-install-launch-smoke',
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    working_directory: mobileRoot,
    node_version: process.version,
    app_android_package: packageName,
    device: {
      serial,
      boot_completed: getProperty(tools.adb, serial, 'sys.boot_completed'),
      build_version_release: getProperty(tools.adb, serial, 'ro.build.version.release'),
      build_version_sdk: getProperty(tools.adb, serial, 'ro.build.version.sdk'),
      product_model: getProperty(tools.adb, serial, 'ro.product.model'),
      product_cpu_abi: getProperty(tools.adb, serial, 'ro.product.cpu.abi'),
    },
    apk: {
      path: path.relative(repoRoot, apkPath),
      bytes: fs.statSync(apkPath).size,
      sha256: sha256File(apkPath),
    },
    launch: {
      activity: launchActivity,
      pid: commandRecords.pidof.stdout.trim(),
      top_activity_confirmed: activityOutput.includes(`${packageName}/.MainActivity`),
      focused_window_confirmed: windowOutput.includes(packageName),
    },
    build_policy: {
      local_smoke_sentry_auto_upload_disabled: true,
      formal_sentry_upload_still_requires_sentry_org_project_and_token: true,
    },
    summary: {
      built: options.skipBuild ? fs.existsSync(apkPath) : commandRecords.build?.exit_code === 0,
      installed,
      launched,
      blocked: !(installed && launched),
      duration_ms: Date.now() - startedAtMs,
    },
    commands: Object.fromEntries(
      Object.entries(commandRecords).map(([name, commandResult]) => [name, summarizeCommand(commandResult)])
    ),
  };

  const evidencePath = writeEvidence(record);
  console.log(`[android-app-smoke] evidence written: ${evidencePath}`);

  if (!installed || !launched) {
    console.error('[android-app-smoke] failed: release APK did not install and launch cleanly.');
    process.exit(1);
  }

  console.log(`[android-app-smoke] ok: ${packageName} installed and launched on ${serial}`);
}

try {
  main();
} catch (error) {
  const record = {
    type: 'app-android-apk-install-launch-smoke',
    generated_at: new Date().toISOString(),
    summary: {
      built: false,
      installed: false,
      launched: false,
      blocked: true,
      failure: error instanceof Error ? error.message : String(error),
    },
  };
  const evidencePath = writeEvidence(record);
  console.error(`[android-app-smoke] evidence written: ${evidencePath}`);
  console.error(`[android-app-smoke] failed: ${record.summary.failure}`);
  process.exit(1);
}
