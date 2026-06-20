import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
  return result.status === 0 ? result.stdout.trim() || result.stderr.trim() : null;
}

function commandOutputFromCandidates(candidates, args = [], options = {}) {
  for (const command of candidates) {
    if (!command) continue;
    const result = runCommand(command, args, options);
    if (result.status === 0) {
      return {
        command,
        output: result.stdout.trim() || result.stderr.trim(),
      };
    }
  }
  return null;
}

function buildJavaToolEnv(javaHome) {
  if (!javaHome) return process.env;
  return {
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${path.join(javaHome, 'bin')}:${process.env.PATH ?? ''}`,
  };
}

function firstExistingPath(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

function assetExists(relativePath) {
  if (!relativePath) return false;
  return fs.existsSync(path.resolve(projectRoot, relativePath));
}

function hasPlugin(plugins, pluginName) {
  return plugins.some((entry) => {
    if (typeof entry === 'string') return entry === pluginName;
    return Array.isArray(entry) && entry[0] === pluginName;
  });
}

function hasPermission(permissions, permissionName) {
  return Array.isArray(permissions) && permissions.includes(permissionName);
}

function pushConfigFailure(condition, message) {
  if (!condition) failures.push(message);
}

const app = readJson('app.json').expo ?? {};
const eas = readJson('eas.json');
const android = app.android ?? {};
const androidIcon = android.adaptiveIcon ?? {};
const failures = [];
const blockers = [];
const warnings = [];
const info = [];

pushConfigFailure(app.scheme === 'emorapy', 'app.json must keep the emorapy deep-link scheme for Android links.');
pushConfigFailure(android.package === 'com.emorapy.app', 'Android package must be com.emorapy.app.');
pushConfigFailure(Number.isInteger(android.versionCode) && android.versionCode > 0, 'Android versionCode must be a positive integer.');
pushConfigFailure(assetExists(androidIcon.foregroundImage), 'Android adaptiveIcon.foregroundImage asset is missing.');
pushConfigFailure(assetExists(androidIcon.backgroundImage), 'Android adaptiveIcon.backgroundImage asset is missing.');
pushConfigFailure(assetExists(androidIcon.monochromeImage), 'Android adaptiveIcon.monochromeImage asset is missing.');
pushConfigFailure(Boolean(androidIcon.backgroundColor), 'Android adaptiveIcon.backgroundColor is required.');
pushConfigFailure(hasPermission(android.permissions, 'POST_NOTIFICATIONS'), 'Android POST_NOTIFICATIONS permission is required for push readiness.');
pushConfigFailure(hasPermission(android.permissions, 'READ_MEDIA_IMAGES'), 'Android READ_MEDIA_IMAGES permission is required for evidence upload readiness.');
pushConfigFailure(Array.isArray(app.plugins) && hasPlugin(app.plugins, 'expo-notifications'), 'expo-notifications plugin is required for Android push readiness.');
pushConfigFailure(Array.isArray(app.plugins) && hasPlugin(app.plugins, 'expo-image-picker'), 'expo-image-picker plugin is required for Android upload readiness.');
pushConfigFailure(eas.build?.development?.android?.buildType === 'apk', 'development Android EAS profile must build apk for device smoke.');
pushConfigFailure(eas.build?.preview?.android?.buildType === 'apk', 'preview Android EAS profile must build apk for internal smoke.');
pushConfigFailure(Boolean(eas.build?.production), 'production Android EAS profile is required.');

const envSdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const defaultSdkRoot = path.join(os.homedir(), 'Library', 'Android', 'sdk');
const sdkRoot = firstExistingPath([envSdkRoot, defaultSdkRoot]);
if (sdkRoot) {
  info.push(`Android SDK root: ${sdkRoot}`);
} else {
  blockers.push('Android SDK root was not found; install Android Studio command line tools or set ANDROID_HOME / ANDROID_SDK_ROOT.');
}

const javaHome = '/opt/homebrew/opt/openjdk@17';
const homebrewJavaHome = path.join(javaHome, 'libexec/openjdk.jdk/Contents/Home');
const detectedJavaHome = process.env.JAVA_HOME || (fs.existsSync(path.join(homebrewJavaHome, 'bin/java')) ? homebrewJavaHome : null);
const javaToolEnv = buildJavaToolEnv(detectedJavaHome);
const javaCandidates = [
  detectedJavaHome && path.join(detectedJavaHome, 'bin/java'),
  path.join(javaHome, 'bin', 'java'),
  'java',
];
const javaVersion = commandOutputFromCandidates(javaCandidates, ['-version']);
if (javaVersion) {
  info.push(`Java: ${javaVersion.output.split('\n')[0]} (${javaVersion.command})`);
} else {
  blockers.push('Java 17 is not available; Android Gradle builds cannot run locally.');
}

const adbCandidates = [
  sdkRoot && path.join(sdkRoot, 'platform-tools', 'adb'),
  'adb',
];
const adbVersion = commandOutputFromCandidates(adbCandidates, ['version']);
if (adbVersion) {
  info.push(`adb: ${adbVersion.output.split('\n')[0]} (${adbVersion.command})`);
} else {
  blockers.push('adb is not available; Android device / emulator smoke cannot run locally.');
}

const emulatorCandidates = [
  sdkRoot && path.join(sdkRoot, 'emulator', 'emulator'),
  'emulator',
];
const emulatorVersion = commandOutputFromCandidates(emulatorCandidates, ['-version']);
if (emulatorVersion) {
  info.push(`emulator: ${emulatorVersion.output.split('\n')[0]} (${emulatorVersion.command})`);
} else {
  blockers.push('Android emulator CLI is not available; Android simulator smoke cannot run locally.');
}

const sdkManagerCandidates = [
  sdkRoot && path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'sdkmanager'),
  sdkRoot && path.join(sdkRoot, 'cmdline-tools', 'bin', 'sdkmanager'),
  'sdkmanager',
];
const sdkManagerVersion = commandOutputFromCandidates(sdkManagerCandidates, ['--version'], { env: javaToolEnv });
if (sdkManagerVersion) {
  info.push(`sdkmanager: ${sdkManagerVersion.output.split('\n')[0]} (${sdkManagerVersion.command})`);
} else {
  blockers.push('sdkmanager is not available; Android platform package readiness cannot be inspected locally.');
}

if (adbVersion) {
  const devices = commandOutput(adbVersion.command, ['devices']);
  const connected = devices
    ?.split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && /\bdevice$/.test(line));
  if (connected?.length) {
    info.push(`connected Android devices: ${connected.join(' | ')}`);
  } else {
    warnings.push('No connected Android device is visible through adb; Android physical-device evidence remains pending.');
  }
}

if (info.length > 0) {
  console.log('[android-readiness] info:');
  info.forEach((item) => console.log(`- ${item}`));
}

if (warnings.length > 0) {
  console.warn('[android-readiness] warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (failures.length > 0) {
  console.error('[android-readiness] failures:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

if (blockers.length > 0) {
  console.warn('[android-readiness] blockers:');
  blockers.forEach((blocker) => console.warn(`- ${blocker}`));
  console.warn(`[android-readiness] ${strict ? 'failed' : 'not ready'}: Android native build / emulator evidence is blocked.`);
  if (strict) process.exit(1);
} else {
  console.log('[android-readiness] ok: Android native build / emulator prerequisites are present');
}

console.log('[android-readiness] ok: Android configuration baseline is present');
