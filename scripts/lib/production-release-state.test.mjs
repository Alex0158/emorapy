import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertRailwayRollbackObservation,
  assertSameReleaseIdentity,
  assertVersionService,
  buildRailwayAutoDeployStatusRequest,
  buildRailwayRollbackRequest,
  buildRailwayRollbackTargetRequest,
  extractRailwayActiveDeployment,
  extractRailwayAutoDeployStatus,
  extractRailwayRollbackDeployment,
  extractRailwayRollbackTarget,
  extractRailwayCurrentDeployment,
  extractRailwayServiceIdentity,
  extractVercelDeploymentIdentity,
  extractVersionIdentity,
  releaseIdentityNeedsRollback,
} from './production-release-state.mjs';

test('extractVersionIdentity accepts nested and direct manifests', () => {
  assert.deepEqual(
    extractVersionIdentity({ data: { service: 'backend', commitSha: 'abc123', deploymentId: 'dpl-1' } }),
    { service: 'backend', commitSha: 'abc123', deploymentId: 'dpl-1' },
  );
  assert.deepEqual(
    extractVersionIdentity({ service: 'frontend', commitSha: 'def456' }),
    { service: 'frontend', commitSha: 'def456', deploymentId: null },
  );
  assert.deepEqual(
    extractVersionIdentity({ service: 'backend', commitSha: 'legacy-sha' }),
    { service: 'backend', commitSha: 'legacy-sha', deploymentId: null },
  );
  assert.throws(() => extractVersionIdentity({ commitSha: 'unknown' }), /cannot be unknown/);
  assert.doesNotThrow(() => assertVersionService(
    { service: 'frontend', commitSha: 'abc', deploymentId: null },
    'frontend',
    'main version endpoint',
  ));
  assert.throws(
    () => assertVersionService(
      { service: 'frontend-admin', commitSha: 'abc', deploymentId: null },
      'frontend',
      'main version endpoint',
    ),
    /service mismatch/,
  );
});

function railwayStatusFixture({
  latest = { id: 'railway-active', status: 'SUCCESS' },
  active = [{ id: 'railway-active', status: 'SUCCESS' }],
} = {}) {
  return {
    id: 'project-1',
    environments: {
      edges: [
        {
          node: {
            id: 'environment-1',
            name: 'production',
            serviceInstances: {
              edges: [
                {
                  node: {
                    serviceId: 'service-1',
                    serviceName: 'emorapy-api',
                    source: { repo: 'Alex0158/emorapy' },
                    latestDeployment: latest,
                    activeDeployments: active,
                  },
                },
              ],
            },
          },
        },
      ],
    },
  };
}

test('extractRailwayCurrentDeployment requires one exact active service deployment', () => {
  const status = railwayStatusFixture();

  assert.deepEqual(extractRailwayCurrentDeployment(status, 'production', 'emorapy-api'), {
    id: 'railway-active',
    status: 'SUCCESS',
  });
  assert.deepEqual(extractRailwayServiceIdentity(status, 'production', 'emorapy-api'), {
    projectId: 'project-1',
    environmentId: 'environment-1',
    serviceId: 'service-1',
    sourceRepo: 'Alex0158/emorapy',
  });
  assert.throws(
    () => extractRailwayCurrentDeployment(status, 'production', 'missing'),
    /found 0/,
  );
});

test('extractRailwayCurrentDeployment accepts a failed latest attempt but rejects unsettled state', () => {
  assert.deepEqual(extractRailwayCurrentDeployment(
    railwayStatusFixture({ latest: { id: 'railway-failed', status: 'FAILED' } }),
    'production',
    'emorapy-api',
  ), {
    id: 'railway-active',
    status: 'SUCCESS',
  });

  assert.throws(
    () => extractRailwayCurrentDeployment(
      railwayStatusFixture({ latest: { id: 'railway-building', status: 'BUILDING' } }),
      'production',
      'emorapy-api',
    ),
    /still in progress.*unsettled/,
  );
  assert.throws(
    () => extractRailwayCurrentDeployment(
      railwayStatusFixture({ latest: { id: 'railway-success-not-active', status: 'SUCCESS' } }),
      'production',
      'emorapy-api',
    ),
    /unsupported status SUCCESS/,
  );
});

test('extractRailwayActiveDeployment reads the running deployment without latest-history coupling', () => {
  assert.deepEqual(extractRailwayActiveDeployment(
    railwayStatusFixture({ latest: { id: 'railway-removed', status: 'REMOVED' } }),
    'production',
    'emorapy-api',
  ), {
    id: 'railway-active',
    status: 'SUCCESS',
  });
});

