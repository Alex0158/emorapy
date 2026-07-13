import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertSameReleaseIdentity,
  assertVersionService,
  buildRailwayRollbackRequest,
  extractRailwayRollbackDeployment,
  extractRailwayCurrentDeployment,
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

test('extractRailwayCurrentDeployment requires one exact environment and service', () => {
  const status = {
    environments: {
      edges: [
        {
          node: {
            name: 'production',
            serviceInstances: {
              edges: [
                {
                  node: {
                    serviceName: 'emorapy-api',
                    latestDeployment: { id: 'railway-previous', status: 'SUCCESS' },
                  },
                },
              ],
            },
          },
        },
      ],
    },
  };

  assert.deepEqual(extractRailwayCurrentDeployment(status, 'production', 'emorapy-api'), {
    id: 'railway-previous',
    status: 'SUCCESS',
  });
  assert.throws(
    () => extractRailwayCurrentDeployment(status, 'production', 'missing'),
    /found 0/,
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

test('buildRailwayRollbackRequest uses the official auth header for each token type', () => {
  const account = buildRailwayRollbackRequest({
    deploymentId: 'railway-previous',
    apiToken: 'account-token',
    projectToken: 'project-token',
  });
  assert.equal(account.url, 'https://backboard.railway.com/graphql/v2');
  assert.deepEqual(account.body.variables, { id: 'railway-previous' });
  assert.match(account.body.query, /deploymentRollback\(id: \$id\)\s*\{\s*id\s+status\s*\}/);
  assert.equal(account.headers.Authorization, 'Bearer account-token');
  assert.equal(account.headers['Project-Access-Token'], undefined);

  const project = buildRailwayRollbackRequest({
    deploymentId: 'railway-previous',
    projectToken: 'project-token',
  });
  assert.equal(project.headers.Authorization, undefined);
  assert.equal(project.headers['Project-Access-Token'], 'project-token');
});

test('extractRailwayRollbackDeployment requires the new rollback deployment identity', () => {
  assert.deepEqual(
    extractRailwayRollbackDeployment({
      data: { deploymentRollback: { id: 'railway-rollback-new', status: 'BUILDING' } },
    }),
    { id: 'railway-rollback-new', status: 'BUILDING' },
  );
  assert.throws(
    () => extractRailwayRollbackDeployment({ errors: [{ message: 'not rollbackable' }] }),
    /not rollbackable/,
  );
  assert.throws(
    () => extractRailwayRollbackDeployment({ data: { deploymentRollback: true } }),
    /must be an object/,
  );
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
