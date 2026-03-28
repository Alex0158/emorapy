import fs from 'node:fs/promises';
import path from 'node:path';

const FLOWS = [
  { id: 'P01', name: '快速體驗閉環' },
  { id: 'P02', name: '正式案件閉環' },
  { id: 'P03', name: '心理訪談閉環' },
  { id: 'P04', name: '聊天轉判決閉環' },
  { id: 'P05', name: 'Admin 運維閉環' },
];

function parseArgs(argv) {
  const args = { date: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--date') {
      args.date = argv[i + 1] || '';
      i += 1;
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

function normalizeStatus(value) {
  if (!value) return 'PENDING';
  return value;
}

async function readFlow(evidenceRoot, flow) {
  const recordPath = path.join(evidenceRoot, flow.id, 'record.md');
  const content = await fs.readFile(recordPath, 'utf8');
  const fields = parseFields(content);

  return {
    ...flow,
    status: normalizeStatus(fields.get('狀態')),
    owner: fields.get('執行人') || '',
    time: fields.get('時間') || '',
    device: fields.get('瀏覽器/裝置') || '',
    evidence: fields.get('截圖/錄屏') || '',
    issueType: fields.get('問題類型') || '',
    issue: fields.get('問題描述') || '',
    recordPath,
  };
}

function buildMarkdown(items, targetDate) {
  const lines = [
    `# 發版前手動回歸結果總覽（${targetDate}）`,
    '',
    `生成時間：${new Date().toISOString()}`,
    '',
    '| 流程 | 狀態 | 執行人 | 時間 | 裝置/瀏覽器 | 證據 | 問題類型 | 備註 |',
    '|---|---|---|---|---|---|---|---|',
  ];

  for (const item of items) {
    lines.push(
      `| ${item.id} ${item.name} | ${item.status || 'PENDING'} | ${item.owner || ''} | ${item.time || ''} | ${item.device || ''} | ${item.evidence || ''} | ${item.issueType || ''} | ${item.issue || ''} |`
    );
  }

  lines.push('');
  lines.push('## 原始記錄');
  lines.push('');
  for (const item of items) {
    lines.push(`- ${item.id}: \`${item.recordPath}\``);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
  const evidenceBase = path.join(repoRoot, 'docs', '核心開發文件', '發版前手動回歸證據');
  const targetDate = await resolveEvidenceDate(evidenceBase, args.date);
  const evidenceRoot = path.join(evidenceBase, targetDate);

  const items = await Promise.all(FLOWS.map((flow) => readFlow(evidenceRoot, flow)));
  const summary = buildMarkdown(items, targetDate);
  const summaryPath = path.join(evidenceRoot, 'summary.md');

  await fs.writeFile(summaryPath, summary, 'utf8');

  process.stdout.write(
    [
      `[manual-summary] date=${targetDate}`,
      `[manual-summary] wrote ${summaryPath}`,
      ...items.map((item) => `[manual-summary] ${item.id} status=${item.status}`),
    ].join('\n') + '\n'
  );
}

main().catch((error) => {
  console.error(`[manual-summary] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
