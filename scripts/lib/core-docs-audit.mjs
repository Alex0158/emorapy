import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CORE_DOCS_SEGMENTS,
  joinRepoPath,
  joinRepoRelativePath,
} from './docs-paths.mjs';

export const CORE_DOC_AUDIT_METADATA_START = '<!-- CORE_DOC_AUDIT_METADATA:START -->';
export const CORE_DOC_AUDIT_METADATA_END = '<!-- CORE_DOC_AUDIT_METADATA:END -->';

const WALKABLE_EXTENSIONS = new Set(['.md', '.html', '.json']);
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);

const ROOT_DOC_OVERRIDES = {
  'README.md': {
    docType: '核心入口',
    coverage: '核心開發文件閱讀順序、SSOT 邊界與 repo 級文檔治理口徑',
    evidenceSources: [
      'backend/src/app.ts',
      'frontend/src/router/index.tsx',
      'frontend-admin/src/router.tsx',
      'mobile/app/_layout.tsx',
      'mobile/src/platform',
      'scripts/check-docs-structure.mjs',
    ],
    verificationMethod: '核對根層目錄契約、主文檔清單與路由掛載現況一致',
  },
  '功能特性清單.md': {
    docType: '旗艦規格',
    coverage: 'F01-F10 主功能與當前已落地能力',
    evidenceSources: [
      'backend/src/routes',
      'backend/prisma/schema.prisma',
      'frontend/src/pages',
      'frontend/src/services/api',
      'frontend-admin/src/pages',
    ],
    verificationMethod: '按功能分段對照頁面、API 客戶端、狀態枚舉與當前交互責任',
  },
  '頁面清單.md': {
    docType: '旗艦規格',
    coverage: '前台與 admin 真實路由、守衛與頁面責任',
    evidenceSources: [
      'frontend/src/router/index.tsx',
      'frontend-admin/src/router.tsx',
      'frontend/src/pages',
      'frontend-admin/src/pages',
    ],
    verificationMethod: '以 router 真實註冊結果核對路由表、統計數與 GuardType',
  },
  '全接口清單-主文檔.md': {
    docType: '旗艦規格',
    coverage: '後端已註冊接口總表與主狀態口徑',
    evidenceSources: [
      'backend/src/app.ts',
      'backend/src/routes',
      'frontend/src/services/api',
      'frontend-admin/src/services/api',
    ],
    verificationMethod: '以 app mount + route 註冊逐條核對端點存在性與文檔覆蓋率',
  },
  '接口-功能-頁面-Mapping.md': {
    docType: '旗艦映射',
    coverage: 'API -> 功能 -> 頁面 -> 流程節點映射',
    evidenceSources: [
      'backend/src/routes',
      'frontend/src/router/index.tsx',
      'frontend-admin/src/router.tsx',
      'frontend/src/services/api',
      'frontend-admin/src/services/api',
    ],
    verificationMethod: '以 route/path 真值核對每條 API 的頁面責任與功能歸屬',
  },
  '業務流程整合.md': {
    docType: '旗艦規格',
    coverage: 'P01-P05 主流程、狀態機與高風險回歸閉環',
    evidenceSources: [
      'backend/src/routes',
      'backend/prisma/schema.prisma',
      'frontend/src/router/index.tsx',
      'frontend/src/pages',
      'frontend-admin/src/router.tsx',
    ],
    verificationMethod: '按流程入口、轉移條件與狀態枚舉比對當前代碼主鏈路',
  },
  '術語表.md': {
    docType: '旗艦規格',
    coverage: '角色、守衛、關鍵狀態值與文檔治理術語',
    evidenceSources: [
      'backend/prisma/schema.prisma',
      'frontend/src/router/index.tsx',
      'frontend-admin/src/router.tsx',
      'backend/src/routes',
    ],
    verificationMethod: '以真實 enum、守衛實作與接口治理口徑核對術語定義',
  },
};

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join(path.posix.sep);
}

function buildEvidenceSources(...items) {
  return [...new Set(items.flat().filter(Boolean))];
}

