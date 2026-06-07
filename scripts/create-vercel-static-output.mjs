#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const appDirArg = process.argv[2];

if (!appDirArg) {
  console.error('Usage: node scripts/create-vercel-static-output.mjs <app-dir>');
  process.exit(1);
}

const repoRoot = process.cwd();
const appDir = path.resolve(repoRoot, appDirArg);
const distDir = path.join(appDir, 'dist');
const outputDir = path.join(appDir, '.vercel', 'output');
const staticDir = path.join(outputDir, 'static');
const vercelConfigPath = path.join(appDir, 'vercel.json');

const headersToObject = (headers = []) =>
  Object.fromEntries(headers.map((header) => [header.key, header.value]));

const config = JSON.parse(await readFile(vercelConfigPath, 'utf8'));
const routes = [];

for (const headerRule of config.headers || []) {
  routes.push({
    src: headerRule.source,
    headers: headersToObject(headerRule.headers),
    continue: true,
  });
}

routes.push({ handle: 'filesystem' });

for (const rewriteRule of config.rewrites || []) {
  routes.push({
    src: rewriteRule.source,
    dest: rewriteRule.destination,
  });
}

await rm(outputDir, { force: true, recursive: true });
await mkdir(staticDir, { recursive: true });
await cp(distDir, staticDir, { recursive: true });
await writeFile(
  path.join(outputDir, 'config.json'),
  `${JSON.stringify({ version: 3, routes }, null, 2)}\n`,
  'utf8'
);
