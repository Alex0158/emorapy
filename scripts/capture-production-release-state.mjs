#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertVersionService,
  buildRailwayAutoDeployStatusRequest,
  extractRailwayAutoDeployStatus,
  extractRailwayCurrentDeployment,
  extractRailwayServiceIdentity,
  extractVercelDeploymentIdentity,
  extractVersionIdentity,
  normalizeBaseUrl,
} from './lib/production-release-state.mjs';

const outputPath = process.env.RELEASE_STATE_OUTPUT || 'temp/production-release-state/previous.json';
const railwayStatusPath = process.env.RAILWAY_STATUS_PATH;
const railwayEnvironment = process.env.PRODUCTION_RAILWAY_ENVIRONMENT || 'production';
const railwayService = process.env.PRODUCTION_RAILWAY_SERVICE;
const railwayProjectId = process.env.RAILWAY_PROJECT_ID?.trim();
const railwayApiToken = process.env.RAILWAY_API_TOKEN?.trim();
const railwayProjectToken = process.env.RAILWAY_TOKEN?.trim();
const backendBaseUrl = normalizeBaseUrl(process.env.BACKEND_BASE_URL, 'BACKEND_BASE_URL');
const mainWebUrl = normalizeBaseUrl(process.env.MAIN_WEB_URL, 'MAIN_WEB_URL');
const adminWebUrl = normalizeBaseUrl(process.env.ADMIN_WEB_URL, 'ADMIN_WEB_URL');
const vercelToken = process.env.VERCEL_TOKEN?.trim();
const vercelOrgId = process.env.VERCEL_ORG_ID?.trim();
const previousEmailDeliveryMode = process.env.PREVIOUS_EMAIL_DELIVERY_MODE?.trim();

if (!railwayStatusPath) throw new Error('RAILWAY_STATUS_PATH is required');
if (!railwayService) throw new Error('PRODUCTION_RAILWAY_SERVICE is required');
if (!railwayProjectId) throw new Error('RAILWAY_PROJECT_ID is required');
if (!vercelToken) throw new Error('VERCEL_TOKEN is required');
if (!vercelOrgId) throw new Error('VERCEL_ORG_ID is required');
if (!['smtp', 'resend_api'].includes(previousEmailDeliveryMode)) {
  throw new Error('PREVIOUS_EMAIL_DELIVERY_MODE must be smtp or resend_api');
}

async function fetchJson(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          ...options.headers,
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw new Error(`Unable to fetch ${new URL(url).origin}: ${lastError?.message || 'unknown error'}`);
}

async function readVersion(baseUrl, pathname) {
  const url = `${baseUrl}${pathname}?release_state=${Date.now()}`;
  return extractVersionIdentity(await fetchJson(url), url);
}

async function readVercelDeployment(productionUrl, label) {
  const hostname = new URL(productionUrl).hostname;
  const apiUrl = new URL(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(hostname)}`,
  );
  apiUrl.searchParams.set('teamId', vercelOrgId);
  const deployment = extractVercelDeploymentIdentity(
    await fetchJson(apiUrl.toString(), {
      headers: { Authorization: `Bearer ${vercelToken}` },
    }),
    label,
  );
  if (deployment.readyState && deployment.readyState !== 'READY') {
    throw new Error(`${label} is not READY (state=${deployment.readyState})`);
  }
  return deployment;
}

async function captureWebSurface(name, productionUrl, expectedService) {
  const [version, deployment] = await Promise.all([
    readVersion(productionUrl, '/version.json'),
    readVercelDeployment(productionUrl, `${name} Vercel deployment`),
  ]);
  assertVersionService(version, expectedService, `${name} version endpoint`);
  if (deployment.commitSha && deployment.commitSha !== version.commitSha) {
    throw new Error(
      `${name} Vercel metadata commit ${deployment.commitSha} does not match version endpoint ${version.commitSha}`,
    );
  }
  return {
    productionUrl,
    service: version.service,
    deploymentId: deployment.deploymentId,
    deploymentUrl: deployment.deploymentUrl,
    commitSha: version.commitSha,
    deploymentCommitSha: deployment.commitSha,
  };
}

const railwayStatus = JSON.parse(await readFile(railwayStatusPath, 'utf8'));
const railwayTarget = extractRailwayServiceIdentity(
  railwayStatus,
  railwayEnvironment,
  railwayService,
);
if (railwayTarget.projectId !== railwayProjectId) {
  throw new Error(
    `Railway status project ${railwayTarget.projectId} does not match configured project ${railwayProjectId}`,
  );
}
const expectedSourceRepo = process.env.GITHUB_REPOSITORY?.trim();
if (expectedSourceRepo && railwayTarget.sourceRepo !== expectedSourceRepo) {
  throw new Error(
    `Railway source repo ${railwayTarget.sourceRepo} does not match ${expectedSourceRepo}`,
  );
}
const autoDeployRequest = buildRailwayAutoDeployStatusRequest({
  ...railwayTarget,
  apiToken: railwayApiToken,
  projectToken: railwayProjectToken,
});
const railwayAutoDeploy = extractRailwayAutoDeployStatus(await fetchJson(
  autoDeployRequest.url,
  {
    method: 'POST',
    headers: autoDeployRequest.headers,
    body: JSON.stringify(autoDeployRequest.body),
  },
));
if (railwayAutoDeploy.enabled) {
  throw new Error(
    'Railway Production GitHub auto-deploy must be disabled before capturing a rollback baseline',
  );
}
const railwayDeployment = extractRailwayCurrentDeployment(
  railwayStatus,
  railwayEnvironment,
  railwayService,
);
if (railwayDeployment.status !== 'SUCCESS') {
  throw new Error(
    `Current Railway deployment ${railwayDeployment.id} is not SUCCESS (status=${railwayDeployment.status})`,
  );
}

const [backendVersion, main, admin] = await Promise.all([
  readVersion(backendBaseUrl, '/version'),
  captureWebSurface('main', mainWebUrl, 'frontend'),
  captureWebSurface('admin', adminWebUrl, 'frontend-admin'),
]);
assertVersionService(backendVersion, 'backend', 'backend version endpoint');

if (backendVersion.deploymentId && backendVersion.deploymentId !== railwayDeployment.id) {
  throw new Error(
    `Railway current deployment ${railwayDeployment.id} does not match backend version deployment ${backendVersion.deploymentId}`,
  );
}

const state = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  databaseRollbackPolicy: 'expand-only-no-down-migration',
  backend: {
    baseUrl: backendBaseUrl,
    service: backendVersion.service,
    commitSha: backendVersion.commitSha,
    deploymentId: backendVersion.deploymentId,
    railwayDeploymentId: railwayDeployment.id,
    railwaySourceRepo: railwayTarget.sourceRepo,
    railwayAutoDeployEnabled: railwayAutoDeploy.enabled,
    emailDeliveryMode: previousEmailDeliveryMode,
  },
  web: { main, admin },
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
console.log(`Captured production rollback baseline at ${outputPath}.`);
