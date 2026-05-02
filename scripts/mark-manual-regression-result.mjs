import fs from 'node:fs/promises';
import path from 'node:path';
import { MANUAL_REGRESSION_EVIDENCE_SEGMENTS, joinRepoPath } from './lib/docs-paths.mjs';

const FLOWS = new Set(['P01', 'P02', 'P03', 'P04', 'P05']);
const STATUS = new Set(['PASS', 'FAIL', 'BLOCKED']);

function parseArgs(argv) {
  const args = {
    date: '',
    flow: '',
    status: '',
    owner: '',
    time: '',
    device: '',
    account: '',
    evidence: '',
    issueType: '',
    issue: '',
    note: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1] || '';
    if (token === '--date') {
      args.date = next;
      i += 1;
      continue;
    }
    if (token === '--flow') {
      args.flow = next.toUpperCase();
      i += 1;
      continue;
    }
    if (token === '--status') {
      args.status = next.toUpperCase();
      i += 1;
      continue;
    }
    if (token === '--owner') {
      args.owner = next;
      i += 1;
      continue;
    }
    if (token === '--time') {
      args.time = next;
      i += 1;
      continue;
    }
    if (token === '--device') {
      args.device = next;
      i += 1;
      continue;
    }
    if (token === '--account') {
      args.account = next;
      i += 1;
      continue;
    }
    if (token === '--evidence') {
      args.evidence = next;
      i += 1;
      continue;
    }
    if (token === '--issue-type') {
      args.issueType = next;
      i += 1;
      continue;
    }
    if (token === '--issue') {
      args.issue = next;
      i += 1;
      continue;
    }
    if (token === '--note') {
      args.note = next;
      i += 1;
      continue;
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

function updateField(content, key, value) {
  const pattern = new RegExp(`^- ${key}：.*$`, 'm');
  if (!pattern.test(content)) {
    throw new Error(`Field not found: ${key}`);
  }
  return content.replace(pattern, `- ${key}：${value}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.flow || !FLOWS.has(args.flow)) {
    throw new Error('Missing or invalid --flow (P01-P05)');
  }
  if (args.status && !STATUS.has(args.status)) {
    throw new Error('Invalid --status (PASS|FAIL|BLOCKED)');
  }

  const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
  const evidenceRoot = joinRepoPath(repoRoot, MANUAL_REGRESSION_EVIDENCE_SEGMENTS);
  const targetDate = await resolveEvidenceDate(evidenceRoot, args.date);
  const recordPath = path.join(evidenceRoot, targetDate, args.flow, 'record.md');
  let content = await fs.readFile(recordPath, 'utf8');
  const changed = [];

  if (args.status) {
    content = updateField(content, '狀態', args.status);
    changed.push('狀態');
  }
  if (args.owner) {
    content = updateField(content, '執行人', args.owner);
    changed.push('執行人');
  }
  if (args.time) {
    content = updateField(content, '時間', args.time);
    changed.push('時間');
  }
  if (args.device) {
    content = updateField(content, '瀏覽器/裝置', args.device);
    changed.push('瀏覽器/裝置');
  }
  if (args.account) {
    content = updateField(content, '測試帳號', args.account);
    changed.push('測試帳號');
  }
  if (args.evidence) {
    content = updateField(content, '截圖/錄屏', args.evidence);
    changed.push('截圖/錄屏');
  }
  if (args.issueType) {
    content = updateField(content, '問題類型', args.issueType);
    changed.push('問題類型');
  }
  if (args.issue) {
    content = updateField(content, '問題描述', args.issue);
    changed.push('問題描述');
  }
  if (args.note) {
    content = updateField(content, '其他說明', args.note);
    changed.push('其他說明');
  }

  if (changed.length === 0) {
    throw new Error('No updates specified');
  }

  await fs.writeFile(recordPath, content, 'utf8');
  process.stdout.write(
    [
      `[manual-mark] date=${targetDate}`,
      `[manual-mark] flow=${args.flow}`,
      `[manual-mark] file=${recordPath}`,
      `[manual-mark] updated=${changed.join(',')}`,
    ].join('\n') + '\n'
  );
}

main().catch((error) => {
  console.error(`[manual-mark] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
