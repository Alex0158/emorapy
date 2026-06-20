import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getExpoProjectIdStatus } from './lib/release-app-config.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(projectRoot, '..');

function readJson(relativePath) {
  const filePath = path.resolve(projectRoot, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function exists(relativePath) {
  return fs.existsSync(path.resolve(projectRoot, relativePath));
}

function hasPlugin(plugins, pluginName) {
  return plugins.some((entry) => {
    if (typeof entry === 'string') return entry === pluginName;
    return Array.isArray(entry) && entry[0] === pluginName;
  });
}

const failures = [];
const warnings = [];
const infos = [];
const app = readJson('app.json').expo;
const easProjectId = getExpoProjectIdStatus(app);
const pkg = readJson('package.json');
const eas = readJson('eas.json');
const lockfile = readJson('package-lock.json');

function requireValue(condition, message) {
  if (!condition) failures.push(message);
}

function warnIf(condition, message) {
  if (condition) warnings.push(message);
}

function infoIf(condition, message) {
  if (condition) infos.push(message);
}

function runCommand(command, args = [], options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function getCommandOutput(command, args = []) {
  const result = runCommand(command, args);
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

function commandSucceedsFromCandidates(candidates, args = []) {
  for (const command of candidates) {
    if (runCommand(command, args, { env: withJavaEnv() }).status === 0) {
      return command;
    }
  }
  return null;
}

requireValue(app.name === 'Emorapy', 'app.json expo.name must be Emorapy for the current App identity.');
requireValue(app.slug === 'emorapy-mobile', 'app.json expo.slug must be emorapy-mobile for the current App identity.');
requireValue(app.version === pkg.version, `app.json version (${app.version}) must match mobile package version (${pkg.version}).`);
requireValue(app.scheme === 'emorapy', 'app.json must define the emorapy deep-link scheme.');
requireValue(app.runtimeVersion?.policy === 'appVersion', 'app.json must use runtimeVersion policy appVersion for EAS Update compatibility.');
requireValue(app.updates && typeof app.updates === 'object', 'app.json must define updates policy before EAS release.');
requireValue(app.ios?.bundleIdentifier === 'com.emorapy.app', 'iOS bundleIdentifier must be com.emorapy.app.');
requireValue(app.ios?.buildNumber, 'iOS buildNumber is required.');
requireValue(app.ios?.infoPlist?.NSPhotoLibraryUsageDescription, 'iOS photo permission usage string is required.');
requireValue(Array.isArray(app.ios?.infoPlist?.UIBackgroundModes) && app.ios.infoPlist.UIBackgroundModes.includes('remote-notification'), 'iOS remote-notification background mode is required for push readiness.');
requireValue(app.android?.package === 'com.emorapy.app', 'Android package must be com.emorapy.app.');
requireValue(Number.isInteger(app.android?.versionCode), 'Android versionCode is required.');
requireValue(Array.isArray(app.plugins) && hasPlugin(app.plugins, 'expo-router'), 'expo-router plugin is required.');
requireValue(Array.isArray(app.plugins) && hasPlugin(app.plugins, 'expo-secure-store'), 'expo-secure-store plugin is required.');
requireValue(Array.isArray(app.plugins) && hasPlugin(app.plugins, 'expo-notifications'), 'expo-notifications plugin is required.');
requireValue(Array.isArray(app.plugins) && hasPlugin(app.plugins, 'expo-image-picker'), 'expo-image-picker plugin is required.');
requireValue(Boolean(eas.cli?.version), 'eas.json must pin a minimum EAS CLI version.');
requireValue(eas.cli?.appVersionSource === 'remote', 'eas.json must use remote appVersionSource to avoid local build-number drift.');
requireValue(Boolean(eas.build?.development && eas.build?.preview && eas.build?.production), 'eas.json must define development, preview, and production build profiles.');
requireValue(eas.build?.preview?.distribution === 'internal', 'preview build must use internal distribution before TestFlight production submission.');
requireValue(eas.build?.production?.autoIncrement === true, 'production build must autoIncrement native build numbers.');
requireValue(exists('../packages/api-client/dist/index.js'), 'packages/api-client must be built before release preflight.');
requireValue(pkg.dependencies?.['@emorapy/api-client'] === 'file:../packages/api-client', 'mobile package.json must depend on @emorapy/api-client via file:../packages/api-client.');
requireValue(pkg.dependencies?.['@emorapy/contracts'] === 'file:../packages/contracts', 'mobile package.json must depend on @emorapy/contracts via file:../packages/contracts.');
requireValue(lockfile.packages?.['node_modules/@emorapy/api-client']?.link === true, 'mobile package-lock must link @emorapy/api-client to ../packages/api-client.');
requireValue(lockfile.packages?.['node_modules/@emorapy/contracts']?.link === true, 'mobile package-lock must link @emorapy/contracts to ../packages/contracts.');
requireValue(Boolean(lockfile.packages?.['../packages/api-client']?.version), 'mobile package-lock must include local @emorapy/api-client package metadata.');
requireValue(Boolean(lockfile.packages?.['../packages/contracts']?.version), 'mobile package-lock must include local @emorapy/contracts package metadata.');

const rootPackage = JSON.parse(fs.readFileSync(path.resolve(repoRoot, 'package.json'), 'utf8'));
const easCliVersion = runCommand('eas', ['--version']);
const easCliAvailable = easCliVersion.status === 0;
const easCliAuthenticated = easCliAvailable && runCommand('eas', ['whoami', '--non-interactive']).status === 0;
infoIf(!rootPackage.workspaces?.includes('mobile'), 'Root npm workspaces intentionally keep mobile repo-local; EAS should run from mobile/ with local file dependencies and Metro aliases checked.');
warnIf(rootPackage.workspaces?.includes('mobile'), 'Root npm workspaces include mobile; update ADR/workspace docs or revert to repo-local mobile before release.');
warnIf(!easProjectId.valid, 'app.json has no UUID-shaped extra.eas.projectId; Expo push token retrieval and EAS Update URL remain environment setup tasks.');
warnIf(!easCliAvailable, 'EAS CLI is not installed or not on PATH; EAS release evidence runners cannot query build metadata locally.');
warnIf(easCliAvailable && !easCliAuthenticated && !process.env.EXPO_TOKEN, 'EAS CLI is available but not authenticated for non-interactive checks; set EXPO_TOKEN before EAS release evidence run mode.');
infoIf(easCliAvailable, 'EAS CLI is available on PATH for release evidence runners.');
infoIf(easCliAuthenticated, 'EAS CLI can authenticate in non-interactive mode for this environment.');
warnIf(!process.env.EXPO_TOKEN, 'EXPO_TOKEN is not set; CI EAS build cannot run non-interactively.');
warnIf(
  !process.env.ASC_APPLE_ID || !process.env.EXPO_APPLE_APP_SPECIFIC_PASSWORD,
  'Apple submission credentials are incomplete; ASC_APPLE_ID and EXPO_APPLE_APP_SPECIFIC_PASSWORD must both be present for non-interactive submit.'
);

const activeDeveloperDir = getCommandOutput('xcode-select', ['-p']);
const xcodeDeveloperDir = '/Applications/Xcode.app/Contents/Developer';
const fullXcodeExists = fs.existsSync(xcodeDeveloperDir);
const developerDirOverride = process.env.DEVELOPER_DIR?.trim();
const effectiveDeveloperDir = developerDirOverride || activeDeveloperDir;
const effectiveDeveloperEnv = effectiveDeveloperDir
  ? { ...process.env, DEVELOPER_DIR: effectiveDeveloperDir }
  : process.env;
const simctlActive = runCommand('xcrun', ['--find', 'simctl'], { env: effectiveDeveloperEnv }).status === 0;
const simctlViaFullXcode = fullXcodeExists && runCommand('xcrun', ['--find', 'simctl'], {
  env: { ...process.env, DEVELOPER_DIR: xcodeDeveloperDir },
}).status === 0;

warnIf(!activeDeveloperDir, 'xcode-select is not available; iOS simulator launch smoke cannot run on this machine.');
infoIf(Boolean(developerDirOverride), `DEVELOPER_DIR override is set to ${developerDirOverride}.`);
warnIf(Boolean(activeDeveloperDir?.includes('/CommandLineTools') && fullXcodeExists && !developerDirOverride), `Active developer directory is ${activeDeveloperDir}; full Xcode exists at ${xcodeDeveloperDir} but is not selected for native smoke.`);
warnIf(Boolean(activeDeveloperDir?.includes('/CommandLineTools') && !fullXcodeExists && !developerDirOverride), `Active developer directory is ${activeDeveloperDir}; install/select full Xcode before iOS simulator launch smoke.`);
warnIf(Boolean(developerDirOverride && developerDirOverride !== xcodeDeveloperDir), `DEVELOPER_DIR is set to ${developerDirOverride}; expected ${xcodeDeveloperDir} for the current native readiness baseline.`);
warnIf(!simctlActive && !simctlViaFullXcode, 'xcrun simctl is not available; iOS simulator/device smoke evidence cannot be generated locally.');
warnIf(!simctlActive && simctlViaFullXcode, `xcrun simctl is unavailable through the active developer directory but available with DEVELOPER_DIR=${xcodeDeveloperDir}.`);
const maestroCandidates = ['maestro'];
const homebrewMaestro = '/opt/homebrew/opt/maestro/bin/maestro';
if (fs.existsSync(homebrewMaestro)) {
  maestroCandidates.push(homebrewMaestro);
}
const maestroCommand = commandSucceedsFromCandidates(maestroCandidates, ['--version']);
if (maestroCommand) {
  infoIf(true, `Maestro CLI available via ${maestroCommand}.`);
} else {
  warnings.push('Maestro CLI is not installed or not on PATH; native Maestro execution evidence cannot be generated locally.');
}

if (warnings.length > 0) {
  console.warn('[mobile-release-check] warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (infos.length > 0) {
  console.log('[mobile-release-check] info:');
  infos.forEach((info) => console.log(`- ${info}`));
}

if (failures.length > 0) {
  console.error('[mobile-release-check] failures:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[mobile-release-check] ok: release configuration baseline is present');
