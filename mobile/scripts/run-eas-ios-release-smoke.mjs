import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash, createSign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const options = {
  run: process.env.APP_EAS_IOS_RELEASE_SMOKE_RUN === 'true',
  buildId: process.env.APP_EAS_IOS_BUILD_ID || null,
  expoToken: process.env.EXPO_TOKEN || null,
  requireTestflight: process.env.APP_EAS_IOS_REQUIRE_TESTFLIGHT === 'true',
  skipArtifactHead: process.env.APP_EAS_IOS_SKIP_ARTIFACT_HEAD === 'true',
  timeoutMs: Number(process.env.APP_EAS_IOS_RELEASE_TIMEOUT_MS || 30000),
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
  ascIssuerId: process.env.APP_STORE_CONNECT_ISSUER_ID || process.env.ASC_ISSUER_ID || null,
  ascKeyId: process.env.APP_STORE_CONNECT_KEY_ID || process.env.ASC_KEY_ID || null,
  ascPrivateKey: process.env.APP_STORE_CONNECT_PRIVATE_KEY || process.env.ASC_PRIVATE_KEY || null,
  ascPrivateKeyPath:
    process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH || process.env.ASC_PRIVATE_KEY_PATH || null,
  ascAppId: process.env.APP_STORE_CONNECT_APP_ID || process.env.ASC_APP_ID || null,
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--run') {
    options.run = true;
  } else if (arg === '--dry-run') {
    options.run = false;
  } else if (arg === '--require-testflight') {
    options.requireTestflight = true;
  } else if (arg === '--skip-artifact-head') {
    options.skipArtifactHead = true;
  } else if (arg.startsWith('--build-id=')) {
    options.buildId = arg.slice('--build-id='.length);
  } else if (arg.startsWith('--timeout-ms=')) {
    options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else if (arg.startsWith('--asc-app-id=')) {
    options.ascAppId = arg.slice('--asc-app-id='.length);
  } else {
    console.error(`[eas-ios-release-smoke] unknown argument: ${arg}`);
    process.exit(1);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readRecord(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function readArray(input) {
  return Array.isArray(input) ? input : [];
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

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function redactSensitive(input) {
  return String(input || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .replace(/EXPO_TOKEN=[^\s]+/g, 'EXPO_TOKEN=[redacted]')
    .replace(/APP_STORE_CONNECT_PRIVATE_KEY=[^\s]+/g, 'APP_STORE_CONNECT_PRIVATE_KEY=[redacted]')
    .replace(/ASC_PRIVATE_KEY=[^\s]+/g, 'ASC_PRIVATE_KEY=[redacted]')
    .replace(/https:\/\/[^"'`\s]+/g, '[redacted-url]');
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-EAS-iOS-Release-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function expectedApp() {
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  return {
    app,
    version: app.version || '0.0.0',
    buildNumber: app.ios?.buildNumber || 'dev',
    bundleIdentifier: app.ios?.bundleIdentifier || null,
    runtimeVersion: typeof app.runtimeVersion === 'string'
      ? app.runtimeVersion
      : app.runtimeVersion?.policy === 'appVersion'
        ? app.version
        : null,
  };
}

function buildBaseEvidence(expected, startedAt) {
  return {
    type: 'app-eas-ios-release-evidence',
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    working_directory: mobileRoot,
    node_version: process.version,
    app_ios_bundle_identifier: expected.bundleIdentifier,
    app_version: expected.version,
    app_build_number: expected.buildNumber,
    expected: {
      platform: 'ios',
      distribution: 'store',
      build_profile: 'production',
      channel: 'production',
      runtime_version: expected.runtimeVersion,
    },
    credentials: {
      expo_token_present: Boolean(options.expoToken),
      app_store_connect_issuer_id_present: Boolean(options.ascIssuerId),
      app_store_connect_key_id_present: Boolean(options.ascKeyId),
      app_store_connect_private_key_present: Boolean(options.ascPrivateKey || options.ascPrivateKeyPath),
    },
  };
}

function printDryRun(expected) {
  const buildQuery = options.buildId
    ? `eas build:view ${options.buildId} --json`
    : [
        'eas build:list --platform ios --status finished --distribution store --channel production',
        `--app-version ${expected.version}`,
        `--app-build-version ${expected.buildNumber}`,
        '--limit 1 --json --non-interactive',
      ].join(' ');
  console.log('[eas-ios-release-smoke] dry-run');
  console.log('- Requires --run or APP_EAS_IOS_RELEASE_SMOKE_RUN=true before querying EAS.');
  console.log('- Requires EXPO_TOKEN for non-interactive EAS build metadata lookup.');
  console.log(`- EAS query: ${buildQuery}`);
  console.log(`- Expected bundle identifier: ${expected.bundleIdentifier}`);
  console.log(`- Expected app version/build: ${expected.version}/${expected.buildNumber}`);
  console.log('- Artifact HEAD check is required unless --skip-artifact-head is passed; skipped checks will not satisfy strict audit.');
  console.log('- Add --require-testflight plus App Store Connect API credentials to query TestFlight build availability.');
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
        'ios',
        '--status',
        'finished',
        '--distribution',
        'store',
        '--channel',
        'production',
        '--app-version',
        expected.version,
        '--app-build-version',
        expected.buildNumber,
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

function missingEasRequirements() {
  const missing = [];
  if (!options.expoToken) missing.push('EXPO_TOKEN');
  return missing;
}

function readAscPrivateKey() {
  const raw = options.ascPrivateKey ||
    (options.ascPrivateKeyPath ? fs.readFileSync(path.resolve(repoRoot, options.ascPrivateKeyPath), 'utf8') : null);
  return raw ? raw.replace(/\\n/g, '\n') : null;
}

function buildAppleJwt(privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: options.ascKeyId, typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: options.ascIssuerId,
    iat: now,
    exp: now + 19 * 60,
    aud: 'appstoreconnect-v1',
  }));
  const signingInput = `${header}.${payload}`;
  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${base64Url(signature)}`;
}

async function ascGet(pathname, token) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${pathname}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    body,
    body_text_tail: response.ok ? '' : redactSensitive(text).slice(-1200),
  };
}

function missingAscRequirements() {
  const missing = [];
  if (!options.ascIssuerId) missing.push('APP_STORE_CONNECT_ISSUER_ID or ASC_ISSUER_ID');
  if (!options.ascKeyId) missing.push('APP_STORE_CONNECT_KEY_ID or ASC_KEY_ID');
  if (!options.ascPrivateKey && !options.ascPrivateKeyPath) {
    missing.push('APP_STORE_CONNECT_PRIVATE_KEY / ASC_PRIVATE_KEY or *_PRIVATE_KEY_PATH');
  }
  return missing;
}

function findIncludedPreReleaseVersion(responseBody, relationshipId) {
  return readArray(responseBody?.included).find((entry) => {
    const record = readRecord(entry);
    return record.type === 'preReleaseVersions' && record.id === relationshipId;
  });
}

async function queryTestFlightBuild(expected) {
  const missing = missingAscRequirements();
  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      app_found: false,
      build_found: false,
    };
  }

  const token = buildAppleJwt(readAscPrivateKey());
  let appId = options.ascAppId;
  let appLookup = null;
  if (!appId) {
    const params = new URLSearchParams({
      'filter[bundleId]': expected.bundleIdentifier,
      limit: '1',
    });
    appLookup = await ascGet(`/v1/apps?${params.toString()}`, token);
    appId = readString(readArray(appLookup.body?.data)[0]?.id);
  }

  if (!appId) {
    return {
      ok: false,
      app_lookup: appLookup,
      app_found: false,
      build_found: false,
    };
  }

  const buildParams = new URLSearchParams({
    'filter[app]': appId,
    'filter[version]': expected.buildNumber,
    include: 'preReleaseVersion',
    sort: '-uploadedDate',
    limit: '10',
  });
  const buildLookup = await ascGet(`/v1/builds?${buildParams.toString()}`, token);
  const builds = readArray(buildLookup.body?.data);
  const selected = builds.find((build) => {
    const relationshipId = readString(readRecord(readRecord(build).relationships?.preReleaseVersion).data?.id);
    const preRelease = findIncludedPreReleaseVersion(buildLookup.body, relationshipId);
    return readString(readRecord(preRelease).attributes?.version) === expected.version;
  }) || null;
  const selectedRecord = readRecord(selected);
  const attributes = readRecord(selectedRecord.attributes);
  const relationshipId = readString(readRecord(selectedRecord.relationships?.preReleaseVersion).data?.id);
  const preRelease = selected ? readRecord(findIncludedPreReleaseVersion(buildLookup.body, relationshipId)) : {};
  const preReleaseAttributes = readRecord(preRelease.attributes);
  const processingState = readString(attributes.processingState);
  const expired = attributes.expired === true;

  return {
    ok: buildLookup.ok && Boolean(selected),
    app_lookup: appLookup ? { ok: appLookup.ok, status: appLookup.status } : null,
    build_lookup: {
      ok: buildLookup.ok,
      status: buildLookup.status,
      body_text_tail: buildLookup.body_text_tail,
    },
    app_found: Boolean(appId),
    app_id_sha256: hashValue(appId),
    build_found: Boolean(selected),
    build_id_sha256: selectedRecord.id ? hashValue(selectedRecord.id) : null,
    build_number: readString(attributes.version),
    pre_release_version: readString(preReleaseAttributes.version),
    processing_state: processingState,
    expired,
    uploaded_date: readString(attributes.uploadedDate),
  };
}

async function run() {
  const startedAt = new Date().toISOString();
  const expected = expectedApp();

  if (!options.run) {
    printDryRun(expected);
    return null;
  }

  const base = buildBaseEvidence(expected, startedAt);
  const missing = missingEasRequirements();
  if (missing.length > 0) {
    return {
      ...base,
      summary: {
        run_mode: 'run',
        eas_query_passed: false,
        build_found: false,
        platform_ios: false,
        status_finished: false,
        distribution_store: false,
        profile_production: false,
        app_identifier_matches: false,
        app_version_matches: false,
        build_number_matches: false,
        artifact_url_present: false,
        artifact_head_passed: false,
        testflight_query_required: options.requireTestflight,
        testflight_query_passed: false,
        testflight_build_found: false,
        testflight_version_matches: false,
        testflight_build_number_matches: false,
        testflight_processing_valid: false,
        testflight_not_expired: false,
        blocked: true,
        failure: `Missing required input: ${missing.join(', ')}`,
      },
    };
  }

  const easResult = queryEasBuild(expected);
  const build = extractBuild(easResult.stdout_json);
  const buildSummary = extractBuildSummary(build);
  const artifactHead = await checkArtifactHead(buildSummary.artifact_url);
  const testflight = options.requireTestflight ? await queryTestFlightBuild(expected) : null;

  const statusFinished = String(buildSummary.status || '').toLowerCase() === 'finished';
  const platformIos = String(buildSummary.platform || '').toLowerCase() === 'ios';
  const distributionStore = String(buildSummary.distribution || '').toLowerCase() === 'store';
  const profileProduction = String(buildSummary.build_profile || '').toLowerCase() === 'production';
  const appIdentifierMatches = buildSummary.app_identifier === expected.bundleIdentifier;
  const appVersionMatches = buildSummary.app_version === expected.version;
  const buildNumberMatches = buildSummary.app_build_version === expected.buildNumber;
  const testflightVersionMatches = testflight?.pre_release_version === expected.version;
  const testflightBuildNumberMatches = testflight?.build_number === expected.buildNumber;
  const testflightProcessingValid = testflight?.processing_state === 'VALID';
  const testflightNotExpired = testflight?.expired === false;
  const easPassed =
    easResult.ok &&
    Boolean(buildSummary.id) &&
    platformIos &&
    statusFinished &&
    distributionStore &&
    profileProduction &&
    appIdentifierMatches &&
    appVersionMatches &&
    buildNumberMatches &&
    Boolean(buildSummary.artifact_url) &&
    artifactHead.ok &&
    !options.skipArtifactHead;
  const testflightPassed =
    !options.requireTestflight ||
    (testflight?.ok &&
      testflight.build_found &&
      testflightVersionMatches &&
      testflightBuildNumberMatches &&
      testflightProcessingValid &&
      testflightNotExpired);

  return {
    ...base,
    summary: {
      run_mode: 'run',
      eas_query_passed: easResult.ok,
      build_found: Boolean(buildSummary.id),
      platform_ios: platformIos,
      status_finished: statusFinished,
      distribution_store: distributionStore,
      profile_production: profileProduction,
      app_identifier_matches: appIdentifierMatches,
      app_version_matches: appVersionMatches,
      build_number_matches: buildNumberMatches,
      artifact_url_present: Boolean(buildSummary.artifact_url),
      artifact_head_passed: artifactHead.ok && !options.skipArtifactHead,
      testflight_query_required: options.requireTestflight,
      testflight_query_passed: Boolean(testflight?.ok),
      testflight_build_found: Boolean(testflight?.build_found),
      testflight_version_matches: Boolean(testflightVersionMatches),
      testflight_build_number_matches: Boolean(testflightBuildNumberMatches),
      testflight_processing_valid: Boolean(testflightProcessingValid),
      testflight_not_expired: Boolean(testflightNotExpired),
      blocked: !(easPassed && testflightPassed),
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
    testflight: testflight
      ? {
          app_found: testflight.app_found,
          app_id_sha256: testflight.app_id_sha256,
          build_found: testflight.build_found,
          build_id_sha256: testflight.build_id_sha256,
          build_number: testflight.build_number,
          pre_release_version: testflight.pre_release_version,
          processing_state: testflight.processing_state,
          expired: testflight.expired,
          uploaded_date: testflight.uploaded_date,
          build_lookup: testflight.build_lookup,
          missing: testflight.missing,
        }
      : {
          skipped: true,
        },
  };
}

try {
  const evidence = await run();
  if (!evidence) process.exit(0);

  const evidencePath = writeEvidence(evidence);
  console.log(`[eas-ios-release-smoke] evidence written: ${evidencePath}`);
  if (evidence.summary.blocked) {
    console.error('[eas-ios-release-smoke] failed: EAS iOS release evidence did not pass.');
    process.exit(1);
  }
  console.log('[eas-ios-release-smoke] ok: EAS iOS release evidence passed');
} catch (error) {
  const startedAt = new Date().toISOString();
  const expected = fs.existsSync(path.join(mobileRoot, 'app.json'))
    ? expectedApp()
    : { app: {}, version: null, buildNumber: null, bundleIdentifier: null, runtimeVersion: null };
  const evidence = {
    ...buildBaseEvidence(expected, startedAt),
    summary: {
      run_mode: options.run ? 'run' : 'dry-run',
      eas_query_passed: false,
      build_found: false,
      platform_ios: false,
      status_finished: false,
      distribution_store: false,
      profile_production: false,
      app_identifier_matches: false,
      app_version_matches: false,
      build_number_matches: false,
      artifact_url_present: false,
      artifact_head_passed: false,
      testflight_query_required: options.requireTestflight,
      testflight_query_passed: false,
      testflight_build_found: false,
      testflight_version_matches: false,
      testflight_build_number_matches: false,
      testflight_processing_valid: false,
      testflight_not_expired: false,
      blocked: true,
      failure: redactSensitive(error instanceof Error ? error.message : String(error)),
    },
  };
  const evidencePath = writeEvidence(evidence);
  console.error(`[eas-ios-release-smoke] evidence written: ${evidencePath}`);
  console.error(`[eas-ios-release-smoke] failed: ${evidence.summary.failure}`);
  process.exit(1);
}
