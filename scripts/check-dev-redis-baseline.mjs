#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const startDev = read('scripts/start-dev.sh');
const backendEnvExample = read('backend/.env.example');
const redisCompose = read('backend/docker-compose.redis.yml');

const REQUIRED = [
  ['start-dev ensures Redis availability', startDev, 'ensure_redis'],
  ['start-dev exports local REDIS_URL fallback', startDev, 'export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"'],
  ['start-dev disables simple lock fallback by default', startDev, 'export ALLOW_SIMPLE_LOCK="${ALLOW_SIMPLE_LOCK:-false}"'],
  ['start-dev starts backend', startDev, 'start_service "backend" 3001'],
  ['start-dev starts main frontend', startDev, 'start_service "main frontend" 5173'],
  ['start-dev starts admin frontend', startDev, 'start_service "admin frontend" 5175'],
  ['env example documents local Redis URL', backendEnvExample, '# REDIS_URL=redis://127.0.0.1:6379'],
  ['env example documents simple lock default', backendEnvExample, '# ALLOW_SIMPLE_LOCK=false'],
  ['env example documents AI Stream Redis behavior', backendEnvExample, 'AI Stream runtime 會在有 REDIS_URL 時自動啟用'],
  ['docker compose exposes Redis', redisCompose, '"6379:6379"'],
];

const failures = [];

for (const [label, content, snippet] of REQUIRED) {
  if (!content.includes(snippet)) failures.push(`${label}: missing ${snippet}`);
}

if (failures.length > 0) {
  console.error('[dev-redis-baseline] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[dev-redis-baseline] ok: local dev Redis baseline is script-enforced and documented');
