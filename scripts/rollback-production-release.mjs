#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  assertRailwayRollbackObservation,
  assertSameReleaseIdentity,
  buildRailwayRollbackRequest,
  buildRailwayRollbackTargetRequest,
  extractRailwayActiveDeployment,
  extractRailwayRollbackDeployment,
  extractRailwayRollbackTarget,
  extractRailwayCurrentDeployment,
  extractRailwayServiceIdentity,
  extractVercelDeploymentIdentity,
  extractVersionIdentity,
  releaseIdentityNeedsRollback,
} from './lib/production-release-state.mjs';

const execFileAsync = promisify(execFile);
const statePath = process.env.RELEASE_STATE_PATH
  || 'temp/production-release-state/previous.json';
const resultPath = process.env.ROLLBACK_RESULT_PATH
  || 'temp/production-release-rollback/rollback-result.json';
const timeoutSeconds = Number.parseInt(process.env.ROLLBACK_TIMEOUT_SECONDS || '300', 10);
const pollSeconds = Number.parseInt(process.env.ROLLBACK_POLL_SECONDS || '5', 10);
const vercelToken = process.env.VERCEL_TOKEN?.trim() || '';
const vercelOrgId = process.env.VERCEL_ORG_ID?.trim() || '';
const railwayApiToken = process.env.RAILWAY_API_TOKEN?.trim() || '';
const railwayProjectToken = process.env.RAILWAY_TOKEN?.trim() || '';
const railwayProjectId = process.env.RAILWAY_PROJECT_ID?.trim() || '';
const railwayEnvironment = process.env.PRODUCTION_RAILWAY_ENVIRONMENT?.trim() || 'production';
const railwayService = process.env.PRODUCTION_RAILWAY_SERVICE?.trim() || '';

const secretValues = [vercelToken, railwayApiToken, railwayProjectToken].filter(Boolean);

function sanitize(value) {
  let text = value instanceof Error ? value.message : String(value);
  for (const secret of secretValues) text = text.split(secret).join('[REDACTED]');
  return text.slice(-4_000);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      ...options.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    const detail = responseText.trim().slice(0, 2_000) || 'empty response';
    throw new Error(
      `${new URL(url).origin} returned HTTP ${response.status} with invalid JSON: ${detail}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `${new URL(url).origin} returned HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 2_000)}`,
    );
  }
  return payload;
}

async function readVersion(baseUrl, pathname) {
  const separator = pathname.includes('?') ? '&' : '?';
  const payload = await fetchJson(`${baseUrl}${pathname}${separator}rollback_probe=${Date.now()}`);
  return extractVersionIdentity(payload, `${baseUrl}${pathname}`);
}

async function readVercelDeployment(productionUrl, label) {
  const hostname = new URL(productionUrl).hostname;
  const apiUrl = new URL(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(hostname)}`,
  );
  apiUrl.searchParams.set('teamId', vercelOrgId);
  return extractVercelDeploymentIdentity(
    await fetchJson(apiUrl.toString(), {
      headers: { Authorization: `Bearer ${vercelToken}` },
    }),
    label,
  );
}

async function waitForIdentity(readIdentity, expected, label) {
  const deadline = Date.now() + timeoutSeconds * 1_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const actual = await readIdentity();
      assertSameReleaseIdentity(actual, expected, label);
      return actual;
    } catch (error) {
      lastError = error;
      await sleep(pollSeconds * 1_000);
    }
  }
  throw new Error(`${label} did not restore before timeout: ${sanitize(lastError || 'unknown')}`);
}

async function ensureVercelProjectLink(appDirectory, projectId) {
  const linkDirectory = path.join(appDirectory, '.vercel');
  await mkdir(linkDirectory, { recursive: true });
  await writeFile(
    path.join(linkDirectory, 'project.json'),
    `${JSON.stringify({ orgId: vercelOrgId, projectId })}\n`,
    'utf8',
  );
}

async function requestVercelRollback(previous, appDirectory, projectId) {
  if (!vercelToken || !vercelOrgId || !projectId) {
    throw new Error('Vercel rollback credentials or project identity are missing');
  }
  await ensureVercelProjectLink(appDirectory, projectId);
  await execFileAsync(
    'vercel',
    ['rollback', previous.deploymentUrl, '--yes', '--token', vercelToken],
    {
      cwd: appDirectory,
      env: {
        ...process.env,
        VERCEL_ORG_ID: vercelOrgId,
        VERCEL_PROJECT_ID: projectId,
      },
      maxBuffer: 2 * 1024 * 1024,
      timeout: 240_000,
    },
  );
}