function inferSourceDate(relativePath, content) {
  const pathMatch = relativePath.match(/20\d{2}-\d{2}-\d{2}/);
  if (pathMatch) {
    return pathMatch[0];
  }

  const sourceFieldMatch =
    content.match(/\*\*來源時間\*\*[：:]\s*`?([^\n`]+)`?/) ||
    content.match(/來源時間[：:]\s*`?([^\n`]+)`?/);
  if (sourceFieldMatch?.[1]) {
    const value = sourceFieldMatch[1].trim();
    if (value && value !== '未標註') {
      return value;
    }
  }

  const updatedFieldMatch = content.match(/最後更新[：:]\s*`?([^\n`]+)`?/);
  if (updatedFieldMatch?.[1]) {
    const value = updatedFieldMatch[1].trim();
    if (value && value !== '未標註') {
      return value;
    }
  }

  const releaseFieldMatch = content.match(/對應發佈[：:]\s*v?[0-9][^\n]*/);
  if (releaseFieldMatch?.[0]) {
    return releaseFieldMatch[0].replace(/^.*?[：:]\s*/, '').trim();
  }

  return '';
}

function classifyFormalDomain(relativePath) {
  const segments = relativePath.split('/');
  const domain = segments[0];
  const filename = segments.at(-1);
  const basename = filename.replace(/\.md$/, '');
  const isReadme = filename === 'README.md';

  const domainEvidenceMap = {
    '01-認證與會話': [
      'backend/src/routes/auth.routes.ts',
      'backend/src/routes/session.routes.ts',
      'frontend/src/router/index.tsx',
      'frontend/src/services/api/auth.ts',
      'frontend/src/services/api/session.ts',
    ],
    '00-跨端產品核心': [
      'backend/prisma/schema.prisma',
      'backend/src/routes',
      'frontend/src/router/index.tsx',
      'frontend-admin/src/router.tsx',
      'mobile/tsconfig.json',
      'packages/contracts/src',
    ],
    '02-用戶端核心流程': [
      'frontend/src/router/index.tsx',
      'frontend/src/pages',
      'backend/src/routes/case.routes.ts',
      'backend/src/routes/interview.routes.ts',
      'backend/src/routes/chat.routes.ts',
    ],
    '03-管理端與平台治理': [
      'backend/src/routes/admin.routes.ts',
      'backend/src/routes/health.routes.ts',
      'backend/src/routes/metrics.routes.ts',
      'backend/src/middleware/adminAuth.ts',
      'backend/src/config/env.ts',
      'backend/src/utils/admin-jwt.ts',
      'frontend/src/router/index.tsx',
      'frontend/src/utils/adminEntry.ts',
      'frontend-admin/src/router.tsx',
      'frontend-admin/src/pages',
      'backend/package.json',
    ],
    '04-共用機制': [
      'frontend/src/App.tsx',
      'frontend-admin/src/App.tsx',
      'frontend/src/components/common',
      'frontend/src/services/request.ts',
      'frontend/src/services/sseRequest.ts',
      'frontend/src/services/aiStream.ts',
      'frontend-admin/src/services/request.ts',
      'packages/contracts/src',
      'packages/api-client/src',
    ],
    '05-工程架構與共享層': [
      'package.json',
      'scripts/start-dev.sh',
      'frontend/tsconfig.app.json',
      'frontend-admin/tsconfig.app.json',
      'backend/tsconfig.json',
      'mobile/package.json',
      'mobile/tsconfig.json',
      'packages/contracts/package.json',
      'packages/api-client/package.json',
      'backend/src',
      'frontend/src',
      'frontend-admin/src',
      'mobile/app',
      'mobile/src/platform',
    ],
    '06-接口描述': [
      'backend/src/app.ts',
      'backend/src/routes',
      'frontend/src/services/api',
      'frontend-admin/src/services/api',
    ],
    '07-待處理問題與治理': [
      'backend/src',
      'frontend/src',
      'frontend-admin/src',
      'docs/核心開發文件',
    ],
    '08-測試規範與驗收': [
      'backend/tests',
      'frontend/src/**/*.test.tsx',
      'frontend/e2e/**/*.ts',
      'e2e/**/*.ts',
      'scripts',
    ],
    '10-Web端': [
      'frontend/src/router/index.tsx',
      'frontend/src/pages',
      'frontend-admin/src/router.tsx',
      'frontend-admin/src/pages',
      'backend/src/routes',
      'scripts/start-dev.sh',
    ],
    '20-App端': [
      'mobile/package.json',
      'mobile/tsconfig.json',
      'mobile/app/_layout.tsx',
      'mobile/app/(tabs)/_layout.tsx',
      'mobile/app/(tabs)/index.tsx',
      'mobile/app/(tabs)/two.tsx',
      'mobile/app/modal.tsx',
      'mobile/components/Themed.tsx',
      'mobile/constants/Colors.ts',
      'mobile/src/platform',
      'packages/contracts/src',
      'packages/api-client/src',
    ],
    '50-跨端Mapping與Parity': [
      'backend/src/routes',
      'backend/prisma/schema.prisma',
      'frontend/src/router/index.tsx',
      'frontend-admin/src/router.tsx',
      'mobile/app',
      'mobile/tsconfig.json',
      'mobile/src/platform',
      'packages/contracts/src',
      'packages/api-client/src',
    ],
  };

  const domainTypeMap = {
    '00-跨端產品核心': '跨端核心',
    '06-接口描述': '接口詳規',
    '07-待處理問題與治理': '問題治理',
    '08-測試規範與驗收': '測試規範',
    '10-Web端': 'Web端規格',
    '20-App端': 'App端規格',
    '50-跨端Mapping與Parity': '跨端映射',
  };

  const domainCoverageMap = {
    '00-跨端產品核心': '跨 Web / App 的產品能力、角色、流程、狀態與一致性規則',
    '01-認證與會話': '身份、session、JWT 與會話升格主鏈路',
    '02-用戶端核心流程': '前台用戶主流程、頁面責任與跨頁狀態遷移',
    '03-管理端與平台治理': 'admin 平台治理、環境部署與運維基線',
    '04-共用機制': '前後台共享元件、樣式 token 與流式通用機制',
    '05-工程架構與共享層': '工作區結構、共享層與工程約束',
    '06-接口描述': '接口字段契約、錯誤碼、守衛與頁面對接',
    '07-待處理問題與治理': '未落地設計、活躍治理項與需要追蹤的偏差',
    '08-測試規範與驗收': '長期測試規範、驗收口徑與回歸門檻',
    '10-Web端': 'Web / Admin Web 凍結基線、平台投影與已實作狀態',
    '20-App端': 'Expo App 基線、原生能力邊界與 App 開發投影',
    '50-跨端Mapping與Parity': '跨端能力到 Web / App / Backend / API / DB / 共享層的映射與缺口',
  };

  const formalDocOverrides = {
    '07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md': {
      docType: '問題治理',
      domain: '07-待處理問題與治理',
      coverage:
        'App 版承接跨端產品核心、共享 contracts / api-client、原生能力與 Web 基線 Parity 的待處理任務',
      evidenceSources: [
        'mobile/package.json',
        'mobile/tsconfig.json',
        'mobile/app/_layout.tsx',
        'mobile/app/modal.tsx',
        'mobile/app/(public)',
        'mobile/app/(app)',
        'mobile/src/platform',
        'packages/contracts/src',
        'packages/api-client/src',
        'frontend/src/router/index.tsx',
        'backend/src/routes',
      ],
      verificationMethod:
        '核對 App 版承接跨端產品核心、shared contracts / api-client、Emorapy route group、runtime platform adapter、release evidence blocker 與 Web 基線 parity 的代碼待閉環項',
      status: '已核驗',
      isCurrentSsot: true,
    },
  };

  if (formalDocOverrides[relativePath]) {
    return formalDocOverrides[relativePath];
  }

  return {
    docType: isReadme ? '域索引' : domainTypeMap[domain] || '正式規格',
    domain,
    coverage:
      isReadme
        ? `${domain} 子域入口與閱讀順序`
        : filename.startsWith('00-')
          ? `${domainCoverageMap[domain]}總覽`
          : `${domainCoverageMap[domain]}：${basename}`,
    evidenceSources: domainEvidenceMap[domain] || ['docs/核心開發文件'],
    verificationMethod:
      domain === '06-接口描述'
        ? '以 route 註冊、前後台 API client 與錯誤碼實作逐條核對'
        : '以對應子域代碼入口、路由、頁面與狀態枚舉交叉核對',
    status: domain === '07-待處理問題與治理' ? '已核驗' : '已核驗',
    isCurrentSsot: true,
  };
}

function classifyTestingDoc(relativePath) {
  const basename = path.posix.basename(relativePath, '.md');
  const isReadme = path.posix.basename(relativePath) === 'README.md';
  return {
    docType: isReadme ? '測試索引' : '測試案例',
    domain: '測試',
    coverage: isReadme ? '測試目錄入口與使用規則' : `回歸案例/驗收腳本：${basename}`,
    evidenceSources: buildEvidenceSources(
      ['backend/tests', 'frontend/src/**/*.test.tsx', 'frontend/e2e/**/*.ts', 'e2e/**/*.ts', 'scripts'],
      basename.includes('Repair Journey')
        ? ['backend/src/routes/reconciliation.routes.ts', 'backend/src/routes/execution.routes.ts']
        : []
    ),
    verificationMethod: '核對測試案例仍對應現有頁面、接口與狀態機',
    status: '已核驗',
    isCurrentSsot: true,
  };
}

function classifyEvidenceDoc(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const extension = path.posix.extname(normalized);
  const basename = path.posix.basename(normalized, extension);

  if (normalized.includes('/頁面HTML快照/')) {
    return {
      docType: extension === '.html' ? 'HTML快照' : 'HTML快照索引',
      domain: '90-證據與盤點',
      coverage:
        extension === '.html'
          ? `頁面快照證據：${basename}`
          : '頁面 HTML 快照入口與導出說明',
      evidenceSources: ['scripts/export-static-pages.mjs', 'frontend/src/router/index.tsx', 'frontend-admin/src/router.tsx'],
      verificationMethod: '核對快照路徑、頁面標識、導出來源與索引可追溯性',
      status: '證據已核對',
      isCurrentSsot: false,
      context: '非現行 SSOT；僅作視覺/結構證據回看',
    };
  }

  const evidenceContextMap = [
    {
      fragment: '/AI流式驗證/',
      coverage: `AI 流式驗收與治理證據：${basename}`,
      evidenceSources: [
        'backend/src/services/ai-stream.service.ts',
        'backend/src/routes/ai-stream.routes.ts',
        'frontend/src/hooks/useAIStreamSubscription.ts',
      ],
      context: 'AI Stream 重構與驗收證據',
    },
    {
      fragment: '/手動回歸證據/',
      coverage: `手動回歸證據：${basename}`,
      evidenceSources: ['scripts/run-manual-regression-gate.mjs', 'docs/核心開發文件/測試'],
      context: '按日期/P 批次留存的手動回歸結果與摘要',
    },
    {
      fragment: '/環境與發版驗證/',
      coverage: `環境/發版驗證證據：${basename}`,
      evidenceSources: [
        '.github/workflows/ci.yml',
        '.github/workflows/manual-regression-gate.yml',
        'backend/src/routes/health.routes.ts',
        'backend/src/routes/metrics.routes.ts',
      ],
      context: '環境配置、發版前後驗證與 smoke 證據',
    },
  ];

  const matched = evidenceContextMap.find((item) => normalized.includes(item.fragment));
  return {
    docType: extension === '.json' ? '證據索引' : path.posix.basename(normalized) === 'README.md' ? '證據索引' : '證據文檔',
    domain: '90-證據與盤點',
    coverage: matched?.coverage || `證據文檔：${basename}`,
    evidenceSources: matched?.evidenceSources || ['docs/核心開發文件/90-證據與盤點'],
    verificationMethod: '核對來源、日期、鏈接與上下文是否可追溯',
    status: '證據已核對',
    isCurrentSsot: false,
    context: matched?.context || '非現行 SSOT；僅作證據留存',
  };
}

function classifyHistoryDoc(relativePath) {
  const basename = path.posix.basename(relativePath, '.md');
  const filename = path.posix.basename(relativePath);
  const isReadme = filename === 'README.md';
  const isPlan = basename.includes('方案');
  return {
    docType: isReadme ? '歷史索引' : isPlan ? '歷史方案' : '歷史索引',
    domain: '99-歷史降級索引',
    coverage: isReadme ? '歷史回看入口與降級規則' : isPlan ? `歷史方案：${basename}` : `歷史方案/降級索引：${basename}`,
    evidenceSources: ['歸檔', 'docs/核心開發文件/README.md'],
    verificationMethod: '核對歷史定位、入口鏈接與非 SSOT 標記清晰',
    status: '已降級',
    isCurrentSsot: false,
    context: '非現行 SSOT；僅保留歷史方案與遷移索引',
  };
}

function classifyGovernanceDoc(relativePath) {
  const basename = path.posix.basename(relativePath, '.md');
  const filename = path.posix.basename(relativePath);
  const activeGovernanceDocs = new Set([
    'README.md',
    '00-CJ-文檔治理與同步規則.md',
    '01-CJ-文檔收斂台賬與批次索引.md',
    '02-CJ-全項目Markdown收斂台賬-2026-04-18.md',
    '03-CJ-核心開發文件逐文件代碼校驗總台賬-2026-04-18.md',
  ]);
  const isActive = activeGovernanceDocs.has(filename);
  return {
    docType: filename === 'README.md' ? '治理索引' : isActive ? '文檔治理' : '治理記錄',
    domain: '文件收斂',
    coverage: `文檔治理/台賬：${basename}`,
    evidenceSources: [
      'package.json',
      'scripts/check-docs-structure.mjs',
      'scripts/check-docs-truth.mjs',
      'scripts/confirm-docs-audit-sync.mjs',
      'scripts/sync-core-docs-metadata.mjs',
      'scripts/generate-core-docs-audit-ledger.mjs',
      'scripts/lib/core-docs-audit.mjs',
      'docs/核心開發文件',
    ],
    verificationMethod: '核對目錄契約、台賬覆蓋與治理規則是否自洽',
    status: isActive ? '已核驗' : '已降級',
    isCurrentSsot: false,
    context: isActive
      ? '非產品/工程 SSOT；承接當前文檔治理契約與台賬'
      : '非現行 SSOT；僅作文檔治理歷史記錄',
  };
}

export async function walkCoreDocsFiles(repoRoot) {
  const coreDocsRoot = joinRepoPath(repoRoot, CORE_DOCS_SEGMENTS);
  const collected = [];
  const stack = [coreDocsRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && WALKABLE_EXTENSIONS.has(path.extname(entry.name))) {
        collected.push(entryPath);
      }
    }
  }

  return collected.sort();
}

export async function classifyCoreDoc(repoRoot, absolutePath) {
  const coreDocsRoot = joinRepoPath(repoRoot, CORE_DOCS_SEGMENTS);
  const relativePath = normalizeRelativePath(path.relative(coreDocsRoot, absolutePath));
  const extension = path.posix.extname(relativePath);
  const content = extension === '.md' ? await fs.readFile(absolutePath, 'utf8') : '';
  const rootOverride = ROOT_DOC_OVERRIDES[relativePath];

  let base;
  if (rootOverride) {
    base = {
      ...rootOverride,
      domain: '根層旗艦',
      status: '已核驗',
      isCurrentSsot: true,
    };
  } else if (/^(?:0[0-8]|10|20|50)-[^/]+\//.test(relativePath)) {
    base = classifyFormalDomain(relativePath);
  } else if (relativePath.startsWith('測試/')) {
    base = classifyTestingDoc(relativePath);
  } else if (relativePath.startsWith('90-證據與盤點/')) {
    base = classifyEvidenceDoc(relativePath);
  } else if (relativePath.startsWith('99-歷史降級索引/')) {
    base = classifyHistoryDoc(relativePath);
  } else if (relativePath.startsWith('文件收斂/')) {
    base = classifyGovernanceDoc(relativePath);
  } else {
    base = {
      docType: extension === '.md' ? '未分類文檔' : '未分類資產',
      domain: '未分類',
      coverage: relativePath,
      evidenceSources: ['docs/核心開發文件'],
      verificationMethod: '需人工補充分類',
      status: '待核驗',
      isCurrentSsot: false,
      context: '待人工裁決',
    };
  }

  return {
    relativePath,
    extension,
    sourceDate: inferSourceDate(relativePath, content),
    ...base,
    evidenceSources: buildEvidenceSources(base.evidenceSources),
  };
}

export function formatEvidenceSources(sources) {
  return sources.map((item) => `\`${item}\``).join('、');
}

export function buildMetadataBlock(metadata) {
  const lines = [CORE_DOC_AUDIT_METADATA_START];
  lines.push(`**文檔類型**：${metadata.docType}`);

  if (metadata.isCurrentSsot) {
    lines.push(`**覆蓋範圍**：${metadata.coverage}`);
    lines.push(`**取證代碼入口**：${formatEvidenceSources(metadata.evidenceSources)}`);
  } else {
    const resolvedSourceDate = metadata.sourceDate || metadata.lastVerifiedDate || '未標註';
    lines.push(`**來源時間**：${resolvedSourceDate}`);
    lines.push(`**上下文**：${metadata.context || metadata.coverage}`);
    lines.push('**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）');
  }

  lines.push(`**最後核驗 Commit**：\`${metadata.lastVerifiedCommit}\``);
  lines.push(`**最後核驗日期**：\`${metadata.lastVerifiedDate}\``);
  lines.push(CORE_DOC_AUDIT_METADATA_END);
  return lines.join('\n');
}
