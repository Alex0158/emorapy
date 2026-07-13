const RAILWAY_GRAPHQL_ENDPOINT = 'https://backboard.railway.com/graphql/v2';

function asObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

export function normalizeBaseUrl(value, label = 'URL') {
  const raw = requiredString(value, label);
  const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
  parsed.pathname = parsed.pathname.replace(/\/$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export function extractVersionIdentity(payload, label = 'version payload') {
  const root = asObject(payload, label);
  const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data)
    ? root.data
    : root;

  const commitSha = requiredString(data.commitSha, `${label}.commitSha`);
  if (commitSha === 'unknown') {
    throw new Error(`${label}.commitSha cannot be unknown`);
  }

  const deploymentId = typeof data.deploymentId === 'string' && data.deploymentId.trim() !== ''
    ? data.deploymentId.trim()
    : null;

  return {
    service: typeof data.service === 'string' ? data.service.trim() : null,
    commitSha,
    deploymentId,
  };
}

export function assertVersionService(identity, expectedService, label) {
  const expected = requiredString(expectedService, `${label} expected service`);
  if (identity.service !== expected) {
    throw new Error(
      `${label} service mismatch: expected ${expected}, got ${identity.service || 'missing'}`,
    );
  }
}

export function extractRailwayCurrentDeployment(statusPayload, environmentName, serviceName) {
  const status = asObject(statusPayload, 'Railway status payload');
  const environments = status.environments?.edges;
  if (!Array.isArray(environments)) {
    throw new Error('Railway status payload has no environments.edges array');
  }

  const matches = [];
  for (const environmentEdge of environments) {
    const environment = environmentEdge?.node;
    if (environment?.name !== environmentName) continue;
    const serviceEdges = environment.serviceInstances?.edges;
    if (!Array.isArray(serviceEdges)) continue;
    for (const serviceEdge of serviceEdges) {
      const service = serviceEdge?.node;
      if (service?.serviceName !== serviceName) continue;
      matches.push({
        id: service.latestDeployment?.id,
        status: service.latestDeployment?.status,
      });
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one Railway ${environmentName}/${serviceName} service instance; found ${matches.length}`,
    );
  }

  return {
    id: requiredString(matches[0].id, 'Railway latest deployment id'),
    status: requiredString(matches[0].status, 'Railway latest deployment status'),
  };
}

export function extractVercelDeploymentIdentity(payload, label = 'Vercel deployment') {
  const deployment = asObject(payload, label);
  const deploymentUrl = normalizeBaseUrl(
    requiredString(deployment.url, `${label}.url`),
    `${label}.url`,
  );

  const commitCandidates = [
    deployment.gitSource?.sha,
    deployment.meta?.githubCommitSha,
    deployment.meta?.gitlabCommitSha,
    deployment.meta?.bitbucketCommitSha,
    deployment.meta?.gitCommitSha,
  ];
  const commitSha = commitCandidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim() !== '',
  );

  return {
    deploymentId: requiredString(deployment.id, `${label}.id`),
    deploymentUrl,
    commitSha: commitSha?.trim() || null,
    readyState: typeof deployment.readyState === 'string' ? deployment.readyState : null,
  };
}

export function assertSameReleaseIdentity(actual, expected, label) {
  if (actual.commitSha !== expected.commitSha) {
    throw new Error(
      `${label} commit mismatch: expected ${expected.commitSha}, got ${actual.commitSha}`,
    );
  }
  if (expected.deploymentId && actual.deploymentId !== expected.deploymentId) {
    throw new Error(
      `${label} deployment mismatch: expected ${expected.deploymentId}, got ${actual.deploymentId || 'missing'}`,
    );
  }
}

export function releaseIdentityNeedsRollback(current, previous) {
  if (!current) return true;
  if (previous.deploymentId && current.deploymentId !== previous.deploymentId) return true;
  return current.commitSha !== previous.commitSha;
}

export function buildRailwayRollbackRequest({ deploymentId, apiToken, projectToken }) {
  const id = requiredString(deploymentId, 'Railway rollback deployment id');
  const accountToken = typeof apiToken === 'string' ? apiToken.trim() : '';
  const scopedToken = typeof projectToken === 'string' ? projectToken.trim() : '';
  if (!accountToken && !scopedToken) {
    throw new Error('Railway rollback requires RAILWAY_API_TOKEN or RAILWAY_TOKEN');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(accountToken
      ? { Authorization: `Bearer ${accountToken}` }
      : { 'Project-Access-Token': scopedToken }),
  };

  return {
    url: RAILWAY_GRAPHQL_ENDPOINT,
    headers,
    body: {
      query: `mutation deploymentRollback($id: String!) {
  deploymentRollback(id: $id) {
    id
    status
  }
}`,
      variables: { id },
    },
  };
}

export function extractRailwayRollbackDeployment(payload) {
  const root = asObject(payload, 'Railway rollback payload');
  if (Array.isArray(root.errors) && root.errors.length > 0) {
    throw new Error(`Railway deploymentRollback failed: ${JSON.stringify(root.errors)}`);
  }
  const deployment = asObject(
    root.data?.deploymentRollback,
    'Railway deploymentRollback result',
  );
  return {
    id: requiredString(deployment.id, 'Railway rollback deployment id'),
    status: requiredString(deployment.status, 'Railway rollback deployment status'),
  };
}