async function ensureRailwayProjectLink() {
  if (!railwayProjectId || !railwayEnvironment || !railwayService) {
    throw new Error('Railway rollback project, environment, or service identity is missing');
  }
  await execFileAsync(
    'railway',
    [
      'link',
      '--project',
      railwayProjectId,
      '--environment',
      railwayEnvironment,
      '--service',
      railwayService,
    ],
    {
      env: process.env,
      maxBuffer: 2 * 1024 * 1024,
      timeout: 60_000,
    },
  );
}

async function restoreRailwayVariable(name, value) {
  await execFileAsync(
    'railway',
    [
      'variable',
      'set',
      `${name}=${value}`,
      '--skip-deploys',
      '--environment',
      railwayEnvironment,
      '--service',
      railwayService,
    ],
    {
      env: process.env,
      maxBuffer: 2 * 1024 * 1024,
      timeout: 60_000,
    },
  );
}

async function readRailwayStatus() {
  const { stdout } = await execFileAsync(
    'railway',
    ['status', '--json'],
    {
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 60_000,
    },
  );
  return JSON.parse(stdout);
}

async function readActiveRailwayDeployment() {
  return extractRailwayActiveDeployment(
    await readRailwayStatus(),
    railwayEnvironment,
    railwayService,
  );
}

async function requestRailwayRollback(previous, expectedScope) {
  const targetRequest = buildRailwayRollbackTargetRequest({
    deploymentId: previous.railwayDeploymentId,
    apiToken: railwayApiToken,
    projectToken: railwayProjectToken,
  });
  const target = extractRailwayRollbackTarget(
    await fetchJson(targetRequest.url, {
      method: 'POST',
      headers: targetRequest.headers,
      body: JSON.stringify(targetRequest.body),
    }),
    expectedScope,
  );
  const request = buildRailwayRollbackRequest({
    deploymentId: previous.railwayDeploymentId,
    apiToken: railwayApiToken,
    projectToken: railwayProjectToken,
  });
  const payload = await fetchJson(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });
  return {
    target,
    result: extractRailwayRollbackDeployment(payload),
  };
}

async function waitForBackendRollback({
  baseUrl,
  expectedCommitSha,
  previousActiveDeploymentId,
  expectedActiveDeploymentId = null,
  requireDeploymentTransition,
}) {
  const deadline = Date.now() + timeoutSeconds * 1_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const [version, railway] = await Promise.all([
        readVersion(baseUrl, '/version'),
        readActiveRailwayDeployment(),
      ]);
      return assertRailwayRollbackObservation({
        version,
        railway,
        expectedCommitSha,
        previousActiveDeploymentId,
        expectedActiveDeploymentId,
        requireDeploymentTransition,
      });
    } catch (error) {
      lastError = error;
      await sleep(pollSeconds * 1_000);
    }
  }
  throw new Error(
    `backend production did not restore before timeout: ${sanitize(lastError || 'unknown')}`,
  );
}

const previousState = JSON.parse(await readFile(statePath, 'utf8'));
if (previousState.schemaVersion !== 1) {
  throw new Error(`Unsupported release state schemaVersion ${previousState.schemaVersion}`);
}

const result = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  reason: process.env.ROLLBACK_REASON || 'production workflow failure',
  sourceStateCapturedAt: previousState.capturedAt,
  database: {
    action: 'none',
    policy: 'expand-only-no-down-migration',
    status: 'not-attempted',
  },
  surfaces: {},
};