test('extractRailwayCurrentDeployment fails closed for missing or ambiguous active deployments', () => {
  assert.throws(
    () => extractRailwayCurrentDeployment(
      railwayStatusFixture({ active: [] }),
      'production',
      'emorapy-api',
    ),
    /exactly one active Railway deployment; found 0/,
  );
  assert.throws(
    () => extractRailwayCurrentDeployment(
      railwayStatusFixture({
        active: [
          { id: 'railway-active-a', status: 'SUCCESS' },
          { id: 'railway-active-b', status: 'SUCCESS' },
        ],
      }),
      'production',
      'emorapy-api',
    ),
    /exactly one active Railway deployment; found 2/,
  );
  assert.throws(
    () => extractRailwayCurrentDeployment(
      railwayStatusFixture({ active: [{ id: 'railway-active', status: 'FAILED' }] }),
      'production',
      'emorapy-api',
    ),
    /Active Railway deployment.*not SUCCESS/,
  );
});

test('Railway auto-deploy status request uses scoped auth and validates the response', () => {
  const account = buildRailwayAutoDeployStatusRequest({
    projectId: 'project-1',
    environmentId: 'environment-1',
    serviceId: 'service-1',
    apiToken: 'account-token',
    projectToken: 'project-token',
  });
  assert.equal(account.url, 'https://backboard.railway.com/graphql/v2');
  assert.equal(account.headers.Authorization, 'Bearer account-token');
  assert.equal(account.headers['Project-Access-Token'], undefined);
  assert.deepEqual(account.body.variables, {
    projectId: 'project-1',
    environmentId: 'environment-1',
    serviceId: 'service-1',
  });
  assert.match(account.body.query, /serviceInstanceAutoDeployStatus/);

  const project = buildRailwayAutoDeployStatusRequest({
    projectId: 'project-1',
    environmentId: 'environment-1',
    serviceId: 'service-1',
    projectToken: 'project-token',
  });
  assert.equal(project.headers.Authorization, undefined);
  assert.equal(project.headers['Project-Access-Token'], 'project-token');

  assert.deepEqual(extractRailwayAutoDeployStatus({
    data: {
      serviceInstanceAutoDeployStatus: {
        enabled: false,
        canEnable: true,
        reason: null,
      },
    },
  }), { enabled: false, canEnable: true, reason: null });
  assert.throws(
    () => extractRailwayAutoDeployStatus({ errors: [{ message: 'forbidden' }] }),
    /forbidden/,
  );
});

test('extractVercelDeploymentIdentity normalizes deployment metadata', () => {
  assert.deepEqual(
    extractVercelDeploymentIdentity({
      id: 'dpl_main_previous',
      url: 'emorapy-old.vercel.app',
      readyState: 'READY',
      meta: { githubCommitSha: 'abc123' },
    }),
    {
      deploymentId: 'dpl_main_previous',
      deploymentUrl: 'https://emorapy-old.vercel.app',
      commitSha: 'abc123',
      readyState: 'READY',
    },
  );
});

test('Railway rollback target inspection requires eligibility and exact service scope', () => {
  const request = buildRailwayRollbackTargetRequest({
    deploymentId: 'railway-previous',
    apiToken: 'account-token',
  });
  assert.deepEqual(request.body.variables, { id: 'railway-previous' });
  assert.match(request.body.query, /deployment\(id: \$id\)/);
  assert.match(request.body.query, /canRollback/);

  const payload = {
    data: {
      deployment: {
        id: 'railway-previous',
        status: 'REMOVED',
        canRollback: true,
        projectId: 'project-1',
        environmentId: 'environment-1',
        serviceId: 'service-1',
      },
    },
  };
  assert.deepEqual(
    extractRailwayRollbackTarget(payload, {
      projectId: 'project-1',
      environmentId: 'environment-1',
      serviceId: 'service-1',
    }),
    payload.data.deployment,
  );
  assert.throws(
    () => extractRailwayRollbackTarget({
      data: { deployment: { ...payload.data.deployment, canRollback: false } },
    }),
    /cannot be rolled back/,
  );
  assert.throws(
    () => extractRailwayRollbackTarget(payload, { serviceId: 'other-service' }),
    /serviceId mismatch/,
  );
  assert.throws(
    () => extractRailwayRollbackTarget({ errors: [{ message: 'forbidden' }] }),
    /forbidden/,
  );
});

