import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  classifyCoreDoc,
  formatEvidenceSources,
  walkCoreDocsFiles,
} from './lib/core-docs-audit.mjs';
import { CORE_DOCS_SEGMENTS, joinRepoPath } from './lib/docs-paths.mjs';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const ledgerRelativePath = path.posix.join(
  ...CORE_DOCS_SEGMENTS,
  '文件收斂',
  '03-CJ-核心開發文件逐文件代碼校驗總台賬-2026-04-18.md'
);
const ledgerPath = joinRepoPath(repoRoot, ['docs', '核心開發文件', '文件收斂', '03-CJ-核心開發文件逐文件代碼校驗總台賬-2026-04-18.md']);

const correctedDocs = new Set([
  'README.md',
  '功能特性清單.md',
  '頁面清單.md',
  '全接口清單-主文檔.md',
  '接口-功能-頁面-Mapping.md',
  '業務流程整合.md',
  '術語表.md',
  '01-認證與會話/00-認證與會話總覽.md',
  '01-認證與會話/README.md',
  '02-用戶端核心流程/00-用戶端核心流程總覽.md',
  '02-用戶端核心流程/README.md',
  '03-管理端與平台治理/00-管理端與平台治理總覽.md',
  '03-管理端與平台治理/01-環境與部署基線.md',
  '03-管理端與平台治理/03-運維告警與AI-Chat治理基線.md',
  '03-管理端與平台治理/README.md',
  '04-共用機制/00-共用機制總覽.md',
  '04-共用機制/01-樣式Token與共享視覺規範.md',
  '04-共用機制/README.md',
  '05-工程架構與共享層/00-工程架構與共享層總覽.md',
  '05-工程架構與共享層/01-本地開發與工作區基線.md',
  '05-工程架構與共享層/README.md',
  '05-工程架構與共享層/Repo平台分層與共享規範.md',
  '06-接口描述/01-auth-session.md',
  '06-接口描述/README.md',
  '06-接口描述/06-interview-psych-profile.md',
  '06-接口描述/08-content-notification.md',
  '06-接口描述/09-admin.md',
  '06-接口描述/10-health-metrics.md',
  '07-待處理問題與治理/00-活躍問題總覽.md',
  '07-待處理問題與治理/README.md',
  '07-待處理問題與治理/已處理/業務缺陷收斂台帳-2026-03-17.md',
  '07-待處理問題與治理/待處理/已知風險清單-2026-03-17.md',
  '08-測試規範與驗收/01-測試文檔分層與使用規則.md',
  '08-測試規範與驗收/02-AI流式與Chat治理驗收基線.md',
  '08-測試規範與驗收/README.md',
  '90-證據與盤點/AI流式驗證/AI流式驗收對照-2026-04-04.md',
  '測試/README.md',
  '測試/活躍場景案例/README.md',
  '測試/回歸與驗收/README.md',
  '測試/回歸與驗收/發版前回歸記錄-2026-03-17.md',
]);

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    list: argv.includes('--list'),
  };
}

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

