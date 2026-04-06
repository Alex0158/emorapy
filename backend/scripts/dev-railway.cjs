'use strict';

/**
 * 在本機用 `railway run` 注入遠端 DATABASE_URL / 其餘變數時，
 * 將 REDIS_URL 從 redis.railway.internal 改為 Redis 服務的 TCP Proxy（本機可連）。
 *
 * 可選覆寫（若 Railway 改版或 proxy 變更）：
 *   RAILWAY_REDIS_PUBLIC_HOST  預設 mainline.proxy.rlwy.net
 *   RAILWAY_REDIS_PUBLIC_PORT  預設 16130
 *
 * 使用：railway run -e production -- node scripts/dev-railway.cjs
 */
const { spawn } = require('child_process');
const path = require('path');
const { URL } = require('url');

const PROXY_HOST = process.env.RAILWAY_REDIS_PUBLIC_HOST || 'mainline.proxy.rlwy.net';
const PROXY_PORT = process.env.RAILWAY_REDIS_PUBLIC_PORT || '16130';
const railwayEnvironment =
  process.env.RAILWAY_ENVIRONMENT_NAME ||
  process.env.RAILWAY_ENVIRONMENT ||
  '';

function getDatabaseHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

if (
  railwayEnvironment === 'production' &&
  process.env.ALLOW_REMOTE_PRODUCTION_ENV !== 'true'
) {
  console.error(
    '[dev-railway] 已阻止將本機開發服務直接連到 Railway production 環境。'
  );
  console.error(
    '[dev-railway] 請改用 `npm run dev:railway` / `npm run dev:railway:staging`，或在確認風險後顯式使用 `npm run dev:railway:production`。'
  );
  process.exit(1);
}

const raw = process.env.REDIS_URL;
if (raw && raw.includes('railway.internal')) {
  try {
    const u = new URL(raw);
    u.hostname = PROXY_HOST;
    u.port = PROXY_PORT;
    process.env.REDIS_URL = u.toString();
  } catch (e) {
    console.error('[dev-railway] 無法改寫 REDIS_URL:', e.message);
    process.exit(1);
  }
}

process.env.NODE_ENV = 'development';

// 連遠端 DB 時預設不要每次啟動都 `prisma db push`（避免誤改 production schema）
if (process.env.RUN_MIGRATIONS === undefined) {
  process.env.RUN_MIGRATIONS = 'false';
}

console.log(
  '[dev-railway] 啟動本機開發服務',
  JSON.stringify(
    {
      railwayEnvironment: railwayEnvironment || 'unknown',
      databaseHost: getDatabaseHost(process.env.DATABASE_URL || ''),
      redisHost: process.env.REDIS_URL ? getDatabaseHost(process.env.REDIS_URL) : 'missing',
      runMigrations: process.env.RUN_MIGRATIONS,
    },
    null,
    2
  )
);

const backendRoot = path.join(__dirname, '..');
const child = spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
