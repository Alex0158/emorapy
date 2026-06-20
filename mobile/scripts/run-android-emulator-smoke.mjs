import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const defaultAvdName = 'Emorapy_Pixel_9_API_36';
const legacyDefaultAvdName = 'CJ_Pixel_9_API_36';

const options = {
  avdName: process.env.APP_ANDROID_AVD_NAME || process.env.EMORAPY_ANDROID_AVD_NAME || process.env.CJ_ANDROID_AVD_NAME || null,
  avdNameSource: process.env.APP_ANDROID_AVD_NAME
    ? 'APP_ANDROID_AVD_NAME'
    : process.env.EMORAPY_ANDROID_AVD_NAME
      ? 'EMORAPY_ANDROID_AVD_NAME'
      : process.env.CJ_ANDROID_AVD_NAME
        ? 'CJ_ANDROID_AVD_NAME'
        : 'auto',
  timeoutMs: Number(process.env.APP_ANDROID_EMULATOR_TIMEOUT_MS || 180000),
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
};

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--avd=')) {
    options.avdName = arg.slice('--avd='.length);
    options.avdNameSource = '--avd';
  } else if (arg.startsWith('--timeout-ms=')) {
    options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else {
    console.error(`[android-emulator-smoke] unknown argument: ${arg}`);
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
    emulator: path.join(sdkRoot, 'emulator', 'emulator'),
    avdmanager: path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'avdmanager'),
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
    })
    .filter((device) => device.serial?.startsWith('emulator-'));
}

function parseAvdNames(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('Name: '))
    .map((line) => line.slice('Name: '.length).trim())
    .filter(Boolean);
}

function resolveAvdName(avdListOutput) {
  const avdNames = parseAvdNames(avdListOutput);
  if (options.avdName) {
    if (!avdNames.includes(options.avdName)) {
      throw new Error(`AVD ${options.avdName} was not found.`);
    }
    return options.avdName;
  }
  if (avdNames.includes(defaultAvdName)) {
    options.avdNameSource = 'default';
    return defaultAvdName;
  }
  if (avdNames.includes(legacyDefaultAvdName)) {
    options.avdNameSource = 'legacy-default';
    return legacyDefaultAvdName;
  }
  throw new Error(`No compatible Android AVD was found. Expected ${defaultAvdName} or legacy ${legacyDefaultAvdName}.`);
}

function adb(adbCommand, args = []) {
  return runCommand(adbCommand, args);
}

function getProperty(adbCommand, serial, property) {
  const result = adb(adbCommand, ['-s', serial, 'shell', 'getprop', property]);
  return result.status === 0 ? result.stdout.trim() : '';
}

function findBootedSerial(adbCommand) {
  const devices = parseDevices(adb(adbCommand, ['devices']).stdout);
  for (const device of devices) {
    if (device.state !== 'device') continue;
    if (getProperty(adbCommand, device.serial, 'sys.boot_completed') === '1') {
      return device.serial;
    }
  }
  return null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-Android-Emulator-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

async function main() {
  const startedAtMs = Date.now();
  const startedAt = new Date().toISOString();
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  const tools = resolveAndroidTools();
  const env = buildJavaEnv({
    ...process.env,
    ANDROID_HOME: tools.sdkRoot,
    ANDROID_SDK_ROOT: tools.sdkRoot,
  });

  for (const [label, command] of Object.entries({ adb: tools.adb, emulator: tools.emulator, avdmanager: tools.avdmanager })) {
    if (!fs.existsSync(command)) {
      throw new Error(`${label} was not found at ${command}`);
    }
  }

  const avdList = runCommand(tools.avdmanager, ['list', 'avd'], { env });
  if (avdList.status !== 0) {
    throw new Error('Unable to list Android AVDs.');
  }
  options.avdName = resolveAvdName(avdList.stdout);

  const adbStart = adb(tools.adb, ['start-server']);
  const emulatorProcess = spawn(
    tools.emulator,
    [
      '-avd',
      options.avdName,
      '-no-window',
      '-no-audio',
      '-no-boot-anim',
      '-gpu',
      'swiftshader_indirect',
      '-no-snapshot-load',
      '-no-snapshot-save',
    ],
    {
      cwd: mobileRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let stdout = '';
  let stderr = '';
  emulatorProcess.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  emulatorProcess.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  let serial = null;
  let bootCompleted = false;
  let failure = null;
  const deadline = Date.now() + options.timeoutMs;

  while (Date.now() < deadline) {
    await wait(3000);
    if (emulatorProcess.exitCode !== null) {
      failure = `emulator exited early with code ${emulatorProcess.exitCode}`;
      break;
    }
    serial = findBootedSerial(tools.adb);
    if (serial) {
      bootCompleted = true;
      break;
    }
  }

  if (!bootCompleted && !failure) {
    failure = `emulator did not boot within ${options.timeoutMs}ms`;
  }

  const deviceProperties =
    bootCompleted && serial
      ? {
          serial,
          boot_completed: getProperty(tools.adb, serial, 'sys.boot_completed'),
          build_version_release: getProperty(tools.adb, serial, 'ro.build.version.release'),
          build_version_sdk: getProperty(tools.adb, serial, 'ro.build.version.sdk'),
          product_model: getProperty(tools.adb, serial, 'ro.product.model'),
          product_cpu_abi: getProperty(tools.adb, serial, 'ro.product.cpu.abi'),
        }
      : {};

  if (serial) {
    adb(tools.adb, ['-s', serial, 'emu', 'kill']);
  }
  if (emulatorProcess.exitCode === null) {
    emulatorProcess.kill('SIGTERM');
  }

  const record = {
    type: 'app-android-emulator-runtime-smoke',
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    working_directory: mobileRoot,
    node_version: process.version,
    app_android_package: app.android?.package ?? null,
    avd_name: options.avdName,
    avd_name_source: options.avdNameSource,
    default_avd_name: defaultAvdName,
    legacy_default_avd_name: legacyDefaultAvdName,
    sdk_root: tools.sdkRoot,
    commands: {
      adb: tools.adb,
      emulator: tools.emulator,
      avdmanager: tools.avdmanager,
    },
    summary: {
      booted: bootCompleted,
      blocked: !bootCompleted,
      duration_ms: Date.now() - startedAtMs,
      failure,
    },
    adb_start: {
      exit_code: adbStart.status,
      stdout_tail: tail(adbStart.stdout),
      stderr_tail: tail(adbStart.stderr),
    },
    device: deviceProperties,
    emulator_output: {
      stdout_tail: tail(stdout),
      stderr_tail: tail(stderr),
    },
  };

  const evidencePath = writeEvidence(record);
  console.log(`[android-emulator-smoke] evidence written: ${evidencePath}`);

  if (!bootCompleted) {
    console.error(`[android-emulator-smoke] failed: ${failure}`);
    process.exit(1);
  }

  console.log(`[android-emulator-smoke] ok: ${options.avdName} booted as ${serial}`);
}

main().catch((error) => {
  const record = {
    type: 'app-android-emulator-runtime-smoke',
    generated_at: new Date().toISOString(),
    avd_name: options.avdName,
    summary: {
      booted: false,
      blocked: true,
      failure: error instanceof Error ? error.message : String(error),
    },
  };
  const evidencePath = writeEvidence(record);
  console.error(`[android-emulator-smoke] evidence written: ${evidencePath}`);
  console.error(`[android-emulator-smoke] failed: ${record.summary.failure}`);
  process.exit(1);
});
