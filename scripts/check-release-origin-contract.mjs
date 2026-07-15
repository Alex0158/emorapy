#!/usr/bin/env node

const [backendBaseUrl, ...webBaseUrls] = process.argv.slice(2);

if (!backendBaseUrl || webBaseUrls.length === 0) {
  console.error(
    'Usage: node scripts/check-release-origin-contract.mjs <backend-base-url> <web-base-url> [web-base-url...]'
  );
  process.exit(1);
}

const normalizeOrigin = (value, label) => {
  const url = new URL(value);
  if (url.protocol !== 'https:' && process.env.ALLOW_HTTP_RELEASE_ORIGINS !== 'true') {
    throw new Error(`${label} must use HTTPS`);
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} must be an origin without path, query, or fragment`);
  }
  return url.origin;
};

const checkOrigin = async (backendOrigin, webOrigin) => {
  const response = await fetch(`${backendOrigin}/api/v1/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: webOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });

  const allowedOrigin = response.headers.get('access-control-allow-origin');
  const allowedCredentials = response.headers.get('access-control-allow-credentials');
  if (response.status !== 204 || allowedOrigin !== webOrigin || allowedCredentials !== 'true') {
    throw new Error(
      `${webOrigin} CORS preflight failed: status=${response.status} allow-origin=${allowedOrigin || '(missing)'} allow-credentials=${allowedCredentials || '(missing)'}`
    );
  }

  console.log(`[ok] ${webOrigin} may call ${backendOrigin}`);
};

try {
  const backendOrigin = normalizeOrigin(backendBaseUrl, 'backend base URL');
  const uniqueWebOrigins = [...new Set(webBaseUrls.map((url) => normalizeOrigin(url, 'web base URL')))];
  for (const webOrigin of uniqueWebOrigins) {
    await checkOrigin(backendOrigin, webOrigin);
  }
} catch (error) {
  console.error(
    `[error] release origin contract failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
