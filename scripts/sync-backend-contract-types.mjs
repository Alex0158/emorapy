import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(repoRoot, 'packages/contracts/types/chat.d.ts');
const target = path.join(repoRoot, 'backend/src/types/contracts/chat.d.ts');
const checkOnly = process.argv.includes('--check');

const normalize = value => `${value.trimEnd()}\n`;
const canonical = normalize(await readFile(source, 'utf8'));
const current = await readFile(target, 'utf8').catch(() => '');

if (canonical === normalize(current)) {
  console.log('[backend-contract-types] chat.d.ts is in sync');
  process.exit(0);
}

if (checkOnly) {
  console.error(
    '[backend-contract-types] drift detected; run `npm run contracts:sync-backend-types`.'
  );
  process.exit(1);
}

await writeFile(target, canonical, 'utf8');
console.log('[backend-contract-types] synced chat.d.ts');
