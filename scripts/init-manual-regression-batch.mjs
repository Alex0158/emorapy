import fs from 'node:fs/promises';
import path from 'node:path';
import {
  MANUAL_REGRESSION_EVIDENCE_SEGMENTS,
  joinRepoPath,
  joinRepoRelativePath,
} from './lib/docs-paths.mjs';

const FLOWS = [
  { id: 'P01', name: '快速體驗閉環' },
  { id: 'P02', name: '正式案件閉環' },
  { id: 'P03', name: '心理訪談閉環' },
  { id: 'P04', name: '聊天轉判決閉環' },
  { id: 'P05', name: 'Admin 運維閉環' },
];

function parseArgs(argv) {
  const args = { date: '', force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--date') {
      args.date = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--force') {
      args.force = true;
    }
  }
  return args;
}

function localDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function safeWrite(file, content, force) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (force) {
    await fs.writeFile(file, content, 'utf8');
    return;
  }
  await fs.writeFile(file, content, { encoding: 'utf8', flag: 'wx' });
}

function rootReadme(date) {
  return `# 發版前手動回歸證據（${date}）

**定位**：存放 \`P01-P05\` 手動回歸的截圖、錄屏、補充說明與現場證據。  
**對應文檔**：

- \`發版前手動回歸包-2026-03-17.md\`
- \`發版前手動回歸執行版-2026-03-17.md\`

---

## 目錄結構

- \`P01/\`：快速體驗閉環
- \`P02/\`：正式案件閉環
- \`P03/\`：心理訪談閉環
- \`P04/\`：聊天轉判決閉環
- \`P05/\`：Admin 運維閉環

---

## 命名建議

- 截圖：
  - \`P01-desktop-pass-01.png\`
  - \`P03-mobile-fail-timeout.png\`
- 錄屏：
  - \`P02-desktop-pass.mp4\`
  - \`P04-desktop-fail-login-handoff.mp4\`
- 補充說明：
  - \`P05-notes.md\`

---

## 使用約定

- 若流程 \`PASS\`，至少保留：
  - 1 張結果頁截圖，或
  - 1 份短錄屏
- 若流程 \`FAIL / BLOCKED\`，必須保留：
  - 截圖或錄屏
  - 問題描述
  - 觸發步驟
  - 當前環境資訊
`;
}

function flowReadme(flowId) {
  return `# ${flowId} 證據位

## 建議最小內容

- \`${flowId}-desktop-pass-01.png\`（至少一張）
- \`${flowId}-desktop-pass.mp4\`（或一段短錄屏）
- \`${flowId}-notes.md\`（有補充就寫）
`;
}

function flowRecord(flow, date) {
  const evidencePath = joinRepoRelativePath([
    ...MANUAL_REGRESSION_EVIDENCE_SEGMENTS,
    date,
    flow.id,
  ]);

  return `# ${flow.id} 手動回歸記錄

- 狀態：
- 執行人：
- 時間：
- 瀏覽器/裝置：
- 測試帳號：
- 截圖/錄屏：${evidencePath}/
- 問題類型：
- 問題描述：

## 補充

- 流程：${flow.name}
- 其他說明：
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const date = args.date || localDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`invalid date format: ${date} (expected YYYY-MM-DD)`);
  }

  const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
  const evidenceRoot = joinRepoPath(repoRoot, MANUAL_REGRESSION_EVIDENCE_SEGMENTS);
  const dateDir = path.join(evidenceRoot, date);

  await fs.mkdir(dateDir, { recursive: true });
  await safeWrite(path.join(dateDir, 'README.md'), rootReadme(date), args.force);

  for (const flow of FLOWS) {
    const flowDir = path.join(dateDir, flow.id);
    await fs.mkdir(flowDir, { recursive: true });
    await safeWrite(path.join(flowDir, 'README.md'), flowReadme(flow.id), args.force);
    await safeWrite(path.join(flowDir, 'record.md'), flowRecord(flow, date), args.force);
  }

  process.stdout.write(`[manual-init] date=${date}\n`);
  process.stdout.write(`[manual-init] dir=${dateDir}\n`);
  process.stdout.write(
    `[manual-init] next: npm run manual-regression:check -- --date ${date}\n`
  );
}

main().catch((error) => {
  console.error(`[manual-init] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
