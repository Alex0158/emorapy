import path from 'node:path';

export const CORE_DOCS_SEGMENTS = ['docs', '核心開發文件'];
export const MARKETING_DOCS_SEGMENTS = ['docs', '核心營銷文件'];
export const ALLOWED_MARKDOWN_SEGMENT_GROUPS = [
  CORE_DOCS_SEGMENTS,
  MARKETING_DOCS_SEGMENTS,
];

export const CORE_DOCS_ROOT_FILES = [
  'README.md',
  '功能特性清單.md',
  '頁面清單.md',
  '全接口清單-主文檔.md',
  '接口-功能-頁面-Mapping.md',
  '業務流程整合.md',
  '術語表.md',
];

export const CORE_DOCS_ROOT_DIRS = [
  '00-跨端產品核心',
  '01-認證與會話',
  '02-用戶端核心流程',
  '03-管理端與平台治理',
  '04-共用機制',
  '05-工程架構與共享層',
  '06-接口描述',
  '07-待處理問題與治理',
  '08-測試規範與驗收',
  '10-Web端',
  '20-App端',
  '50-跨端Mapping與Parity',
  '90-證據與盤點',
  '99-歷史降級索引',
  '文件收斂',
  '測試',
];

export const FORMAL_DOMAIN_DIRS = [
  '00-跨端產品核心',
  '01-認證與會話',
  '02-用戶端核心流程',
  '03-管理端與平台治理',
  '04-共用機制',
  '05-工程架構與共享層',
  '10-Web端',
  '20-App端',
  '50-跨端Mapping與Parity',
];

export const MANUAL_REGRESSION_EVIDENCE_SEGMENTS = [
  ...CORE_DOCS_SEGMENTS,
  '90-證據與盤點',
  '手動回歸證據',
];

export const HTML_SNAPSHOT_SEGMENTS = [
  ...CORE_DOCS_SEGMENTS,
  '90-證據與盤點',
  '頁面HTML快照',
];

export const LEGACY_DOC_PATH_RULES = [
  {
    name: 'legacy-interface-path',
    patterns: [
      'docs/核心開發文件/接口描述/',
      './接口描述/',
      '../接口描述/',
    ],
  },
  {
    name: 'legacy-staging-runtime-path',
    patterns: ['docs/核心開發文件/Staging 運行時收口記錄-'],
  },
  {
    name: 'legacy-manual-regression-evidence-path',
    patterns: ['docs/核心開發文件/發版前手動回歸證據/'],
  },
  {
    name: 'legacy-html-snapshot-path',
    patterns: ['docs/核心開發文件/頁面HTML/'],
  },
  {
    name: 'legacy-marketing-path',
    patterns: ['docs/核心開發文件/Marketing/'],
  },
];

export const LEGACY_DOC_PATH_ALLOWLIST = [
  path.join(
    'docs',
    '核心開發文件',
    '99-歷史降級索引',
    '00-2026-04-首輪重構遷移索引.md'
  ),
];

export function joinRepoPath(repoRoot, segments) {
  return path.join(repoRoot, ...segments);
}

export function joinRepoRelativePath(segments) {
  return path.posix.join(...segments);
}
