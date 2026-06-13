import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const options = {
  run: process.env.APP_EAS_ANDROID_RELEASE_SMOKE_RUN === 'true',
  buildId: process.env.APP_EAS_ANDROID_BUILD_ID || null,
  expoToken: process.env.EXPO_TOKEN || null,
  skipArtifactHead: process.env.APP_EAS_ANDROID_SKIP_ARTIFACT_HEAD === 'true',
  timeoutMs: Number(process.env.APP_EAS_ANDROID_RELEASE_TIMEOUT_MS || 30000),
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--run') {
    options.run = true;
  } else if (arg === '--dry-run') {
    options.run = false;
  } else if (arg === '--skip-artifact-head') {
    options.skipArtifactHead = true;
  } else if (arg.startsWith('--build-id=')) {
    options.buildId = arg.slice('--build-id='.length);
  } else if (arg.startsWith('--timeout-ms=')) {
    options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else {
    console.error(`[eas-android-release-smoke] unknown argument: ${arg}`);
    process.exit(1);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readRecord(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function readString(input) {
  return typeof input === 'string' && input.trim() ? input.trim() : null;
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function hashValue(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function redactSensitive(input) {
  return String(input || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .replace(/EXPO_TOKEN=[^\s]+/g, 'EXPO_TOKEN=[redacted]')
    .replace(/https:\/\/[^"'`\s]+/g, '[redacted-url]');
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-EAS-Android-Release-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function expectedApp() {
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  return {
    app,
    version: app.version || '0.0.0',
    versionCode: typeof app.android?.versionCode === 'number' ? String(app.android.versionCode) : 'dev',
    packageName: app.android?.package || null,
    runtimeVersion: typeof app.runtimeVersion === 'string'
      ? app.runtimeVersion
      : app.runtimeVersion?.policy === 'appVersion'
        ? app.version
        : null,
  };
}

function buildBaseEvidence(expected, startedAt) {
  return {
    type: 'app-eas-android-release-evidence',
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    working_directory: mobileRoot,
    node_version: process.version,
    app_android_package: expected.packageName,
    app_version: expected.version,
    app_version_code: expected.versionCode,
    expected: {
      platform: 'android',
      distribution: 'store',
      build_profile: 'production',
      channel: 'production',
      runtime_version: expected.runtimeVersion,
    },
    credentials: {
      expo_token_present: Boolean(options.expoToken),
    },
  };
}

function printDryRun(expected) {
  const buildQuery = options.buildId
    ? `eas build:view ${options.buildId} --json`
    : [
        'eas build:list --platform android --status finished --distribution store',
        `--app-version ${expected.version}`,
        `--app-build-version ${expected.versionCode}`,
        '--limit 1 --json --non-interactive',
      ].join(' ');
  console.log('[eas-android-release-smoke] dry-run');
  console.log('- Requires --run or APP_EAS_ANDROID_RELEASE_SMOKE_RUN=true before querying EAS.');
  console.log('- Requires EXPO_TOKEN for non-interactive EAS build metadata lookup.');
  console.log(`- EAS query: ${buildQuery}`);
  console.log(`- Expected package: ${expected.packageName}`);
  console.log(`- Expected app version/versionCode: ${expected.version}/${expected.versionCode}`);
  console.log('- Run mode reads EAS remote Android versionCode when EXPO_TOKEN is present.');
  console.log('- Artifact HEAD check is required unless --skip-artifact-head is passed; skipped checks will not satisfy strict audit.');
}

function runCommand(command, args, extraEnv = {}) {
  return spawnSync(command, args, {
    cwd: mobileRoot,
    env: {
      ...process.env,
      ...extraEnv,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function getRemoteAndroidVersionCode() {
  const result = runCommand(
    'eas',
    ['build:version:get', '--platform', 'android', '--json', '--non-interactive'],
    { EXPO_TOKEN: options.expoToken }
  );
  const parsed = parseEasJson(result);
  const versionCode = readString(readRecord(parsed.data).versionCode);
  return {
    ok: parsed.ok && Boolean(versionCode),
    versionCode,
    stderr_tail: redactSensitive(result.stderr).slice(-1200),
  };
}

function parseEasJson(result) {
  if (result.status !== 0) {
    return { ok: false, data: null };
  }
  try {
    return { ok: true, data: JSON.parse(result.stdout || 'null') };
  } catch {
    return { ok: false, data: null };
  }
}

function extractBuild(input) {
  if (Array.isArray(input)) return readRecord(input[0]);
  return readRecord(input);
}

function extractBuildSummary(build) {
  const artifacts = readRecord(build.artifacts);
  const app = readRecord(build.app);
  return {
    id: readString(build.id),
    platform: readString(build.platform),
    status: readString(build.status),
    distribution: readString(build.distribution),
    build_profile: readString(build.buildProfile) || readString(build.profile),
    channel: readString(build.channel),
    app_identifier:
      readString(build.appIdentifier) ||
      readString(build.applicationIdentifier) ||
      readString(app.packageName) ||
      readString(app.bundleIdentifier),
    app_version: readString(build.appVersion),
    app_build_version:
      readString(build.appBuildVersion) ||
      readString(build.buildVersion) ||
      readString(build.version),
    runtime_version: readString(build.runtimeVersion),
    artifact_url:
      readString(artifacts.buildUrl) ||
      readString(artifacts.applicationArchiveUrl) ||
      readString(build.artifactUrl) ||
      readString(build.buildUrl),
  };
}

function summarizeArtifactUrl(artifactUrl) {
  if (!artifactUrl) return null;
  const url = new URL(artifactUrl);
  return {
    host: url.host,
    path_sha256: hashValue(url.pathname),
    url_sha256: hashValue(artifactUrl),
  };
}

async function checkArtifactHead(artifactUrl) {
  if (!artifactUrl || options.skipArtifactHead) {
    return {
      skipped: options.skipArtifactHead,
      ok: false,
      status: null,
      content_type: null,
      content_length: null,
      final_host: artifactUrl ? new URL(artifactUrl).host : null,
    };
  }

  const head = await fetch(artifactUrl, {
    method: 'HEAD',
    redirect: 'follow',
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  if (head.ok) {
    return {
      skipped: false,
      ok: true,
      status: head.status,
      content_type: head.headers.get('content-type'),
      content_length: head.headers.get('content-length'),
      final_host: new URL(head.url || artifactUrl).host,
    };
  }

  const range = await fetch(artifactUrl, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  return {
    skipped: false,
    ok: range.ok || range.status === 206,
    status: range.status,
    content_type: range.headers.get('content-type'),
    content_length: range.headers.get('content-length'),
    final_host: new URL(range.url || artifactUrl).host,
  };
}

function queryEasBuild(expected) {
  const args = options.buildId
    ? ['build:view', options.buildId, '--json']
    : [
        'build:list',
        '--platform',
        'android',
        '--status',
        'finished',
        '--distribution',
        'store',
        '--app-version',
        expected.version,
        '--app-build-version',
        expected.versionCode,
        '--limit',
        '1',
        '--json',
        '--non-interactive',
      ];
  const result = runCommand('eas', args, { EXPO_TOKEN: options.expoToken });
  const parsed = parseEasJson(result);
  return {
    ok: parsed.ok,
    status: result.status,
    stdout_json: parsed.data,
    stderr_tail: redactSensitive(result.stderr).slice(-1200),
  };
}

function missingRunRequirements() {
  const missing = [];
  if (!options.expoToken) missing.push('EXPO_TOKEN');
  return missing;
}

async function run() {
  const startedAt = new Date().toISOString();
  const expected = expectedApp();

  if (!options.run) {
    printDryRun(expected);
    return null;
  }

  const missing = missingRunRequirements();
  if (missing.length > 0) {
    const base = buildBaseEvidence(expected, startedAt);
    return {
      ...base,
      summary: {
        run_mode: 'run',
        eas_query_passed: false,
        build_found: false,
        platform_android: false,
        status_finished: false,
        distribution_store: false,
        profile_production: false,
        app_identifier_matches: false,
        app_version_matches: false,
        version_code_matches: false,
        artifact_url_present: false,
        artifact_head_passed: false,
        blocked: true,
        failure: `Missing required input: ${missing.join(', ')}`,
      },
    };
  }

  const remoteVersion = getRemoteAndroidVersionCode();
  if (remoteVersion.ok) {
    expected.versionCode = remoteVersion.versionCode;
  }

  const base = buildBaseEvidence(expected, startedAt);
  const easResult = queryEasBuild(expected);
  const build = extractBuild(easResult.stdout_json);
  const buildSummary = extractBuildSummary(build);
  const artifactHead = await checkArtifactHead(buildSummary.artifact_url);

  const statusFinished = String(buildSummary.status || '').toLowerCase() === 'finished';
  const platformAndroid = String(buildSummary.platform || '').toLowerCase() === 'android';
  const distributionStore = String(buildSummary.distribution || '').toLowerCase() === 'store';
  const profileProduction = String(buildSummary.build_profile || '').toLowerCase() === 'production';
  const appIdentifierMatches = buildSummary.app_identifier
    ? buildSummary.app_identifier === expected.packageName
    : true;
  const appVersionMatches = buildSummary.app_version === expected.version;
  const versionCodeMatches = buildSummary.app_build_version === expected.versionCode;
  const passed =
    easResult.ok &&
    Boolean(buildSummary.id) &&
    platformAndroid &&
    statusFinished &&
    distributionStore &&
    profileProduction &&
    appIdentifierMatches &&
    appVersionMatches &&
    versionCodeMatches &&
    Boolean(buildSummary.artifact_url) &&
    artifactHead.ok &&
    !options.skipArtifactHead;

  return {
    ...base,
    summary: {
      run_mode: 'run',
      eas_query_passed: easResult.ok,
      build_found: Boolean(buildSummary.id),
      platform_android: platformAndroid,
      status_finished: statusFinished,
      distribution_store: distributionStore,
      profile_production: profileProduction,
      app_identifier_matches: appIdentifierMatches,
      app_version_matches: appVersionMatches,
      version_code_matches: versionCodeMatches,
      artifact_url_present: Boolean(buildSummary.artifact_url),
      artifact_head_passed: artifactHead.ok && !options.skipArtifactHead,
      blocked: !passed,
    },
    eas_build: {
      id_sha256: buildSummary.id ? hashValue(buildSummary.id) : null,
      platform: buildSummary.platform,
      status: buildSummary.status,
      distribution: buildSummary.distribution,
      build_profile: buildSummary.build_profile,
      channel: buildSummary.channel,
      app_identifier: buildSummary.app_identifier,
      app_version: buildSummary.app_version,
      app_build_version: buildSummary.app_build_version,
      runtime_version: buildSummary.runtime_version,
      artifact: summarizeArtifactUrl(buildSummary.artifact_url),
      query_status: easResult.status,
      stderr_tail: easResult.ok ? '' : easResult.stderr_tail,
    },
    artifact_head: artifactHead,
  };
}

try {
  const evidence = await run();
  if (!evidence) process.exit(0);

  const evidencePath = writeEvidence(evidence);
  console.log(`[eas-android-release-smoke] evidence written: ${evidencePath}`);
  if (evidence.summary.blocked) {
    console.error('[eas-android-release-smoke] failed: EAS Android release evidence did not pass.');
    process.exit(1);
  }
  console.log('[eas-android-release-smoke] ok: EAS Android release evidence passed');
} catch (error) {
  const startedAt = new Date().toISOString();
  const expected = fs.existsSync(path.join(mobileRoot, 'app.json'))
    ? expectedApp()
    : { app: {}, version: null, versionCode: null, packageName: null, runtimeVersion: null };
  const evidence = {
    ...buildBaseEvidence(expected, startedAt),
    summary: {
      run_mode: options.run ? 'run' : 'dry-run',
      eas_query_passed: false,
      build_found: false,
      platform_android: false,
      status_finished: false,
      distribution_store: false,
      profile_production: false,
      app_identifier_matches: false,
      app_version_matches: false,
      version_code_matches: false,
      artifact_url_present: false,
      artifact_head_passed: false,
      blocked: true,
      failure: redactSensitive(error instanceof Error ? error.message : String(error)),
    },
  };
  const evidencePath = writeEvidence(evidence);
  console.error(`[eas-android-release-smoke] evidence written: ${evidencePath}`);
  console.error(`[eas-android-release-smoke] failed: ${evidence.summary.failure}`);
  process.exit(1);
}
