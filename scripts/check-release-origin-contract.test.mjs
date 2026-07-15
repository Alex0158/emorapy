import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scriptPath = new URL('./check-release-origin-contract.mjs', import.meta.url).pathname;
const releaseGatePath = new URL('./ops-release-gate.sh', import.meta.url);
const productionWorkflowPath = new URL(
  '../.github/workflows/production-deploy-and-verify.yml',
  import.meta.url
);

const runScript = (args, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });

const withServer = async (handler, callback) => {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
};

test('passes only when every configured web origin receives the exact CORS contract', async () => {
  await withServer((request, response) => {
    const origin = request.headers.origin;
    response.writeHead(204, {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
    });
    response.end();
  }, async (backendBaseUrl) => {
    const result = await runScript(
      [backendBaseUrl, 'http://main.example.test', 'http://admin.example.test'],
      { ...process.env, ALLOW_HTTP_RELEASE_ORIGINS: 'true' }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /main\.example\.test/);
    assert.match(result.stdout, /admin\.example\.test/);
  });
});

test('fails when an origin is rejected or the exact allow-origin header is absent', async () => {
  await withServer((_request, response) => {
    response.writeHead(403, { 'content-type': 'application/json' });
    response.end('{}');
  }, async (backendBaseUrl) => {
    const result = await runScript([backendBaseUrl, 'http://main.example.test'], {
      ...process.env,
      ALLOW_HTTP_RELEASE_ORIGINS: 'true',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CORS preflight failed/);
  });
});

test('rejects non-origin URLs before sending a request', async () => {
  const result = await runScript([
    'https://api.example.test',
    'https://main.example.test/path',
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be an origin without path/);
});

test('production release wiring fails closed on canonical targets and runs the origin gate', async () => {
  const [releaseGate, workflow] = await Promise.all([
    readFile(releaseGatePath, 'utf8'),
    readFile(productionWorkflowPath, 'utf8'),
  ]);

  assert.match(
    releaseGate,
    /check-release-origin-contract\.mjs "\$BACKEND_BASE_URL" "\$MAIN_WEB_URL" "\$ADMIN_WEB_URL"/
  );
  assert.match(workflow, /Require canonical Production targets/);
  assert.match(workflow, /test "\$\{MAIN_WEB_URL%\/\}" = "https:\/\/emorapy\.com"/);
  assert.match(workflow, /test "\$\{ADMIN_WEB_URL%\/\}" = "https:\/\/admin\.emorapy\.com"/);
  assert.match(workflow, /test "\$\{BACKEND_BASE_URL%\/\}" = "https:\/\/api\.emorapy\.com"/);
  assert.match(workflow, /test "\$\{PRODUCTION_RAILWAY_SERVICE\}" = "emorapy-api"/);
});
