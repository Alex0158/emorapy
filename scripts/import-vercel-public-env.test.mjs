import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const scriptPath = new URL('./import-vercel-public-env.mjs', import.meta.url).pathname;

test('imports only VITE public env into GitHub env and Vite production env file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cj-vercel-public-env-'));
  try {
    const sourceEnv = join(dir, 'vercel.env');
    const githubEnv = join(dir, 'github.env');
    await writeFile(
      sourceEnv,
      [
        'VITE_API_BASE_URL="https://api.example.com/api/v1"',
        "VITE_ADMIN_LOGIN_URL='https://admin.example.com/login'",
        'DATABASE_URL=postgresql://user:pass@example/db',
        'PLAIN_KEY=value',
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(githubEnv, '', 'utf8');

    const result = spawnSync(process.execPath, [scriptPath, sourceEnv], {
      cwd: dir,
      env: {
        ...process.env,
        GITHUB_ENV: githubEnv,
      },
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const githubEnvContent = await readFile(githubEnv, 'utf8');
    const viteEnvContent = await readFile(join(dir, '.env.production.local'), 'utf8');

    for (const content of [githubEnvContent, viteEnvContent]) {
      assert.match(content, /^VITE_API_BASE_URL=https:\/\/api\.example\.com\/api\/v1$/m);
      assert.match(content, /^VITE_ADMIN_LOGIN_URL=https:\/\/admin\.example\.com\/login$/m);
      assert.doesNotMatch(content, /DATABASE_URL/);
      assert.doesNotMatch(content, /PLAIN_KEY/);
      assert.doesNotMatch(content, /postgresql:\/\/user:pass/);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
