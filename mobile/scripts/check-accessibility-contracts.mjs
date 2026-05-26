#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mobileRoot = resolve(repoRoot, 'mobile');

function listFiles() {
  const output = execFileSync('rg', ['--files', 'app'], {
    cwd: mobileRoot,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => resolve(mobileRoot, file));
}

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

const failures = [];

for (const file of listFiles()) {
  const source = readFileSync(file, 'utf8');
  const textInputBlocks = source.matchAll(/<TextInput\b[\s\S]*?\/>/g);

  for (const match of textInputBlocks) {
    const block = match[0];
    const missing = [];

    if (!/\baccessibilityLabel=/.test(block)) missing.push('accessibilityLabel');
    if (!/\baccessibilityHint=/.test(block)) missing.push('accessibilityHint');

    if (missing.length) {
      failures.push({
        file: relative(repoRoot, file),
        line: getLineNumber(source, match.index ?? 0),
        missing,
      });
    }
  }
}

if (failures.length) {
  console.error('[accessibility-check] TextInput contract failures:');
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} missing ${failure.missing.join(', ')}`);
  }
  process.exit(1);
}

console.log('[accessibility-check] ok: App TextInput labels and hints are present');