async function persistResult() {
  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

async function rollbackVercelSurface(name, previous, appDirectory, projectId) {
  const surface = {
    platform: 'vercel',
    previousDeploymentId: previous.deploymentId,
    previousCommitSha: previous.commitSha,
    action: 'inspect',
    status: 'running',
  };
  result.surfaces[name] = surface;
  await persistResult();

  try {
    let current = null;
    try {
      const [deployment, version] = await Promise.all([
        readVercelDeployment(previous.productionUrl, `${name} current Vercel deployment`),
        readVersion(previous.productionUrl, '/version.json'),
      ]);
      current = {
        deploymentId: deployment.deploymentId,
        commitSha: version.commitSha,
      };
      surface.observedDeploymentId = current.deploymentId;
      surface.observedCommitSha = current.commitSha;
    } catch (error) {
      surface.initialInspectionError = sanitize(error);
    }

    if (releaseIdentityNeedsRollback(current, previous)) {
      surface.action = 'rollback';
      await requestVercelRollback(previous, appDirectory, projectId);
    } else {
      surface.action = 'none';
    }

    const restored = await waitForIdentity(
      async () => {
        const [deployment, version] = await Promise.all([
          readVercelDeployment(previous.productionUrl, `${name} restored Vercel deployment`),
          readVersion(previous.productionUrl, '/version.json'),
        ]);
        return {
          deploymentId: deployment.deploymentId,
          commitSha: version.commitSha,
        };
      },
      previous,
      `${name} production`,
    );
    surface.restoredDeploymentId = restored.deploymentId;
    surface.restoredCommitSha = restored.commitSha;
    surface.status = 'restored';
  } catch (error) {
    surface.status = 'failed';
    surface.error = sanitize(error);
  }
  await persistResult();
}

async function rollbackBackend(previous) {
  const surface = {
    platform: 'railway',
    previousDeploymentId: previous.deploymentId,
    previousRailwayDeploymentId: previous.railwayDeploymentId,
    previousCommitSha: previous.commitSha,
    action: 'inspect',
    status: 'running',
  };
  result.surfaces.backend = surface;
  await persistResult();

  try {
    await ensureRailwayProjectLink();
    if (!['smtp', 'resend_api'].includes(previous.emailDeliveryMode)) {
      throw new Error('Rollback baseline email delivery mode is invalid');
    }
    await restoreRailwayVariable('EMAIL_DELIVERY_MODE', previous.emailDeliveryMode);
    surface.emailDeliveryModeRestoration = {
      value: previous.emailDeliveryMode,
      status: 'restored-before-deployment-inspection',
    };
    let current = null;
    let currentRailway = null;
    let railwayScope = null;
    try {
      const [version, status] = await Promise.all([
        readVersion(previous.baseUrl, '/version'),
        readRailwayStatus(),
      ]);
      current = version;
      currentRailway = extractRailwayCurrentDeployment(
        status,
        railwayEnvironment,
        railwayService,
      );
      railwayScope = extractRailwayServiceIdentity(
        status,
        railwayEnvironment,
        railwayService,
      );
      surface.observedDeploymentId = current.deploymentId;
      surface.observedRailwayDeploymentId = currentRailway.id;
      surface.observedCommitSha = current.commitSha;
    } catch (error) {
      surface.initialInspectionError = sanitize(error);
    }

    const backendChanged = !current
      || !currentRailway
      || current.commitSha !== previous.commitSha
      || currentRailway.id !== previous.railwayDeploymentId
      || (current.deploymentId && current.deploymentId !== previous.railwayDeploymentId);
    if (backendChanged) {
      if (!currentRailway || !railwayScope) {
        throw new Error('Railway rollback requires a verified current deployment and service scope');
      }
      surface.action = 'rollback';
      const rollback = await requestRailwayRollback(previous, railwayScope);
      surface.rollbackTarget = rollback.target;
      surface.graphqlResult = rollback.result;
      surface.variableRestoration = {
        name: 'EMORAPY_COMMIT_SHA',
        value: previous.commitSha,
        status: 'delegated-to-railway-rollback',
      };
    } else {
      surface.action = 'none';
      await restoreRailwayVariable('EMORAPY_COMMIT_SHA', previous.commitSha);
      surface.variableRestoration = {
        name: 'EMORAPY_COMMIT_SHA',
        value: previous.commitSha,
        status: 'restored-without-redeploy',
      };
    }
    await persistResult();

    const restored = await waitForBackendRollback({
      baseUrl: previous.baseUrl,
      expectedCommitSha: previous.commitSha,
      previousActiveDeploymentId: currentRailway?.id ?? previous.railwayDeploymentId,
      expectedActiveDeploymentId: backendChanged ? null : previous.railwayDeploymentId,
      requireDeploymentTransition: backendChanged,
    });
    surface.restoredDeploymentId = restored.version.deploymentId;
    surface.restoredRailwayDeploymentId = restored.railway.id;
    surface.restoredCommitSha = restored.version.commitSha;
    if (backendChanged) {
      surface.rollbackDeploymentId = restored.railway.id;
      surface.variableRestoration.status = 'restored-by-railway-rollback';
    }
    surface.status = 'restored';
  } catch (error) {
    surface.status = 'failed';
    surface.error = sanitize(error);
  }
  await persistResult();
}

await persistResult();

await rollbackVercelSurface(
  'main',
  previousState.web.main,
  path.resolve('frontend'),
  process.env.VERCEL_MAIN_PROJECT_ID?.trim() || '',
);
await rollbackVercelSurface(
  'admin',
  previousState.web.admin,
  path.resolve('frontend-admin'),
  process.env.VERCEL_ADMIN_PROJECT_ID?.trim() || '',
);
await rollbackBackend(previousState.backend);

result.completedAt = new Date().toISOString();
const failedSurfaces = Object.entries(result.surfaces)
  .filter(([, surface]) => surface.status !== 'restored')
  .map(([name]) => name);
result.status = failedSurfaces.length === 0 ? 'restored' : 'failed';
result.failedSurfaces = failedSurfaces;
await persistResult();

if (failedSurfaces.length > 0) {
  console.error(`Production rollback failed for: ${failedSurfaces.join(', ')}. See ${resultPath}.`);
  process.exitCode = 1;
} else {
  console.log(`Production release restored to the captured baseline. Evidence: ${resultPath}.`);
}