function getHeadCommit() {
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

function deriveStatus(classification) {
  if (correctedDocs.has(classification.relativePath)) {
    return '已修正';
  }
  return classification.status;
}

function deriveDiffSummary(classification, status) {
  if (status === '已修正') {
    return '已按現碼回寫並納入真實性守衛';
  }
  if (status === '證據已核對') {
    return '已核對來源、鏈接、日期與非現行 SSOT 定位';
  }
  if (status === '已降級') {
    return '僅保留歷史索引/方案定位，不作現行依據';
  }
  return '已納入本輪逐文件審計與當前目錄契約';
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

async function buildLedgerContent() {
  const headCommit = getHeadCommit();
  const files = await walkCoreDocsFiles(repoRoot);
  const entries = [];

  for (const filePath of files) {
    const classification = await classifyCoreDoc(repoRoot, filePath);
    const status = deriveStatus(classification);
    entries.push({
      ...classification,
      status,
      diffSummary: deriveDiffSummary(classification, status),
    });
  }

  entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'zh-Hans-CN'));

  const countsByStatus = entries.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    return acc;
  }, {});

  const countsByDomain = entries.reduce((acc, entry) => {
    acc[entry.domain] = (acc[entry.domain] || 0) + 1;
    return acc;
  }, {});

  const lines = [];
  lines.push('# Emorapy 核心開發文件逐文件代碼校驗總台賬（2026-04-18）');
  lines.push('');
  lines.push('<!-- CORE_DOC_AUDIT_METADATA:START -->');
  lines.push('**文檔類型**：文檔治理');
  lines.push(`**來源時間**：${auditDate}`);
  lines.push('**上下文**：非產品/工程 SSOT；逐文件核驗台賬與批次審計收口');
  lines.push('**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）');
  lines.push(`**最後核驗 Commit**：\`${headCommit}\``);
  lines.push(`**最後核驗日期**：\`${auditDate}\``);
  lines.push('<!-- CORE_DOC_AUDIT_METADATA:END -->');
  lines.push('');
  lines.push(`- **生成時間**：\`${auditDate}\``);
  lines.push(`- **最後核驗 Commit**：\`${headCommit}\``);
  lines.push(`- **覆蓋範圍**：\`${ledgerRelativePath.replace('/文件收斂/03-CJ-核心開發文件逐文件代碼校驗總台賬-2026-04-18.md', '')}\` 內全部 Markdown / HTML / JSON`);
  lines.push('- **歷史檔名說明**：檔名中的 `03-CJ-` 保留為 2026-04-18 legacy governance batch identifier；現行產品與工程 SSOT 名稱為 `Emorapy`。');
  lines.push('- **裁決規則**：正式規格以現碼為準回寫；證據/歷史/治理文件僅核對分類、來源、鏈接與非現行 SSOT 定位。');
  lines.push('');
  lines.push('## 摘要');
  lines.push('');
  lines.push('| 維度 | 數值 |');
  lines.push('|---|---:|');
  lines.push(`| 文件總數 | ${entries.length} |`);
  for (const [status, count] of Object.entries(countsByStatus)) {
    lines.push(`| 狀態：${status} | ${count} |`);
  }
  for (const [domain, count] of Object.entries(countsByDomain)) {
    lines.push(`| 子域：${domain} | ${count} |`);
  }
  lines.push('');
  lines.push('## 逐文件台賬');
  lines.push('');
  lines.push('| 文件路徑 | 文件類型 | 對應子域 | 代碼取證入口 | 核驗方法 | 當前狀態 | 最後核驗 Commit | 最後核驗日期 | 差異摘要 |');
  lines.push('|---|---|---|---|---|---|---|---|---|');

  for (const entry of entries) {
    lines.push(
      [
        escapeCell(`\`${entry.relativePath}\``),
        escapeCell(entry.docType),
        escapeCell(entry.domain),
        escapeCell(formatEvidenceSources(entry.evidenceSources)),
        escapeCell(entry.verificationMethod),
        escapeCell(entry.status),
        escapeCell(`\`${headCommit}\``),
        escapeCell(`\`${auditDate}\``),
        escapeCell(entry.diffSummary),
      ].join(' | ').replace(/^/, '| ').concat(' |')
    );
  }

  lines.push('');
  lines.push('## 使用規則');
  lines.push('');
  lines.push('1. 正式規格文檔若再改動代碼，必須同步回寫並更新本台賬狀態。');
  lines.push('2. `90-證據與盤點`、`99-歷史降級索引`、`文件收斂` 不得再被當作現行產品/工程 SSOT。');
  lines.push('3. `docs:check` 需持續保持綠燈；若新增 route / page / enum 未回寫，CI 應直接失敗。');
  lines.push('');

  return {
    content: `${lines.join('\n')}\n`,
    entryCount: entries.length,
    entries,
    countsByStatus,
    countsByDomain,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const nextLedger = await buildLedgerContent();
  if (args.dryRun) {
    let currentContent = '';
    try {
      currentContent = await fs.readFile(ledgerPath, 'utf8');
    } catch {
      currentContent = '';
    }
    const changed = currentContent !== nextLedger.content;
    console.log(
      `[core-docs-ledger] dry-run ${changed ? 'would update' : 'no changes'} ${path.relative(repoRoot, ledgerPath)} with ${nextLedger.entryCount} entries`
    );
    const statusSummary = Object.entries(nextLedger.countsByStatus)
      .sort((left, right) => left[0].localeCompare(right[0], 'zh-Hans-CN'))
      .map(([status, count]) => `${status}:${count}`)
      .join(', ');
    const domainSummary = Object.entries(nextLedger.countsByDomain)
      .sort((left, right) => left[0].localeCompare(right[0], 'zh-Hans-CN'))
      .map(([domain, count]) => `${domain}:${count}`)
      .join(', ');
    console.log(`[core-docs-ledger] dry-run statuses ${statusSummary}`);
    console.log(`[core-docs-ledger] dry-run domains ${domainSummary}`);
    if (args.list) {
      for (const entry of nextLedger.entries) {
        console.log(`[core-docs-ledger] ${entry.status} ${entry.domain} ${entry.docType}: ${entry.relativePath}`);
      }
    }
    return;
  }

  await fs.writeFile(ledgerPath, nextLedger.content, 'utf8');
  console.log(`[core-docs-ledger] wrote ${path.relative(repoRoot, ledgerPath)} with ${nextLedger.entryCount} entries`);
}

main().catch((error) => {
  console.error('[core-docs-ledger] failed');
  console.error(error);
  process.exitCode = 1;
});
