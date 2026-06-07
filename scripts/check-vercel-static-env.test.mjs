import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const scriptPath = new URL('./check-vercel-static-env.mjs', import.meta.url).pathname;

const serverFixture = `
  const { createServer } = require('node:http');
  const routes = JSON.parse(process.env.ROUTES_JSON || '{}');
  const server = createServer((req, res) => {
    const body = routes[req.url || '/'];
    if (body === undefined) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': req.url && req.url.endsWith('.js') ? 'application/javascript' : 'text/html' });
    res.end(body);
  });
  server.listen(0, '127.0.0.1', () => {
    process.stdout.write(String(server.address().port) + '\\n');
  });
`;

const withServer = async (routes, callback) => {
  const child = spawn(process.execPath, ['-e', serverFixture], {
    env: {
      ...process.env,
      ROUTES_JSON: JSON.stringify(routes),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('fixture server did not start')), 3000);
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
      const line = output.split(/\r?\n/).find(Boolean);
      if (line) {
        clearTimeout(timer);
        resolve(line);
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`fixture server exited with ${code}`));
      }
    });
  });

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    child.kill('SIGTERM');
  }
};

test('passes when a static JS asset contains the expected API base URL', async () => {
  await withServer({
    '/': '<!doctype html><script type="module" src="/assets/index.js"></script>',
    '/assets/index.js': 'const api = "https://api.example.com/api/v1";',
  }, async (baseUrl) => {
    const result = spawnSync(process.execPath, [scriptPath, 'main web', baseUrl, 'https://api.example.com/api/v1'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /static bundle contains expected API base URL/);
  });
});

test('fails when static JS assets do not contain the expected API base URL', async () => {
  await withServer({
    '/': '<!doctype html><script type="module" src="/assets/index.js"></script>',
    '/assets/index.js': 'const api = "http://localhost:3001/api/v1";',
  }, async (baseUrl) => {
    const result = spawnSync(process.execPath, [scriptPath, 'main web', baseUrl, 'https://api.example.com/api/v1'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not contain expected API base URL/);
  });
});
