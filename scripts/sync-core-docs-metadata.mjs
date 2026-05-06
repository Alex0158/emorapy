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

function getShanghaiDateYmd() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

const auditDate = getShanghaiDateYmd();

function parseArgs(argv) {
  const prefixes = [];
  let dryRun = false;
  let list = false;
  let currentOnly = false;
  let nonCurrentOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--list') {
      list = true;
      continue;
    }
    if (arg === '--current-only') {
      currentOnly = true;
      continue;
    }
    if (arg === '--non-current-only') {
      nonCurrentOnly = true;
      continue;
    }
    if (arg === '--prefix' && argv[i + 1]) {
      prefixes.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--prefix=')) {
      prefixes.push(arg.slice('--prefix='.length));
    }
  }
  if (currentOnly && nonCurrentOnly) {
    throw new Error('Use only one of --current-only or --non-current-only');
  }
  return {
    dryRun,
    list,
    currentOnly,
    nonCurrentOnly,
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
  const changedEntries = [];

  for (const filePath of files) {
    if (path.extname(filePath) !== '.md') {
      continue;
    }

    const classification = await classifyCoreDoc(repoRoot, filePath);
    if (args.currentOnly && !classification.isCurrentSsot) {
      continue;
    }
    if (args.nonCurrentOnly && classification.isCurrentSsot) {
      continue;
    }
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
      changedEntries.push({
        relativePath: classification.relativePath,
        domain: classification.domain,
        docType: classification.docType,
        isCurrentSsot: classification.isCurrentSsot,
      });
      if (!args.dryRun) {
        await fs.writeFile(filePath, nextContent, 'utf8');
      }
      updatedCount += 1;
    }
  }

  const scopeLabel =
    args.prefixes.length > 0
      ? ` (${args.prefixes.join(', ')})`
      : args.currentOnly
        ? ' (current SSOT markdown docs)'
        : args.nonCurrentOnly
          ? ' (non-current markdown docs)'
          : ' (all core markdown docs)';
  console.log(
    `[core-docs-metadata] scanned ${scannedCount} markdown files${scopeLabel}; ${args.dryRun ? 'would sync' : 'synced'} ${updatedCount}`
  );
  if (args.dryRun && changedEntries.length > 0) {
    const currentCount = changedEntries.filter((entry) => entry.isCurrentSsot).length;
    const nonCurrentCount = changedEntries.length - currentCount;
    const domainCounts = changedEntries.reduce((acc, entry) => {
      acc[entry.domain] = (acc[entry.domain] || 0) + 1;
      return acc;
    }, {});
    const domainSummary = Object.entries(domainCounts)
      .sort((left, right) => left[0].localeCompare(right[0], 'zh-Hans-CN'))
      .map(([domain, count]) => `${domain}:${count}`)
      .join(', ');
    console.log(
      `[core-docs-metadata] dry-run impact current=${currentCount}, non-current=${nonCurrentCount}; domains ${domainSummary}`
    );
    if (args.list) {
      for (const entry of changedEntries) {
        console.log(
          `[core-docs-metadata] ${entry.isCurrentSsot ? 'current' : 'non-current'} ${entry.domain} ${entry.docType}: ${entry.relativePath}`
        );
      }
    }
  }
}

main().catch((error) => {
  console.error('[core-docs-metadata] failed');
  console.error(error);
  process.exitCode = 1;
});
