import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const defaultEvidenceRoot = path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證');
const scanDirs = new Map();

const secretPatterns = [
  { name: 'raw bearer token', pattern: /Bearer\s+(?!\[redacted\])[A-Za-z0-9._~+/=-]+/ },
  { name: 'raw Expo push token', pattern: /\b(?:Expo|Exponent)PushToken\[[^\]]+\]/ },
  { name: 'database URL', pattern: /\b(?:postgres(?:ql)?|mysql|mongodb):\/\/[^\s"'`]+/i },
  { name: 'OpenAI-style API key', pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
  { name: 'JWT-like token', pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/ },
  { name: 'basic-auth URL', pattern: /\bhttps?:\/\/[^/\s"'`:@]+:[^@\s"'`]+@/i },
  { name: 'signed URL query', pattern: /\bhttps?:\/\/[^\s"'`]+[?&](?:X-Amz-Signature|X-Goog-Signature|Signature|token|access_token)=/i },
];

const forbiddenRawUrlKeys = new Set([
  'artifact_url',
  'artifactUrl',
  'applicationArchiveUrl',
  'buildUrl',
  'raw_url',
  'signed_url',
]);

function addScanDir(dir) {
  if (!dir) return;
  const resolved = path.resolve(process.cwd(), dir);
  scanDirs.set(resolved, resolved);
}

function printUsageAndExit(message, code = 1) {
  if (message) console.error(`[release-evidence-redaction-check] ${message}`);
  console.error('usage: npm --prefix mobile run release:evidence-redaction:check -- [--evidence-dir=<path>]');
  console.error(`By default this scans ${path.relative(repoRoot, defaultEvidenceRoot)}.`);
  console.error(`APP_RELEASE_EVIDENCE_REDACTION_DIRS may add extra directories separated by ${JSON.stringify(path.delimiter)}.`);
  process.exit(code);
}

addScanDir(defaultEvidenceRoot);
for (const dir of String(process.env.APP_RELEASE_EVIDENCE_REDACTION_DIRS || '')
  .split(path.delimiter)
  .map((entry) => entry.trim())
  .filter(Boolean)) {
  addScanDir(dir);
}

for (const arg of process.argv.slice(2)) {
  if (arg === '--help' || arg === '-h') {
    printUsageAndExit(null, 0);
  } else if (arg.startsWith('--evidence-dir=')) {
    addScanDir(arg.slice('--evidence-dir='.length));
  } else if (arg.startsWith('--dir=')) {
    addScanDir(arg.slice('--dir='.length));
  } else {
    printUsageAndExit(`unknown argument: ${arg}`);
  }
}

function walk(value, visit, jsonPath = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, visit, `${jsonPath}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      visit(key, entry, `${jsonPath}.${key}`);
      walk(entry, visit, `${jsonPath}.${key}`);
    }
    return;
  }
  visit(null, value, jsonPath);
}

function appEvidenceFiles() {
  const files = [];
  for (const dir of scanDirs.values()) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith('App-') && entry.endsWith('.json')) {
        files.push(path.join(dir, entry));
      }
    }
  }
  return Array.from(new Set(files)).sort();
}

function displayPath(filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  if (relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return filePath;
}

const issues = [];
const files = appEvidenceFiles();

for (const filePath of files) {
  const relativePath = displayPath(filePath);
  let raw = '';
  let evidence = null;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
    evidence = JSON.parse(raw);
  } catch (error) {
    issues.push(`${relativePath}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    continue;
  }

  for (const rule of secretPatterns) {
    if (rule.pattern.test(raw)) {
      issues.push(`${relativePath}: contains ${rule.name}`);
    }
  }

  walk(evidence, (key, value, jsonPath) => {
    if (key && forbiddenRawUrlKeys.has(key)) {
      issues.push(`${relativePath}: forbidden raw URL field ${jsonPath}`);
    }
    if (typeof value !== 'string') return;
    for (const rule of secretPatterns) {
      if (rule.pattern.test(value)) {
        issues.push(`${relativePath}: ${jsonPath} contains ${rule.name}`);
      }
    }
  });
}

if (issues.length > 0) {
  console.error(`[release-evidence-redaction-check] failed with ${issues.length} issue(s):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(
  `[release-evidence-redaction-check] ok: scanned ${files.length} App release evidence JSON file(s) across ${scanDirs.size} dir(s)`
);
