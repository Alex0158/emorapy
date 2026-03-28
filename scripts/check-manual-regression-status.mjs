import fs from 'node:fs/promises';
import path from 'node:path';

const FLOWS = ['P01', 'P02', 'P03', 'P04', 'P05'];
const REQUIRED_COMMON_FIELDS = ['狀態', '執行人', '時間', '瀏覽器/裝置', '截圖/錄屏'];
const ALLOWED_STATUS = new Set(['PASS', 'FAIL', 'BLOCKED']);

function parseArgs(argv) {
  const args = { date: '', requireEvidence: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--date') {
      args.date = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--require-evidence') {
      args.requireEvidence = true;
    }
  }
  return args;
}

async function resolveEvidenceDate(baseDir, explicitDate) {
  if (explicitDate) return explicitDate;
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const dateDirs = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (dateDirs.length === 0) {
    throw new Error(`No date directory found under ${baseDir}`);
  }
  return dateDirs[dateDirs.length - 1];
}

function parseFields(content) {
  const fields = new Map();
  for (const line of content.split('\n')) {
    const match = line.match(/^- ([^：]+)：\s*(.*)$/);
    if (!match) continue;
    fields.set(match[1], match[2].trim());
  }
  return fields;
}

function validate(fields) {
  const status = (fields.get('狀態') || '').trim();
  const missing = [];
  const invalid = [];

  if (!status) {
    missing.push('狀態');
    return { status: 'PENDING', missing, invalid };
  }

  if (!ALLOWED_STATUS.has(status)) {
    invalid.push(`狀態(${status})`);
  }

  for (const key of REQUIRED_COMMON_FIELDS) {
    if (!(fields.get(key) || '').trim()) {
      missing.push(key);
    }
  }

  if (status === 'FAIL' || status === 'BLOCKED') {
    if (!(fields.get('問題類型') || '').trim()) {
      missing.push('問題類型');
    }
    if (!(fields.get('問題描述') || '').trim()) {
      missing.push('問題描述');
    }
  }

  return {
    status,
    missing,
    invalid,
  };
}

function normalizeEvidencePath(value) {
  const raw = (value || '').trim();
  if (!raw) return '';
  return raw.replace(/^`|`$/g, '');
}

async function hasEvidenceArtifacts(repoRoot, evidencePath) {
  const normalized = normalizeEvidencePath(evidencePath);
  if (!normalized) return false;
  const absPath = path.isAbsolute(normalized)
    ? normalized
    : path.join(repoRoot, normalized.replace(/^\.\//, ''));
  try {
    const stat = await fs.stat(absPath);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(absPath, { withFileTypes: true });
      return entries.some((entry) => entry.isFile());
    }
    return stat.isFile();
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
  const evidenceRoot = path.join(repoRoot, 'docs', '核心開發文件', '發版前手動回歸證據');
  const targetDate = await resolveEvidenceDate(evidenceRoot, args.date);
  const baseDir = path.join(evidenceRoot, targetDate);

  let hasIssue = false;

  for (const flow of FLOWS) {
    const file = path.join(baseDir, flow, 'record.md');
    const content = await fs.readFile(file, 'utf8');
    const fields = parseFields(content);
    const result = validate(fields);
    const issues = [...result.missing, ...result.invalid];
    if (
      args.requireEvidence &&
      ALLOWED_STATUS.has(result.status) &&
      !result.missing.includes('截圖/錄屏')
    ) {
      const hasArtifacts = await hasEvidenceArtifacts(repoRoot, fields.get('截圖/錄屏') || '');
      if (!hasArtifacts) {
        issues.push('截圖/錄屏(路徑無效或無檔案)');
      }
    }
    if (issues.length > 0) hasIssue = true;

    process.stdout.write(
      [
        `[manual-check] date=${targetDate}`,
        `[manual-check] flow=${flow}`,
        `[manual-check] status=${result.status}`,
        `[manual-check] issues=${issues.length > 0 ? issues.join(',') : 'none'}`,
        `[manual-check] file=${file}`,
      ].join('\n') + '\n'
    );
  }

  if (hasIssue) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[manual-check] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
