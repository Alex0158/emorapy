#!/usr/bin/env node

import { appendFile, readFile } from 'node:fs/promises';
import { EOL } from 'node:os';

const envFile = process.argv[2];
const githubEnvFile = process.env.GITHUB_ENV;

if (!envFile) {
  console.error('Usage: node scripts/import-vercel-public-env.mjs <env-file>');
  process.exit(1);
}

if (!githubEnvFile) {
  console.error('GITHUB_ENV is not available.');
  process.exit(1);
}

const stripQuotes = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const lines = (await readFile(envFile, 'utf8')).split(/\r?\n/);
const publicEntries = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    continue;
  }

  const equalIndex = trimmed.indexOf('=');
  if (equalIndex === -1) {
    continue;
  }

  const key = trimmed.slice(0, equalIndex).trim();
  if (!/^VITE_[A-Z0-9_]+$/.test(key)) {
    continue;
  }

  const value = stripQuotes(trimmed.slice(equalIndex + 1));
  publicEntries.push(`${key}=${value}`);
}

if (publicEntries.length > 0) {
  await appendFile(githubEnvFile, `${publicEntries.join(EOL)}${EOL}`, 'utf8');
}
