import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  CORE_DOC_AUDIT_METADATA_END,
  CORE_DOC_AUDIT_METADATA_START,
  buildMetadataBlock,
  classifyCoreDoc,
  walkCoreDocsFiles,
} from './lib/core-docs-audit.mjs';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const auditDate = '2026-04-18';

function parseArgs(argv) {
  const prefixes = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--prefix' && argv[i + 1]) {
      prefixes.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--prefix=')) {
      prefixes.push(arg.slice('--prefix='.length));
    }
  }
  return {
    prefixes: [...new Set(prefixes.map((item) => item.replace(/\/+$/, '')).filter(Boolean))],
  };
}

function getHeadCommit() {
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

function replaceManagedMetadataBlock(content, metadataBlock) {
  const blockRe = new RegExp(
    `${CORE_DOC_AUDIT_METADATA_START}[\\s\\S]*?${CORE_DOC_AUDIT_METADATA_END}\\n*`,
    'm'
  );
  if (blockRe.test(content)) {
    return content.replace(blockRe, `${metadataBlock}\n\n`);
  }

  if (content.startsWith('# ')) {
    const newlineIndex = content.indexOf('\n');
    if (newlineIndex >= 0) {
      return `${content.slice(0, newlineIndex)}\n\n${metadataBlock}\n\n${content.slice(newlineIndex + 1).replace(/^\n+/, '')}`;
    }
  }

  return `${metadataBlock}\n\n${content.replace(/^\n+/, '')}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const headCommit = getHeadCommit();
  const files = await walkCoreDocsFiles(repoRoot);
  let updatedCount = 0;
  let scannedCount = 0;

  for (const filePath of files) {
    if (path.extname(filePath) !== '.md') {
      continue;
    }

    const classification = await classifyCoreDoc(repoRoot, filePath);
    if (
      args.prefixes.length > 0 &&
      !args.prefixes.some(
        (prefix) =>
          classification.relativePath === prefix || classification.relativePath.startsWith(`${prefix}/`)
      )
    ) {
      continue;
    }
    scannedCount += 1;

    const content = await fs.readFile(filePath, 'utf8');
    const metadataBlock = buildMetadataBlock({
      ...classification,
      lastVerifiedCommit: headCommit,
      lastVerifiedDate: auditDate,
    });
    const nextContent = replaceManagedMetadataBlock(content, metadataBlock);

    if (nextContent !== content) {
      await fs.writeFile(filePath, nextContent, 'utf8');
      updatedCount += 1;
    }
  }

  const scopeLabel =
    args.prefixes.length > 0 ? ` (${args.prefixes.join(', ')})` : ' (all core markdown docs)';
  console.log(
    `[core-docs-metadata] scanned ${scannedCount} markdown files${scopeLabel}; synced ${updatedCount}`
  );
}

main().catch((error) => {
  console.error('[core-docs-metadata] failed');
  console.error(error);
  process.exitCode = 1;
});
