#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mobileRoot = resolve(repoRoot, 'mobile');

const protectedModules = [
  'expo-secure-store',
  'expo-image-picker',
  'expo-notifications',
  'expo-linking',
];

const scannedRoots = ['app', 'src'];
const platformDirPattern = /(^|\/)src\/platform\//;

function listFiles() {
  const files = [];
  for (const root of scannedRoots) {
    const output = execFileSync('rg', ['--files', root], {
      cwd: mobileRoot,
      encoding: 'utf8',
    });
    files.push(
      ...output
        .split('\n')
        .filter((file) => /\.(tsx?|jsx?)$/.test(file))
        .map((file) => resolve(mobileRoot, file))
    );
  }
  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function isPlatformFile(file) {
  return platformDirPattern.test(relative(mobileRoot, file));
}

const failures = [];

for (const file of listFiles()) {
  const source = readFileSync(file, 'utf8');
  const relativeFile = relative(repoRoot, file);
  const platformFile = isPlatformFile(file);

  if (!platformFile) {
    for (const moduleName of protectedModules) {
      const modulePattern = new RegExp(
        `(from\\s+['"]${moduleName}['"]|require\\(['"]${moduleName}['"]\\)|import\\(['"]${moduleName}['"]\\))`,
        'g'
      );
      for (const match of source.matchAll(modulePattern)) {
        failures.push({
          file: relativeFile,
          line: lineNumber(source, match.index ?? 0),
          reason: `direct ${moduleName} import must go through mobile/src/platform`,
        });
      }
    }
  }

  const appStatePattern = /\bAppState\b/g;
  if (!platformFile) {
    for (const match of source.matchAll(appStatePattern)) {
      failures.push({
        file: relativeFile,
        line: lineNumber(source, match.index ?? 0),
        reason: 'direct AppState usage must go through mobile/src/platform/lifecycle',
      });
    }
  }
}

if (failures.length) {
  console.error('[platform-boundary-check] native side-effect boundary failures:');
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} ${failure.reason}`);
  }
  process.exit(1);
}

console.log('[platform-boundary-check] ok: native side effects are routed through platform adapters');
