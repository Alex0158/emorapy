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
const FENCED_CODE_BLOCK_RE = /```[\s\S]*?```/g;
const MARKDOWN_LINK_RE = /!?\[[^\]]*]\(([^)\n]+)\)/g;

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

async function main() {
  const issues = [];

  await checkCoreDocsRoot(issues);
  await checkFormalDomainDocs(issues);
  await checkMarkdownRules(issues);

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
