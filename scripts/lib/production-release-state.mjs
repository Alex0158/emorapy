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

function findRailwayServiceInstance(statusPayload, environmentName, serviceName) {
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
      matches.push({ environment, service });
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one Railway ${environmentName}/${serviceName} service instance; found ${matches.length}`,
    );
  }

  return { status, ...matches[0] };
}

export function extractRailwayServiceIdentity(statusPayload, environmentName, serviceName) {
  const { status, environment, service } = findRailwayServiceInstance(
    statusPayload,
    environmentName,
    serviceName,
  );

  return {
    projectId: requiredString(status.id, 'Railway project id'),
    environmentId: requiredString(environment.id, 'Railway environment id'),
    serviceId: requiredString(service.serviceId, 'Railway service id'),
    sourceRepo: requiredString(service.source?.repo, 'Railway service source repo'),
  };
}

export function extractRailwayCurrentDeployment(statusPayload, environmentName, serviceName) {
  const { service } = findRailwayServiceInstance(statusPayload, environmentName, serviceName);
  const latest = {
    id: requiredString(service.latestDeployment?.id, 'Railway latest deployment id'),
    status: requiredString(
      service.latestDeployment?.status,
      'Railway latest deployment status',
    ),
  };
  const active = extractRailwayActiveDeployment(statusPayload, environmentName, serviceName);

  if (latest.id === active.id) {
    if (latest.status !== 'SUCCESS') {
      throw new Error(
        `Railway latest/active deployment ${latest.id} is not SUCCESS (status=${latest.status})`,
      );
    }
    return active;
  }

  const inProgressStatuses = new Set([
    'BUILDING',
    'DEPLOYING',
    'INITIALIZING',
    'PENDING',
    'QUEUED',
    'WAITING',
  ]);
  if (inProgressStatuses.has(latest.status)) {
    throw new Error(
      `Railway deployment ${latest.id} is still in progress (status=${latest.status}); rollback baseline is unsettled`,
    );
  }
  if (latest.status !== 'FAILED') {
    throw new Error(
      `Railway latest deployment ${latest.id} is not the active deployment and has unsupported status ${latest.status}`,
    );
  }

  return active;
}

export function extractRailwayActiveDeployment(statusPayload, environmentName, serviceName) {
  const { service } = findRailwayServiceInstance(statusPayload, environmentName, serviceName);
  if (!Array.isArray(service.activeDeployments)) {
    throw new Error('Railway service instance has no activeDeployments array');
  }
  if (service.activeDeployments.length !== 1) {
    throw new Error(
      `Expected exactly one active Railway deployment; found ${service.activeDeployments.length}`,
    );
  }

  const active = {
    id: requiredString(service.activeDeployments[0]?.id, 'Railway active deployment id'),
    status: requiredString(
      service.activeDeployments[0]?.status,
      'Railway active deployment status',
    ),
  };
  if (active.status !== 'SUCCESS') {
    throw new Error(
      `Active Railway deployment ${active.id} is not SUCCESS (status=${active.status})`,
    );
  }
  return active;
}

export function buildRailwayAutoDeployStatusRequest({
  projectId,
  environmentId,
  serviceId,
  apiToken,
  projectToken,
}) {
  const accountToken = typeof apiToken === 'string' ? apiToken.trim() : '';
  const scopedToken = typeof projectToken === 'string' ? projectToken.trim() : '';
  if (!accountToken && !scopedToken) {
    throw new Error('Railway auto-deploy status requires RAILWAY_API_TOKEN or RAILWAY_TOKEN');
  }

  return {
    url: RAILWAY_GRAPHQL_ENDPOINT,
    headers: {
      'Content-Type': 'application/json',
      ...(accountToken
        ? { Authorization: `Bearer ${accountToken}` }
        : { 'Project-Access-Token': scopedToken }),
    },
    body: {
      query: `query serviceInstanceAutoDeployStatus(
  $projectId: String!
  $environmentId: String!
  $serviceId: String!
) {
  serviceInstanceAutoDeployStatus(
    projectId: $projectId
    environmentId: $environmentId
    serviceId: $serviceId
  ) {
    enabled
    canEnable
    reason
  }
}`,
      variables: {
        projectId: requiredString(projectId, 'Railway project id'),
        environmentId: requiredString(environmentId, 'Railway environment id'),
        serviceId: requiredString(serviceId, 'Railway service id'),
      },
    },
  };
}

export function extractRailwayAutoDeployStatus(payload) {
  const root = asObject(payload, 'Railway auto-deploy status payload');
  if (Array.isArray(root.errors) && root.errors.length > 0) {
    throw new Error(`Railway auto-deploy status failed: ${JSON.stringify(root.errors)}`);
  }
  const status = asObject(
    root.data?.serviceInstanceAutoDeployStatus,
    'Railway auto-deploy status result',
  );
  if (typeof status.enabled !== 'boolean' || typeof status.canEnable !== 'boolean') {
    throw new Error('Railway auto-deploy status must include boolean enabled/canEnable fields');
  }
  return {
    enabled: status.enabled,
    canEnable: status.canEnable,
    reason: typeof status.reason === 'string' ? status.reason : null,
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

export function assertRailwayRollbackObservation({
  version,
  railway,
  expectedCommitSha,
  previousActiveDeploymentId,
  expectedActiveDeploymentId = null,
  requireDeploymentTransition,
}) {
  const expectedCommit = requiredString(expectedCommitSha, 'Expected rollback commit SHA');
  const previousDeployment = requiredString(
    previousActiveDeploymentId,
    'Previous active Railway deployment id',
  );
  const activeDeployment = requiredString(railway?.id, 'Active Railway deployment id');
  if (requireDeploymentTransition && activeDeployment === previousDeployment) {
    throw new Error(`Railway active deployment has not left ${previousDeployment}`);
  }
  if (expectedActiveDeploymentId && activeDeployment !== expectedActiveDeploymentId) {
    throw new Error(
      `Railway current deployment mismatch: expected ${expectedActiveDeploymentId}, got ${activeDeployment}`,
    );
  }
  if (railway?.status !== 'SUCCESS') {
    throw new Error(
      `Railway rollback deployment ${activeDeployment} is not SUCCESS (status=${railway?.status || 'missing'})`,
    );
  }
  if (version?.commitSha !== expectedCommit) {
    throw new Error(
      `backend production commit mismatch: expected ${expectedCommit}, got ${version?.commitSha || 'missing'}`,
    );
  }
  if (version.deploymentId && version.deploymentId !== activeDeployment) {
    throw new Error(
      `backend production deployment mismatch: Railway=${activeDeployment}, endpoint=${version.deploymentId}`,
    );
  }
  return { version, railway };
}

function buildRailwayAuthHeaders(apiToken, projectToken, action) {
  const accountToken = typeof apiToken === 'string' ? apiToken.trim() : '';
  const scopedToken = typeof projectToken === 'string' ? projectToken.trim() : '';
  if (!accountToken && !scopedToken) {
    throw new Error(`${action} requires RAILWAY_API_TOKEN or RAILWAY_TOKEN`);
  }
  return {
    'Content-Type': 'application/json',
    ...(accountToken
      ? { Authorization: `Bearer ${accountToken}` }
      : { 'Project-Access-Token': scopedToken }),
  };
}

export function buildRailwayRollbackTargetRequest({ deploymentId, apiToken, projectToken }) {
  const id = requiredString(deploymentId, 'Railway rollback target deployment id');
  return {
    url: RAILWAY_GRAPHQL_ENDPOINT,
    headers: buildRailwayAuthHeaders(
      apiToken,
      projectToken,
      'Railway rollback target inspection',
    ),
    body: {
      query: `query deploymentRollbackTarget($id: String!) {
  deployment(id: $id) {
    id
    status
    canRollback
    projectId
    environmentId
    serviceId
  }
}`,
      variables: { id },
    },
  };
}

export function extractRailwayRollbackTarget(payload, expectedScope = {}) {
  const root = asObject(payload, 'Railway rollback target payload');
  if (Array.isArray(root.errors) && root.errors.length > 0) {
    throw new Error(`Railway rollback target inspection failed: ${JSON.stringify(root.errors)}`);
  }
  const deployment = asObject(root.data?.deployment, 'Railway rollback target result');
  const target = {
    id: requiredString(deployment.id, 'Railway rollback target id'),
    status: requiredString(deployment.status, 'Railway rollback target status'),
    canRollback: deployment.canRollback,
    projectId: requiredString(deployment.projectId, 'Railway rollback target project id'),
    environmentId: requiredString(
      deployment.environmentId,
      'Railway rollback target environment id',
    ),
    serviceId: requiredString(deployment.serviceId, 'Railway rollback target service id'),
  };
  if (target.canRollback !== true) {
    throw new Error(`Railway deployment ${target.id} cannot be rolled back`);
  }

  for (const field of ['projectId', 'environmentId', 'serviceId']) {
    const expected = expectedScope[field];
    if (typeof expected === 'string' && expected.trim() !== '' && target[field] !== expected.trim()) {
      throw new Error(
        `Railway rollback target ${field} mismatch: expected ${expected.trim()}, got ${target[field]}`,
      );
    }
  }
  return target;
}

export function buildRailwayRollbackRequest({ deploymentId, apiToken, projectToken }) {
  const id = requiredString(deploymentId, 'Railway rollback deployment id');

  return {
    url: RAILWAY_GRAPHQL_ENDPOINT,
    headers: buildRailwayAuthHeaders(apiToken, projectToken, 'Railway rollback'),
    body: {
      query: `mutation deploymentRollback($id: String!) {
  deploymentRollback(id: $id)
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
  if (root.data?.deploymentRollback !== true) {
    throw new Error('Railway deploymentRollback was not accepted');
  }
  return { accepted: true };
}
