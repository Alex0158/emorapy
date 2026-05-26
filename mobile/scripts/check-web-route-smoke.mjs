#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mobileRoot = path.join(repoRoot, 'mobile');
const distRoot = path.join(mobileRoot, 'dist');
const timeoutMs = Number(process.env.APP_WEB_ROUTE_SMOKE_TIMEOUT_MS ?? 12000);

const routeChecks = [
  { path: '/', testId: 'public.home.screen' },
  { path: '/quick', testId: 'quick.screen' },
  { path: '/quick/collaborative', testId: 'quick.collaborative.screen' },
  { path: '/quick/result', testId: 'quick.result.screen' },
  { path: '/auth', testId: 'auth.screen' },
  { path: '/auth?next=%2Fnotifications', testId: 'auth.screen' },
  { path: '/profile', testId: 'profile.auth-gate.screen' },
  { path: '/profile/interview', testId: 'profile.interview.auth-gate.screen' },
  { path: '/profile/story', testId: 'profile.story.auth-gate.screen' },
  { path: '/chat', testId: 'chat.home.screen' },
  { path: '/chat/room', testId: 'chat.room.missing.screen' },
  { path: '/chat/invite', testId: 'chat.invite.screen' },
  { path: '/case', testId: 'case.auth-gate.screen' },
  { path: '/repair', testId: 'repair.auth-gate.screen' },
  { path: '/notifications', testId: 'notifications.auth-gate.screen' },
  { path: '/modal', testId: 'modal.screen' },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'phone', width: 390, height: 844 },
];

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function fail(message) {
  console.error(`[web-route-smoke] ${message}`);
  process.exit(1);
}

function assertDistReady() {
  const indexPath = path.join(distRoot, 'index.html');
  const routesPath = path.join(distRoot, '_expo/.routes.json');
  if (!fs.existsSync(indexPath) || !fs.existsSync(routesPath)) {
    fail('mobile/dist is missing a web export. Run `npm --prefix mobile run smoke:web` before `web:routes:smoke`.');
  }
}

function resolveStaticFile(requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  const normalizedPath = path.posix.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^\/+/, '');
  const candidates = [
    relativePath,
    `${relativePath}.html`,
    path.posix.join(relativePath, 'index.html'),
  ];

  for (const candidate of candidates) {
    const absolutePath = path.resolve(distRoot, candidate);
    if (!absolutePath.startsWith(`${distRoot}${path.sep}`) && absolutePath !== distRoot) {
      continue;
    }
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return absolutePath;
    }
  }

  return null;
}

function createStaticServer() {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const filePath = resolveStaticFile(requestUrl.pathname);
    if (!filePath) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath);
    response.writeHead(200, {
      'content-type': contentTypes.get(extension) ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(response);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not allocate a local static server port.'));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

function testIdSelector(testId) {
  const escaped = String(testId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `[data-testid="${escaped}"], [data-test-id="${escaped}"], [data-testID="${escaped}"]`;
}

async function verifyPrimaryCtaStyle(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  const primary = page.locator(testIdSelector('public.home.quick')).first();
  await primary.waitFor({ state: 'attached', timeout: timeoutMs });
  const style = await primary.evaluate((element) => {
    const buttonStyle = window.getComputedStyle(element);
    const text = element.querySelector('*');
    const textStyle = text ? window.getComputedStyle(text) : buttonStyle;
    const rect = element.getBoundingClientRect();
    return {
      backgroundColor: buttonStyle.backgroundColor,
      color: textStyle.color,
      height: rect.height,
      width: rect.width,
      text: element.textContent ?? '',
    };
  });

  const failures = [];
  if (style.backgroundColor !== 'rgb(21, 122, 110)') {
    failures.push(`primary CTA background ${style.backgroundColor} did not match #157A6E`);
  }
  if (style.color !== 'rgb(255, 255, 255)') {
    failures.push(`primary CTA text color ${style.color} did not match white`);
  }
  if (style.height < 48) {
    failures.push(`primary CTA height ${style.height}px is below 48px`);
  }
  if (!style.text.includes('開始快速判斷')) {
    failures.push('primary CTA label is missing expected user-facing text');
  }
  if (failures.length) {
    throw new Error(failures.join('; '));
  }
}

async function verifyRoute(page, baseUrl, routeCheck, viewportName) {
  const pageErrors = [];
  const onPageError = (error) => {
    pageErrors.push(error.message);
  };
  page.on('pageerror', onPageError);

  try {
    await page.goto(`${baseUrl}${routeCheck.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    const marker = page.locator(testIdSelector(routeCheck.testId)).first();
    await marker.waitFor({ state: 'attached', timeout: timeoutMs });

    const bodyTextLength = await page.locator('body').evaluate((body) => (body.textContent ?? '').trim().length);
    if (bodyTextLength < 20) {
      throw new Error(`${routeCheck.path} rendered too little text in ${viewportName} viewport`);
    }
    if (pageErrors.length) {
      throw new Error(`${routeCheck.path} emitted page error(s) in ${viewportName}: ${pageErrors.join(' | ')}`);
    }
  } finally {
    page.off('pageerror', onPageError);
  }
}

assertDistReady();

let serverHandle;
let browser;

try {
  serverHandle = await createStaticServer();
  browser = await chromium.launch({ headless: true });

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    for (const routeCheck of routeChecks) {
      await verifyRoute(page, serverHandle.baseUrl, routeCheck, viewport.name);
    }
    if (viewport.name === 'desktop') {
      await verifyPrimaryCtaStyle(page, serverHandle.baseUrl);
    }
    await context.close();
  }

  console.log(
    `[web-route-smoke] ok: ${routeChecks.length} App routes rendered across ${viewports.length} viewport(s); primary CTA style checked`
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (browser) await browser.close();
  if (serverHandle?.server) {
    await new Promise((resolve) => serverHandle.server.close(resolve));
  }
}