test('buildRailwayRollbackRequest uses scalar mutation and official auth headers', () => {
  const account = buildRailwayRollbackRequest({
    deploymentId: 'railway-previous',
    apiToken: 'account-token',
    projectToken: 'project-token',
  });
  assert.equal(account.url, 'https://backboard.railway.com/graphql/v2');
  assert.deepEqual(account.body.variables, { id: 'railway-previous' });
  assert.match(account.body.query, /deploymentRollback\(id: \$id\)\s*\n\}/);
  assert.doesNotMatch(account.body.query, /deploymentRollback\(id: \$id\)\s*\{/);
  assert.equal(account.headers.Authorization, 'Bearer account-token');
  assert.equal(account.headers['Project-Access-Token'], undefined);

  const project = buildRailwayRollbackRequest({
    deploymentId: 'railway-previous',
    projectToken: 'project-token',
  });
  assert.equal(project.headers.Authorization, undefined);
  assert.equal(project.headers['Project-Access-Token'], 'project-token');
});

test('extractRailwayRollbackDeployment requires scalar acceptance', () => {
  assert.deepEqual(
    extractRailwayRollbackDeployment({
      data: { deploymentRollback: true },
    }),
    { accepted: true },
  );
  assert.throws(
    () => extractRailwayRollbackDeployment({ errors: [{ message: 'not rollbackable' }] }),
    /not rollbackable/,
  );
  assert.throws(
    () => extractRailwayRollbackDeployment({ data: { deploymentRollback: false } }),
    /not accepted/,
  );
});

test('Railway rollback observation requires an exact healthy transition', () => {
  const observation = {
    version: {
      commitSha: 'baseline-sha',
      deploymentId: 'railway-restored',
    },
    railway: {
      id: 'railway-restored',
      status: 'SUCCESS',
    },
    expectedCommitSha: 'baseline-sha',
    previousActiveDeploymentId: 'railway-new',
    requireDeploymentTransition: true,
  };
  assert.deepEqual(assertRailwayRollbackObservation(observation), {
    version: observation.version,
    railway: observation.railway,
  });
  assert.throws(
    () => assertRailwayRollbackObservation({
      ...observation,
      railway: { id: 'railway-new', status: 'SUCCESS' },
    }),
    /has not left/,
  );
  assert.throws(
    () => assertRailwayRollbackObservation({
      ...observation,
      version: { commitSha: 'wrong-sha', deploymentId: 'railway-restored' },
    }),
    /commit mismatch/,
  );
  assert.throws(
    () => assertRailwayRollbackObservation({
      ...observation,
      version: { commitSha: 'baseline-sha', deploymentId: 'other-deployment' },
    }),
    /deployment mismatch/,
  );
  assert.throws(
    () => assertRailwayRollbackObservation({
      ...observation,
      railway: { id: 'railway-restored', status: 'CRASHED' },
    }),
    /not SUCCESS/,
  );
});

test('production workflow keeps Vercel auth out of native curl arguments', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/production-deploy-and-verify.yml', import.meta.url),
    'utf8',
  );
  const verifierBlocks = workflow
    .split('version_payload="$(')
    .slice(1)
    .map((fragment) => fragment.split('\n          )"')[0])
    .filter((block) => block.includes('vercel curl /version.json'));

  assert.equal(verifierBlocks.length, 2);
  for (const block of verifierBlocks) {
    assert.match(block, /vercel curl \/version\.json/);
    assert.match(block, /-- --fail --silent --show-error/);
    assert.doesNotMatch(block, /--token/);
  }
  assert.match(workflow, /VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  assert.match(workflow, /service \/\/ \.data\.service \/\/ empty.*frontend"/);
  assert.match(workflow, /service \/\/ \.data\.service \/\/ empty.*frontend-admin"/);
});

test('release identity comparison checks both deployment and commit', () => {
  const previous = { deploymentId: 'dpl_previous', commitSha: 'abc123' };
  assert.equal(
    releaseIdentityNeedsRollback({ deploymentId: 'dpl_previous', commitSha: 'abc123' }, previous),
    false,
  );
  assert.equal(
    releaseIdentityNeedsRollback({ deploymentId: 'dpl_current', commitSha: 'abc123' }, previous),
    true,
  );
  assert.equal(releaseIdentityNeedsRollback(null, previous), true);
  assert.doesNotThrow(() => assertSameReleaseIdentity(previous, previous, 'surface'));
  assert.throws(
    () => assertSameReleaseIdentity({ deploymentId: 'dpl_previous', commitSha: 'new' }, previous, 'surface'),
    /commit mismatch/,
  );
  assert.doesNotThrow(() => assertSameReleaseIdentity(
    { deploymentId: null, commitSha: 'legacy-sha' },
    { deploymentId: null, commitSha: 'legacy-sha' },
    'legacy backend',
  ));
});
