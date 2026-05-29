import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ALLOWED_MARKDOWN_SEGMENT_GROUPS,
  CORE_DOCS_ROOT_DIRS,
  CORE_DOCS_ROOT_FILES,
  CORE_DOCS_SEGMENTS,
  FORMAL_DOMAIN_DIRS,
  LEGACY_DOC_PATH_ALLOWLIST,
  LEGACY_DOC_PATH_RULES,
  joinRepoPath,
  joinRepoRelativePath,
} from './lib/docs-paths.mjs';
import { classifyCoreDoc } from './lib/core-docs-audit.mjs';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const docsRoot = path.join(repoRoot, 'docs');
const coreDocsRoot = joinRepoPath(repoRoot, CORE_DOCS_SEGMENTS);
const EXPECTED_ROOT_FILES = new Set(CORE_DOCS_ROOT_FILES);
const EXPECTED_ROOT_DIRS = new Set(CORE_DOCS_ROOT_DIRS);
const LEGACY_DOC_PATH_ALLOWLIST_SET = new Set(LEGACY_DOC_PATH_ALLOWLIST);
const ALLOWED_MARKDOWN_PREFIXES = ALLOWED_MARKDOWN_SEGMENT_GROUPS.map((segments) =>
  `${joinRepoRelativePath(segments)}/`
);
const IGNORED_SCAN_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
const IGNORED_SCAN_RELATIVE_DIRS = new Set(['mobile/ios', 'mobile/android']);
const FENCED_CODE_BLOCK_RE = /```[\s\S]*?```/g;
const MARKDOWN_LINK_RE = /!?\[[^\]]*]\(([^)\n]+)\)/g;
const PENDING_GOVERNANCE_DIR = path.join(coreDocsRoot, '07-待處理問題與治理', '待處理');
const RESOLVED_GOVERNANCE_STATUS_RE = /^(已處理|已閉環|已完成)(?:\b|[；;，,\s])/;
const STALE_APP_STATUS_RULES = [
  {
    name: 'app-template-only',
    pattern: /App\s*(?:目前|當前)?(?:只有|仍是)\s*Expo template/i,
  },
  {
    name: 'app-template-types-only',
    pattern: /Expo template\s*\+\s*types-only/i,
  },
  {
    name: 'app-not-consuming-shared-client',
    pattern: /App\s*尚未正式消費/,
  },
  {
    name: 'web-covered-app-pending',
    pattern: /Web\s*已覆蓋；App\s*待承接/,
  },
  {
    name: 'app-ai-runtime-missing',
    pattern: /App\s*AI runtime\s*尚未建立/i,
  },
  {
    name: 'securestore-adapter-missing',
    pattern: /SecureStore adapter\s*待建立/i,
  },
  {
    name: 'app-types-only-adapter-skeleton',
    pattern: /App\s*只有\s*types-only adapter skeleton/i,
  },
  {
    name: 'mobile-platform-still-types-only',
    pattern: /mobile\/src\/platform`?\s*(?:仍是|只放|只有)[^。\n|]*types-only/i,
  },
  {
    name: 'app-implemented-forbidden',
    pattern: /所有\s*App\s*首輪業務能力均不得標為/,
  },
  {
    name: 'app-runtime-adapter-not-landed',
    pattern: /runtime adapter\s*尚未落地/i,
  },
];

function compareSet(actual, expected) {
  const missing = [...expected].filter((item) => !actual.has(item)).sort();
  const unexpected = [...actual].filter((item) => !expected.has(item)).sort();
  return { missing, unexpected };
}

async function readVisibleEntries(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => !entry.name.startsWith('.'));
}

async function collectMarkdownFiles(dir) {
  const collected = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await readVisibleEntries(current);
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_SCAN_DIRS.has(entry.name)) {
          continue;
        }
        const normalizedRelativePath = path
          .relative(repoRoot, entryPath)
          .split(path.sep)
          .join(path.posix.sep);
        if (IGNORED_SCAN_RELATIVE_DIRS.has(normalizedRelativePath)) {
          continue;
        }
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        collected.push(entryPath);
      }
    }
  }

  return collected.sort();
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function stripFencedCodeBlocks(content) {
  return content.replace(FENCED_CODE_BLOCK_RE, '');
}

function normalizeMarkdownTarget(rawTarget) {
  let target = rawTarget.trim();
  if (!target) return '';

  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1).trim();
  } else {
    const whitespaceIndex = target.search(/\s/);
    if (whitespaceIndex >= 0) {
      target = target.slice(0, whitespaceIndex);
    }
  }

  const hashIndex = target.indexOf('#');
  if (hashIndex >= 0) {
    target = target.slice(0, hashIndex);
  }

  const queryIndex = target.indexOf('?');
  if (queryIndex >= 0) {
    target = target.slice(0, queryIndex);
  }

  try {
    target = decodeURIComponent(target);
  } catch {
    return target;
  }

  return target.trim();
}

function isSkippableMarkdownTarget(target) {
  return (
    !target ||
    target.startsWith('#') ||
    /^(https?:|mailto:|tel:|discussion:\/\/|collection:\/\/|app:\/\/|plugin:\/\/|data:|file:\/\/)/i.test(
      target
    )
  );
}

function resolveMarkdownTarget(filePath, target) {
  if (path.isAbsolute(target)) {
    return target.startsWith(repoRoot)
      ? target
      : path.join(repoRoot, target.replace(/^\/+/, ''));
  }

  return path.resolve(path.dirname(filePath), target);
}

function isAllowedMarkdownPath(relativePath) {
  const normalized = relativePath.split(path.sep).join(path.posix.sep);
  if (normalized === 'AGENTS.md') {
    return true;
  }
  return ALLOWED_MARKDOWN_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

async function checkCoreDocsRoot(issues) {
  const entries = await readVisibleEntries(coreDocsRoot);
  const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const dirs = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));

  const fileDiff = compareSet(files, EXPECTED_ROOT_FILES);
  const dirDiff = compareSet(dirs, EXPECTED_ROOT_DIRS);

  for (const name of fileDiff.missing) {
    issues.push(`[core-root] missing root file: ${name}`);
  }
  for (const name of fileDiff.unexpected) {
    issues.push(`[core-root] unexpected root file: ${name}`);
  }
  for (const name of dirDiff.missing) {
    issues.push(`[core-root] missing root directory: ${name}`);
  }
  for (const name of dirDiff.unexpected) {
    issues.push(`[core-root] unexpected root directory: ${name}`);
  }
}

async function checkFormalDomainDocs(issues) {
  for (const dirName of FORMAL_DOMAIN_DIRS) {
    const dirPath = path.join(coreDocsRoot, dirName);
    const entries = await readVisibleEntries(dirPath);
    const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    const overviewFiles = fileNames.filter((name) => /^00-.*總覽\.md$/.test(name)).sort();

    if (!fileNames.includes('README.md')) {
      issues.push(`[formal-domain] ${dirName} is missing README.md`);
    }

    if (overviewFiles.length === 0) {
      issues.push(`[formal-domain] ${dirName} is missing 00-*總覽.md`);
      continue;
    }

    if (overviewFiles.length > 1) {
      issues.push(
        `[formal-domain] ${dirName} has multiple overview docs: ${overviewFiles.join(', ')}`
      );
    }
  }
}

async function checkMarkdownRules(issues) {
  const markdownFiles = await collectMarkdownFiles(repoRoot);

  for (const filePath of markdownFiles) {
    const content = await fs.readFile(filePath, 'utf8');
    const relativePath = path.relative(repoRoot, filePath);
    const strippedContent = stripFencedCodeBlocks(content);
    const normalizedRelativePath = relativePath.split(path.sep).join(path.posix.sep);

    if (!isAllowedMarkdownPath(normalizedRelativePath)) {
      issues.push(`[markdown] markdown outside allowed areas: ${normalizedRelativePath}`);
      continue;
    }

    if (content.includes(repoRoot)) {
      issues.push(`[markdown] absolute repo path found in ${normalizedRelativePath}`);
    }

    if (!LEGACY_DOC_PATH_ALLOWLIST_SET.has(normalizedRelativePath)) {
      for (const rule of LEGACY_DOC_PATH_RULES) {
        for (const pattern of rule.patterns) {
          if (content.includes(pattern)) {
            issues.push(
              `[markdown] stale path (${rule.name}) found in ${normalizedRelativePath}: ${pattern}`
            );
          }
        }
      }
    }

    let match;
    while ((match = MARKDOWN_LINK_RE.exec(strippedContent)) !== null) {
      const target = normalizeMarkdownTarget(match[1] || '');
      if (isSkippableMarkdownTarget(target)) {
        continue;
      }

      const resolvedTarget = resolveMarkdownTarget(filePath, target);
      if (!(await pathExists(resolvedTarget))) {
        issues.push(`[markdown] broken local link in ${normalizedRelativePath}: ${target}`);
      }
    }

    MARKDOWN_LINK_RE.lastIndex = 0;
  }
}

async function checkStaleAppStatusRules(issues) {
  const markdownFiles = await collectMarkdownFiles(coreDocsRoot);

  for (const filePath of markdownFiles) {
    const classification = await classifyCoreDoc(repoRoot, filePath);
    if (!classification.isCurrentSsot) {
      continue;
    }

    const content = stripFencedCodeBlocks(await fs.readFile(filePath, 'utf8'));
    for (const rule of STALE_APP_STATUS_RULES) {
      if (rule.pattern.test(content)) {
        issues.push(
          `[app-status] stale App initial-state claim (${rule.name}) found in ${classification.relativePath}`
        );
      }
      rule.pattern.lastIndex = 0;
    }
  }
}

async function checkPendingGovernanceStatuses(issues) {
  const entries = await readVisibleEntries(PENDING_GOVERNANCE_DIR);

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(PENDING_GOVERNANCE_DIR, entry.name);
    const content = await fs.readFile(filePath, 'utf8');
    const statusMatch = content.match(/^\*\*狀態\*\*[：:]\s*([^\n]+)/m);
    if (!statusMatch) {
      continue;
    }

    const status = statusMatch[1].trim();
    if (RESOLVED_GOVERNANCE_STATUS_RE.test(status)) {
      const relativePath = path.relative(repoRoot, filePath).split(path.sep).join(path.posix.sep);
      issues.push(
        `[pending-governance] resolved issue remains under 待處理/: ${relativePath} status=${status}`
      );
    }
  }
}

async function main() {
  const issues = [];

  await checkCoreDocsRoot(issues);
  await checkFormalDomainDocs(issues);
  await checkMarkdownRules(issues);
  await checkStaleAppStatusRules(issues);
  await checkPendingGovernanceStatuses(issues);

  if (issues.length > 0) {
    console.error('[docs-check] failed:');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log('[docs-check] ok: core docs structure and markdown guards passed');
}

main().catch((error) => {
  console.error(`[docs-check] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
