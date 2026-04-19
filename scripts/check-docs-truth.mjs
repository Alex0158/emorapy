import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extractCoreDocsTruth } from './lib/core-docs-truth.mjs';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const coreDocsRoot = path.join(repoRoot, 'docs', '核心開發文件');
const execFileAsync = promisify(execFile);
const gitPathspecMatchCache = new Map();
const gitTrackedPathCache = new Map();
const gitAncestorOfHeadCache = new Map();
const NON_DOC_METADATA_EVIDENCE_PATHS = new Set([
  'package.json',
  'backend/package.json',
  'frontend/package.json',
  'backend/prisma/schema.prisma',
  'frontend/tsconfig.app.json',
  'frontend-admin/tsconfig.app.json',
  'backend/tsconfig.json',
  'mobile/tsconfig.json',
]);
const ALLOWED_METADATA_EVIDENCE_PATH_PATTERNS = [
  /^(backend|frontend|frontend-admin|mobile|packages|scripts|e2e)\//,
  /^(backend|frontend|frontend-admin|mobile|packages|scripts|e2e)$/,
  /^docs\/核心開發文件$/,
];
const MANUAL_FLOW_IDS = ['P01', 'P02', 'P03', 'P04', 'P05'];
const API_STATUS_VALUES = new Set(['已使用', '候選廢棄', '已確認廢棄']);
const GENERIC_STREAM_DOC_ENDPOINTS = [
  '/api/v1/streams/case_judgment/:id',
  '/api/v1/streams/repair_track/:id',
  '/api/v1/streams/interview_session/:id',
  '/api/v1/streams/chat_room/:roomId',
];
const FORMAL_DOC_ROOT_FILES = [
  'README.md',
  '功能特性清單.md',
  '頁面清單.md',
  '全接口清單-主文檔.md',
  '接口-功能-頁面-Mapping.md',
  '業務流程整合.md',
  '術語表.md',
];
const FORMAL_DOC_DOMAIN_DIRS = [
  '01-認證與會話',
  '02-用戶端核心流程',
  '03-管理端與平台治理',
  '04-共用機制',
  '05-工程架構與共享層',
  '06-接口描述',
  '07-待處理問題與治理',
  '08-測試規範與驗收',
];
const FORMAL_DOC_AUDIT_LEDGER_PATH = '文件收斂/03-CJ-核心開發文件逐文件代碼校驗總台賬-2026-04-18.md';
const FORMAL_DOC_CLOSED_LEDGER_STATUSES = new Set(['已修正', '已核驗']);
const FORMAL_DOC_LEDGER_STATUS_KEYS = ['已修正', '已核驗', '證據已核對', '已降級'];
const FORMAL_DOC_LEDGER_DOMAIN_KEYS = [
  '01-認證與會話',
  '02-用戶端核心流程',
  '03-管理端與平台治理',
  '04-共用機制',
  '05-工程架構與共享層',
  '06-接口描述',
  '07-待處理問題與治理',
  '08-測試規範與驗收',
  '90-證據與盤點',
  '99-歷史降級索引',
  '測試',
  '根層旗艦',
  '文件收斂',
];
const FORMAL_DOC_MISSING_PATH_ALLOWLIST = {
  '04-共用機制/01-樣式Token與共享視覺規範.md': [
    { path: 'frontend/src/styles/theme.ts', marker: '目前不存在 `frontend/src/styles/theme.ts`' },
  ],
  '05-工程架構與共享層/Repo平台分層與共享規範.md': [
    { path: 'packages/domain', marker: '建立 `packages/domain`' },
  ],
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readDoc(relativePath) {
  return fs.readFile(path.join(coreDocsRoot, relativePath), 'utf8');
}

async function collectMarkdownDocsUnder(relativeDir) {
  const rootDir = path.join(coreDocsRoot, relativeDir);
  const docs = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        docs.push(path.relative(coreDocsRoot, entryPath).split(path.sep).join('/'));
      }
    }
  }

  return docs.sort();
}

async function collectFilesUnder(relativeDir, extension) {
  const rootDir = path.join(coreDocsRoot, relativeDir);
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(path.relative(rootDir, entryPath).split(path.sep).join('/'));
      }
    }
  }

  return files.sort();
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isResolvableGitCommit(commitRef) {
  try {
    await execFileAsync('git', ['rev-parse', '--quiet', '--verify', `${commitRef}^{commit}`], {
      cwd: repoRoot,
    });
    return true;
  } catch {
    return false;
  }
}

async function readGitCommitDateYmd(commitRef) {
  try {
    const { stdout } = await execFileAsync('git', ['show', '-s', '--format=%cs', commitRef], {
      cwd: repoRoot,
    });
    const commitDate = stdout.trim();
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(commitDate)) {
      return null;
    }
    return commitDate;
  } catch {
    return null;
  }
}

function isWildcardPathToken(pathRef) {
  return /[*?[\]{}]/.test(pathRef);
}

async function hasGitPathspecMatch(pathSpec) {
  if (gitPathspecMatchCache.has(pathSpec)) {
    return gitPathspecMatchCache.get(pathSpec);
  }
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '--', `:(glob)${pathSpec}`], {
      cwd: repoRoot,
    });
    const matched = stdout.trim().length > 0;
    gitPathspecMatchCache.set(pathSpec, matched);
    return matched;
  } catch {
    gitPathspecMatchCache.set(pathSpec, false);
    return false;
  }
}

async function hasGitTrackedPath(pathRef) {
  if (gitTrackedPathCache.has(pathRef)) {
    return gitTrackedPathCache.get(pathRef);
  }
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '--', pathRef], {
      cwd: repoRoot,
    });
    const matched = stdout.trim().length > 0;
    gitTrackedPathCache.set(pathRef, matched);
    return matched;
  } catch {
    gitTrackedPathCache.set(pathRef, false);
    return false;
  }
}

async function isCommitAncestorOfHead(commitRef) {
  if (gitAncestorOfHeadCache.has(commitRef)) {
    return gitAncestorOfHeadCache.get(commitRef);
  }
  try {
    await execFileAsync('git', ['merge-base', '--is-ancestor', commitRef, 'HEAD'], {
      cwd: repoRoot,
    });
    gitAncestorOfHeadCache.set(commitRef, true);
    return true;
  } catch {
    gitAncestorOfHeadCache.set(commitRef, false);
    return false;
  }
}

function isScriptPathWiredInPackageScripts(pathRef, packageJson) {
  if (!pathRef.startsWith('scripts/')) {
    return false;
  }
  const scripts = packageJson?.scripts || {};
  return Object.values(scripts).some((command) => typeof command === 'string' && command.includes(pathRef));
}

function isNonDocMetadataEvidencePath(pathRef) {
  if (/^(backend|frontend|frontend-admin|mobile|packages|scripts|e2e)(\/|$)/.test(pathRef)) {
    return true;
  }
  return NON_DOC_METADATA_EVIDENCE_PATHS.has(pathRef);
}

function isAllowedMetadataEvidencePath(pathRef) {
  if (NON_DOC_METADATA_EVIDENCE_PATHS.has(pathRef)) {
    return true;
  }
  return ALLOWED_METADATA_EVIDENCE_PATH_PATTERNS.some((pattern) => pattern.test(pathRef));
}

function parseStatValue(content, label) {
  const statRe = new RegExp(`\\|\\s*${escapeRegExp(label)}\\s*\\|\\s*([0-9]+)\\s*\\|`);
  const match = content.match(statRe);
  return match ? Number(match[1]) : null;
}

function parseInlineCounterValue(content, label) {
  const statRe = new RegExp(`${escapeRegExp(label)}[：:]\\s*` + '`?([0-9]+)`?');
  const match = content.match(statRe);
  return match ? Number(match[1]) : null;
}

function getCurrentDateYmdInShanghai() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const partMap = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function stripInlineCodeToken(value) {
  return value.replace(/^`|`$/g, '').trim();
}

function normalizeBacktickPathToken(token) {
  return token
    .replace(/^[./]+/, '')
    .replace(/^[("']+/, '')
    .replace(/[)"'`。；，,.;:]+$/, '')
    .trim();
}

function extractFormalMetadataEvidencePathRefs(content) {
  const metadataBlockMatch = content.match(
    /<!-- CORE_DOC_AUDIT_METADATA:START -->[\s\S]*?<!-- CORE_DOC_AUDIT_METADATA:END -->/
  );
  if (!metadataBlockMatch) {
    return [];
  }
  const metadataBlock = metadataBlockMatch[0];
  const evidenceLine =
    metadataBlock
      .split('\n')
      .find((line) => line.includes('**取證代碼入口**')) || '';
  if (!evidenceLine) {
    return [];
  }

  const refs = new Set();
  const quotedCodeRe = /`([^`\n]+)`/g;
  for (const match of evidenceLine.matchAll(quotedCodeRe)) {
    const normalized = normalizeBacktickPathToken(match[1].trim());
    if (!normalized) {
      continue;
    }
    refs.add(normalized);
  }

  return [...refs].sort();
}

function extractTableFirstColumnMarkdownNames(content) {
  const names = [];
  for (const line of content.split('\n')) {
    if (!line.trim().startsWith('|')) {
      continue;
    }
    const cells = line.split('|').map((cell) => cell.trim());
    const firstColumn = cells[1] || '';
    if (firstColumn.endsWith('.md')) {
      names.push(firstColumn);
    }
  }
  return names;
}

function parseAuditLedgerStatusRows(content) {
  const statusByPath = new Map();
  const duplicatePaths = [];
  const rows = [];

  for (const line of content.split('\n')) {
    if (!line.startsWith('| `')) {
      continue;
    }
    const cells = line.split('|').map((cell) => cell.trim());
    const pathCell = cells[1] || '';
    const domainCell = cells[3] || '';
    const statusCell = cells[6] || '';
    if (!pathCell.startsWith('`') || !pathCell.endsWith('`')) {
      continue;
    }
    const docPath = pathCell.slice(1, -1);
    if (statusByPath.has(docPath)) {
      duplicatePaths.push(docPath);
      continue;
    }
    statusByPath.set(docPath, statusCell);
    rows.push({ docPath, domain: domainCell, status: statusCell });
  }

  return { statusByPath, duplicatePaths, rows };
}

function parseAuditLedgerSummaryStats(content) {
  const summarySectionMatch = content.match(/## 摘要[\s\S]*?(?=\n## 逐文件台賬)/);
  if (!summarySectionMatch) {
    return null;
  }
  const summaryStats = new Map();
  for (const line of summarySectionMatch[0].split('\n')) {
    const rowMatch = line.match(/^\|\s*(.+?)\s*\|\s*([0-9]+)\s*\|\s*$/);
    if (!rowMatch) {
      continue;
    }
    summaryStats.set(rowMatch[1], Number(rowMatch[2]));
  }
  return summaryStats;
}

function extractBacktickTestPathRefs(content) {
  const refs = new Set();
  const quotedCodeRe = /`([^`\n]+)`/g;
  const allowedPrefixRe = /^(backend|frontend|frontend-admin|mobile|e2e|packages|scripts)\//;
  const allowedSuffixRe = /(?:\.test\.(?:ts|tsx)|\.e2e\.ts)$/;

  for (const match of content.matchAll(quotedCodeRe)) {
    const code = match[1].trim();
    if (!code) {
      continue;
    }
    const candidates = code.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
    for (const token of candidates) {
      const normalized = token
        .replace(/^[./]+/, '')
        .replace(/^[("']+/, '')
        .replace(/[)"'`。；，,.;:]+$/, '');
      if (!normalized) {
        continue;
      }
      if (!allowedPrefixRe.test(normalized) || !allowedSuffixRe.test(normalized)) {
        continue;
      }
      if (normalized.includes('*') || normalized.includes('<') || normalized.includes('>')) {
        continue;
      }
      refs.add(normalized);
    }
  }

  return [...refs].sort();
}

function extractBacktickScriptPathRefs(content) {
  const refs = new Set();
  const quotedCodeRe = /`([^`\n]+)`/g;
  const allowedPrefixRe = /^scripts\//;
  const allowedSuffixRe = /\.(?:mjs|js|sh|ts)$/;

  for (const match of content.matchAll(quotedCodeRe)) {
    const code = match[1].trim();
    if (!code) {
      continue;
    }
    const candidates = code.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
    for (const token of candidates) {
      const normalized = token
        .replace(/^[./]+/, '')
        .replace(/^[("']+/, '')
        .replace(/[)"'`。；，,.;:]+$/, '');
      if (!normalized) {
        continue;
      }
      if (!allowedPrefixRe.test(normalized) || !allowedSuffixRe.test(normalized)) {
        continue;
      }
      if (normalized.includes('*') || normalized.includes('<') || normalized.includes('>')) {
        continue;
      }
      refs.add(normalized);
    }
  }

  return [...refs].sort();
}

function extractBacktickRepoPathRefs(content) {
  const refs = new Set();
  const quotedCodeRe = /`([^`\n]+)`/g;
  const allowedPrefixRe = /^(backend|frontend|frontend-admin|mobile|e2e|packages|scripts)\//;

  for (const match of content.matchAll(quotedCodeRe)) {
    const code = match[1].trim();
    if (!code) {
      continue;
    }
    const candidates = code.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
    for (const token of candidates) {
      const normalized = token
        .replace(/^[./]+/, '')
        .replace(/^[("']+/, '')
        .replace(/[)"'`。；，,.;:]+$/, '');
      if (!normalized) {
        continue;
      }
      if (!allowedPrefixRe.test(normalized)) {
        continue;
      }
      if (
        normalized.includes('*') ||
        normalized.includes('<') ||
        normalized.includes('>') ||
        normalized.includes('{') ||
        normalized.includes('}') ||
        normalized.includes('|')
      ) {
        continue;
      }
      refs.add(normalized);
    }
  }

  return [...refs].sort();
}

function ensureRouteRow(content, route) {
  return content
    .split('\n')
    .some((line) => line.includes(route.fullPath) && line.includes(route.guardType));
}

function ensureAdminRouteRow(content, fullPath) {
  return content.split('\n').some((line) => line.includes(fullPath));
}

function lineHasEndpoint(line, method, endpointPath) {
  const escapedMethod = escapeRegExp(method);
  const escapedPath = escapeRegExp(endpointPath);
  const inlineMethodPathRe = new RegExp(`\\\`${escapedMethod}\\s+${escapedPath}\\\``);
  if (inlineMethodPathRe.test(line)) {
    return true;
  }
  const tableMethodPathRe = new RegExp(
    `^\\|\\s*${escapedMethod}\\s*\\|\\s*\\\`${escapedPath}\\\`\\s*\\|`
  );
  return tableMethodPathRe.test(line);
}

function ensureEndpointRow(content, endpoint) {
  return content.split('\n').some((line) => lineHasEndpoint(line, endpoint.method, endpoint.path));
}

function findEndpointRow(content, method, endpointPath) {
  return content.split('\n').find((line) => lineHasEndpoint(line, method, endpointPath)) || null;
}

function isCoveredByGenericStreamDocs(endpointPath, content) {
  if (endpointPath !== '/api/v1/streams/:scopeType/:scopeId') {
    return false;
  }
  return GENERIC_STREAM_DOC_ENDPOINTS.every((docPath) =>
    content.includes(docPath)
  );
}

function parseApiMainStatusRows(content) {
  const rowsByKey = new Map();
  const duplicateKeys = [];
  const unknownStatuses = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (!/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|/.test(line)) {
      continue;
    }
    const cells = line.split('|').map((cell) => cell.trim());
    const method = cells[1];
    const endpointPath = stripInlineCodeToken(cells[2] || '');
    const status = cells[4] || '';
    const endpointType = cells[5] || '';
    const auth = cells[6] || '';

    if (!endpointPath.startsWith('/')) {
      continue;
    }

    const key = `${method} ${endpointPath}`;
    if (rowsByKey.has(key)) {
      duplicateKeys.push(key);
      continue;
    }
    rowsByKey.set(key, { method, endpointPath, status, endpointType, auth, line });

    if (!API_STATUS_VALUES.has(status)) {
      unknownStatuses.push({ key, status });
    }
  }

  return { rowsByKey, duplicateKeys, unknownStatuses };
}

function parseMappingStatusRows(content) {
  const rowsByKey = new Map();
  const duplicateKeys = [];
  const unknownStatuses = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const endpointMatch = line.match(/^\|\s*`(GET|POST|PUT|PATCH|DELETE)\s+([^`]+)`\s*\|/);
    if (!endpointMatch) {
      continue;
    }

    const method = endpointMatch[1];
    const endpointPath = endpointMatch[2].trim();
    if (!endpointPath.startsWith('/')) {
      continue;
    }

    const cells = line.split('|').map((cell) => cell.trim());
    const status = cells[cells.length - 2] || '';
    const key = `${method} ${endpointPath}`;
    if (rowsByKey.has(key)) {
      duplicateKeys.push(key);
      continue;
    }
    rowsByKey.set(key, { method, endpointPath, status, line });

    if (!API_STATUS_VALUES.has(status)) {
      unknownStatuses.push({ key, status });
    }
  }

  return { rowsByKey, duplicateKeys, unknownStatuses };
}

function resolveEndpointStatusFromRows(endpoint, rowsByKey) {
  if (endpoint.path === '/api/v1/streams/:scopeType/:scopeId') {
    const scopedStatuses = [...new Set(
      GENERIC_STREAM_DOC_ENDPOINTS.map((docPath) => rowsByKey.get(`${endpoint.method} ${docPath}`)?.status).filter(
        Boolean
      )
    )];
    if (scopedStatuses.length === 1) {
      return scopedStatuses[0];
    }
    if (scopedStatuses.length > 1) {
      return '__MIXED__';
    }
    return null;
  }

  return rowsByKey.get(`${endpoint.method} ${endpoint.path}`)?.status || null;
}

async function readLatestManualRegressionSummary() {
  const evidenceRoot = path.join(coreDocsRoot, '90-證據與盤點', '手動回歸證據');
  let entries = [];
  try {
    entries = await fs.readdir(evidenceRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const dateDirs = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (dateDirs.length === 0) {
    return null;
  }

  const latestDate = dateDirs[dateDirs.length - 1];
  const summaryPath = path.join(evidenceRoot, latestDate, 'summary.md');
  let summary = '';
  try {
    summary = await fs.readFile(summaryPath, 'utf8');
  } catch {
    return null;
  }

  const summaryStatuses = {};
  for (const flowId of MANUAL_FLOW_IDS) {
    const summaryRowMatch = summary.match(new RegExp(`\\|\\s*${flowId}\\b[^\\n]*\\|\\s*([A-Z_]+)\\s*\\|`));
    summaryStatuses[flowId] = summaryRowMatch ? summaryRowMatch[1] : 'MISSING';
  }

  const recordStatuses = {};
  for (const flowId of MANUAL_FLOW_IDS) {
    const recordPath = path.join(evidenceRoot, latestDate, flowId, 'record.md');
    try {
      const record = await fs.readFile(recordPath, 'utf8');
      const statusMatch = record.match(/^- 狀態：\s*(\S+)/m);
      recordStatuses[flowId] = statusMatch ? statusMatch[1] : 'MISSING';
    } catch {
      recordStatuses[flowId] = 'MISSING';
    }
  }

  return { latestDate, summary, summaryStatuses, recordStatuses };
}

async function main() {
  const truth = await extractCoreDocsTruth(repoRoot);
  const [
    pageListDoc,
    apiMainDoc,
    mappingDoc,
    flowDoc,
    glossaryDoc,
    readmeDoc,
    featureDoc,
    interfaceDocs,
    authSessionInterfaceDoc,
    caseInterfaceDoc,
    judgmentInterfaceDoc,
    interviewInterfaceDoc,
    chatInterfaceDoc,
    profilePairingInterfaceDoc,
    contentNotificationInterfaceDoc,
    adminInterfaceDoc,
    healthMetricsInterfaceDoc,
    adminGovernanceOverviewDoc,
    reconciliationExecutionInterfaceDoc,
    envBaselineDoc,
    commonMechanismDoc,
    architectureOverviewDoc,
    workspaceBaselineDoc,
    repoLayerSpecDoc,
    activeRiskDoc,
    handledIssueLedgerDoc,
    outOfScopeIssueDoc,
    testingReadmeDoc,
    testingRulesDoc,
    testingAIGateDoc,
    testingActiveEntryDoc,
    testingRegressionReadmeDoc,
    testingRegressionRecordDoc,
    testingManualRunbookDoc,
    testingManualPackDoc,
    testingScenarioReadmeDoc,
    testingQuickExperienceReadmeDoc,
    testingChatRoomReadmeDoc,
    testingRepairJourneyMatrixDoc,
    testingUnauthDirectChecklistDoc,
    authOverviewDoc,
    authFlowOverviewDoc,
    authServiceCode,
    sessionControllerCode,
    sessionServiceCode,
    caseServiceCode,
    interviewServiceCode,
    chatServiceCode,
    reconciliationServiceCode,
    executionServiceCode,
    adminControllerCode,
    adminAuthCode,
    adminRoutesCode,
    adminEntryCode,
    adminConfigsPageCode,
    adminSettingsPageCode,
    backendEnvCode,
    backendAppCode,
    healthRoutesCode,
    metricsRoutesCode,
    metaRoutesCode,
    aiStreamServiceCode,
    constantsCode,
    requestServiceCode,
    adminRequestServiceCode,
    publicRouteCode,
    protectedRouteCode,
    authStoreCode,
    interviewRoutesCode,
    caseCreatePageCode,
    profilePairingPageCode,
    interviewChatPageCode,
    interviewStoreCode,
    validationCode,
    frontendVersionInfoCode,
    frontendAdminVersionInfoCode,
    manualGateScriptCode,
    criticalE2ESkipGuardCode,
    rootPackageJsonRaw,
    frontendPackageJsonRaw,
    frontendTsconfigRaw,
    frontendAdminTsconfigRaw,
    backendTsconfigRaw,
    mobileTsconfigRaw,
    snapshotManifestRaw,
  ] = await Promise.all([
    readDoc('頁面清單.md'),
    readDoc('全接口清單-主文檔.md'),
    readDoc('接口-功能-頁面-Mapping.md'),
    readDoc('業務流程整合.md'),
    readDoc('術語表.md'),
    readDoc('README.md'),
    readDoc('功能特性清單.md'),
    fs.readFile(path.join(coreDocsRoot, '06-接口描述', 'README.md'), 'utf8').then(async (readme) => {
      const files = await fs.readdir(path.join(coreDocsRoot, '06-接口描述'));
      const docs = await Promise.all(
        files
          .filter((file) => file.endsWith('.md'))
          .map((file) => fs.readFile(path.join(coreDocsRoot, '06-接口描述', file), 'utf8'))
      );
      return [readme, ...docs].join('\n');
    }),
    readDoc(path.join('06-接口描述', '01-auth-session.md')),
    readDoc(path.join('06-接口描述', '03-case.md')),
    readDoc(path.join('06-接口描述', '04-judgment.md')),
    readDoc(path.join('06-接口描述', '06-interview-psych-profile.md')),
    readDoc(path.join('06-接口描述', '07-chat.md')),
    readDoc(path.join('06-接口描述', '02-user-profile-pairing.md')),
    readDoc(path.join('06-接口描述', '08-content-notification.md')),
    readDoc(path.join('06-接口描述', '09-admin.md')),
    readDoc(path.join('06-接口描述', '10-health-metrics.md')),
    readDoc(path.join('03-管理端與平台治理', '00-管理端與平台治理總覽.md')),
    readDoc(path.join('06-接口描述', '05-reconciliation-execution.md')),
    readDoc(path.join('03-管理端與平台治理', '01-環境與部署基線.md')),
    readDoc(path.join('04-共用機制', '00-共用機制總覽.md')),
    readDoc(path.join('05-工程架構與共享層', '00-工程架構與共享層總覽.md')),
    readDoc(path.join('05-工程架構與共享層', '01-本地開發與工作區基線.md')),
    readDoc(path.join('05-工程架構與共享層', 'Repo平台分層與共享規範.md')),
    readDoc(path.join('07-待處理問題與治理', '待處理', '已知風險清單-2026-03-17.md')),
    readDoc(path.join('07-待處理問題與治理', '已處理', '業務缺陷收斂台帳-2026-03-17.md')),
    readDoc(path.join('07-待處理問題與治理', '不處理', '不納入發版項清單-2026-03-17.md')),
    readDoc(path.join('08-測試規範與驗收', 'README.md')),
    readDoc(path.join('08-測試規範與驗收', '01-測試文檔分層與使用規則.md')),
    readDoc(path.join('08-測試規範與驗收', '02-AI流式與Chat治理驗收基線.md')),
    readDoc(path.join('測試', 'README.md')),
    readDoc(path.join('測試', '回歸與驗收', 'README.md')),
    readDoc(path.join('測試', '回歸與驗收', '發版前回歸記錄-2026-03-17.md')),
    readDoc(path.join('測試', '回歸與驗收', '發版前手動回歸執行版-2026-03-17.md')),
    readDoc(path.join('測試', '回歸與驗收', '發版前手動回歸包-2026-03-17.md')),
    readDoc(path.join('測試', '活躍場景案例', 'README.md')),
    readDoc(path.join('測試', '活躍場景案例', 'quick-experience', 'README.md')),
    readDoc(path.join('測試', '活躍場景案例', 'chat-room', 'README.md')),
    readDoc(path.join('測試', '回歸與驗收', 'Repair Journey 2.3 場景驗收矩陣.md')),
    readDoc(path.join('測試', '回歸與驗收', '未登入直連-回歸驗證清單.md')),
    readDoc(path.join('01-認證與會話', '00-認證與會話總覽.md')),
    readDoc(path.join('02-用戶端核心流程', '00-用戶端核心流程總覽.md')),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'auth.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'controllers', 'session.controller.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'session.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'case.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'interview.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'chat.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'reconciliation.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'execution.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'controllers', 'admin.controller.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'middleware', 'adminAuth.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'routes', 'admin.routes.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'utils', 'adminEntry.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend-admin', 'src', 'pages', 'Admin', 'Configs', 'index.tsx'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend-admin', 'src', 'pages', 'Admin', 'Settings', 'index.tsx'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'config', 'env.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'app.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'routes', 'health.routes.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'routes', 'metrics.routes.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'routes', 'meta.routes.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'ai-stream.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'utils', 'constants.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'services', 'request.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend-admin', 'src', 'services', 'request.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'components', 'common', 'PublicRoute.tsx'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'components', 'common', 'ProtectedRoute.tsx'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'store', 'authStore.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'routes', 'interview.routes.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'pages', 'Case', 'Create', 'index.tsx'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'pages', 'Profile', 'Pairing', 'index.tsx'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'pages', 'Interview', 'Chat', 'index.tsx'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'store', 'interviewStore.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'utils', 'validation.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'utils', 'versionInfo.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend-admin', 'src', 'utils', 'versionInfo.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'scripts', 'run-manual-regression-gate.mjs'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'scripts', 'check-critical-e2e-skips.mjs'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'package.json'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'package.json'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'tsconfig.app.json'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend-admin', 'tsconfig.app.json'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'tsconfig.json'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'mobile', 'tsconfig.json'), 'utf8'),
    fs.readFile(path.join(coreDocsRoot, '90-證據與盤點', '頁面HTML快照', 'manifest.json'), 'utf8'),
  ]);
  const latestManualRegression = await readLatestManualRegressionSummary();
  const rootPackageJson = JSON.parse(rootPackageJsonRaw);
  const frontendPackageJson = JSON.parse(frontendPackageJsonRaw);
  const frontendTsconfigText = frontendTsconfigRaw;
  const frontendAdminTsconfigText = frontendAdminTsconfigRaw;
  const backendTsconfigText = backendTsconfigRaw;
  const mobileTsconfigText = mobileTsconfigRaw;
  const shanghaiTodayYmd = getCurrentDateYmdInShanghai();

  const issues = [];

  const expectedPageStats = {
    '路由總數（含 redirect/兜底）': truth.frontend.stats.totalRoutes,
    'ProtectedRoute 路由': truth.frontend.stats.protectedRoutes,
    'PublicRoute 路由': truth.frontend.stats.publicRoutes,
    'Public 路由': truth.frontend.stats.unguardedRoutes,
  };

  for (const [label, expected] of Object.entries(expectedPageStats)) {
    const actual = parseStatValue(pageListDoc, label);
    if (actual !== expected) {
      issues.push(`[truth/pages] ${label} mismatch: docs=${actual ?? 'missing'} code=${expected}`);
    }
  }

  for (const route of truth.frontend.frontendPageRoutes) {
    if (!ensureRouteRow(pageListDoc, route)) {
      issues.push(
        `[truth/pages] route missing or guard drift in 頁面清單.md: ${route.fullPath} (${route.guardType})`
      );
    }
  }

  for (const route of truth.frontend.adminExternalRoutes) {
    if (!ensureAdminRouteRow(pageListDoc, route.fullPath)) {
      issues.push(`[truth/pages] external admin route missing in 頁面清單.md: ${route.fullPath}`);
    }
  }

  const documentedTotalMatch = apiMainDoc.match(/接口總數：`?([0-9]+)`?/);
  const documentedTotal = documentedTotalMatch ? Number(documentedTotalMatch[1]) : null;
  if (documentedTotal !== truth.backend.endpoints.length) {
    issues.push(
      `[truth/api] 接口總數 mismatch: docs=${documentedTotal ?? 'missing'} code=${truth.backend.endpoints.length}`
    );
  }

  const apiMainRegistrationSection =
    apiMainDoc.split('## 高風險回歸清單（接口視角）')[0] || apiMainDoc;
  const mappingMainSection =
    (mappingDoc.split('## 全量映射主表')[1] || mappingDoc).split('## 一 API 多場景（高風險回歸）')[0] ||
    mappingDoc;
  const apiMainStatusRows = parseApiMainStatusRows(apiMainRegistrationSection);
  const mappingStatusRows = parseMappingStatusRows(mappingMainSection);

  for (const duplicateKey of apiMainStatusRows.duplicateKeys) {
    issues.push(`[truth/api] duplicate endpoint row in 全接口清單-主文檔.md: ${duplicateKey}`);
  }
  for (const duplicateKey of mappingStatusRows.duplicateKeys) {
    issues.push(`[truth/mapping] duplicate endpoint row in 接口-功能-頁面-Mapping.md: ${duplicateKey}`);
  }
  for (const row of apiMainStatusRows.unknownStatuses) {
    issues.push(
      `[truth/api] unknown endpoint status in 全接口清單-主文檔.md: ${row.key} -> ${row.status || 'missing'}`
    );
  }
  for (const row of mappingStatusRows.unknownStatuses) {
    issues.push(
      `[truth/mapping] unknown endpoint status in 接口-功能-頁面-Mapping.md: ${row.key} -> ${row.status || 'missing'}`
    );
  }

  const backendEndpointKeys = new Set(
    truth.backend.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)
  );
  const allowedExpandedStreamKeys = new Set(
    GENERIC_STREAM_DOC_ENDPOINTS.map((endpointPath) => `GET ${endpointPath}`)
  );

  for (const endpointKey of apiMainStatusRows.rowsByKey.keys()) {
    if (!backendEndpointKeys.has(endpointKey) && !allowedExpandedStreamKeys.has(endpointKey)) {
      issues.push(`[truth/api] stale endpoint row found in 全接口清單-主文檔.md: ${endpointKey}`);
    }
  }
  for (const endpointKey of mappingStatusRows.rowsByKey.keys()) {
    if (!backendEndpointKeys.has(endpointKey) && !allowedExpandedStreamKeys.has(endpointKey)) {
      issues.push(`[truth/mapping] stale endpoint row found in 接口-功能-頁面-Mapping.md: ${endpointKey}`);
    }
  }

  const documentedStatusStats = {
    已使用: parseInlineCounterValue(apiMainDoc, '已使用'),
    候選廢棄: parseInlineCounterValue(apiMainDoc, '候選廢棄'),
    已確認廢棄: parseInlineCounterValue(apiMainDoc, '已確認廢棄'),
  };
  const resolvedApiStatusCounts = { 已使用: 0, 候選廢棄: 0, 已確認廢棄: 0 };
  const resolvedMappingStatusCounts = { 已使用: 0, 候選廢棄: 0, 已確認廢棄: 0 };

  for (const endpoint of truth.backend.endpoints) {
    const endpointKey = `${endpoint.method} ${endpoint.path}`;

    const apiStatus = resolveEndpointStatusFromRows(endpoint, apiMainStatusRows.rowsByKey);
    if (apiStatus === '__MIXED__') {
      issues.push(`[truth/api] mixed status rows found for ${endpointKey} in 全接口清單-主文檔.md`);
    } else if (!apiStatus) {
      issues.push(`[truth/api] endpoint status missing in 全接口清單-主文檔.md: ${endpointKey}`);
    } else {
      resolvedApiStatusCounts[apiStatus] += 1;
    }

    const mappingStatus = resolveEndpointStatusFromRows(endpoint, mappingStatusRows.rowsByKey);
    if (mappingStatus === '__MIXED__') {
      issues.push(`[truth/mapping] mixed status rows found for ${endpointKey} in 接口-功能-頁面-Mapping.md`);
    } else if (!mappingStatus) {
      issues.push(`[truth/mapping] endpoint status missing in 接口-功能-頁面-Mapping.md: ${endpointKey}`);
    } else {
      resolvedMappingStatusCounts[mappingStatus] += 1;
    }

    if (apiStatus && mappingStatus && apiStatus !== '__MIXED__' && mappingStatus !== '__MIXED__' && apiStatus !== mappingStatus) {
      issues.push(
        `[truth/api-mapping] endpoint status mismatch (${endpointKey}): api=${apiStatus} mapping=${mappingStatus}`
      );
    }

    if (endpoint.path !== '/api/v1/streams/:scopeType/:scopeId') {
      const apiRow = apiMainStatusRows.rowsByKey.get(endpointKey);
      if (apiRow) {
        if (endpoint.authMode === 'User' && !(apiRow.auth.includes('是') || apiRow.auth.includes('必須'))) {
          issues.push(
            `[truth/api] auth marker drift in 全接口清單-主文檔.md (${endpointKey}): docs=${apiRow.auth || 'missing'} expected~=是/必須`
          );
        }
        if (endpoint.authMode === 'Admin' && apiRow.auth.includes('否')) {
          issues.push(
            `[truth/api] auth marker drift in 全接口清單-主文檔.md (${endpointKey}): docs=${apiRow.auth || 'missing'} expected~=admin auth`
          );
        }
      }
    }

    if (endpoint.path === '/api/v1/streams/:scopeType/:scopeId') {
      const missingApiStreamRows = GENERIC_STREAM_DOC_ENDPOINTS.filter(
        (endpointPath) => !apiMainStatusRows.rowsByKey.has(`GET ${endpointPath}`)
      );
      const missingMappingStreamRows = GENERIC_STREAM_DOC_ENDPOINTS.filter(
        (endpointPath) => !mappingStatusRows.rowsByKey.has(`GET ${endpointPath}`)
      );
      if (missingApiStreamRows.length > 0) {
        issues.push(
          `[truth/api] generic stream endpoint must be expanded in 全接口清單-主文檔.md: ${missingApiStreamRows.join(', ')}`
        );
      }
      if (missingMappingStreamRows.length > 0) {
        issues.push(
          `[truth/mapping] generic stream endpoint must be expanded in 接口-功能-頁面-Mapping.md: ${missingMappingStreamRows.join(', ')}`
        );
      }
    }

    if (!ensureEndpointRow(apiMainDoc, endpoint)) {
      if (!isCoveredByGenericStreamDocs(endpoint.path, apiMainDoc)) {
        issues.push(`[truth/api] endpoint missing in 全接口清單-主文檔.md: ${endpoint.method} ${endpoint.path}`);
      }
    }

    if (!mappingDoc.includes(`\`${endpoint.method} ${endpoint.path}\``)) {
      if (isCoveredByGenericStreamDocs(endpoint.path, mappingDoc)) {
        continue;
      }
      issues.push(`[truth/mapping] endpoint missing in 接口-功能-頁面-Mapping.md: ${endpoint.method} ${endpoint.path}`);
    }

    if (!interfaceDocs.includes(endpoint.path)) {
      if (isCoveredByGenericStreamDocs(endpoint.path, interfaceDocs)) {
        continue;
      }
      issues.push(`[truth/interfaces] endpoint missing in 06-接口描述: ${endpoint.method} ${endpoint.path}`);
    }
  }

  for (const [status, documentedValue] of Object.entries(documentedStatusStats)) {
    if (documentedValue === null) {
      issues.push(`[truth/api] status summary missing in 全接口清單-主文檔.md: ${status}`);
      continue;
    }
    if (documentedValue !== resolvedApiStatusCounts[status]) {
      issues.push(
        `[truth/api] status summary mismatch (${status}): docs=${documentedValue} resolved=${resolvedApiStatusCounts[status]}`
      );
    }
  }

  for (const status of Object.keys(resolvedMappingStatusCounts)) {
    if (resolvedApiStatusCounts[status] !== resolvedMappingStatusCounts[status]) {
      issues.push(
        `[truth/api-mapping] status bucket mismatch (${status}): api=${resolvedApiStatusCounts[status]} mapping=${resolvedMappingStatusCounts[status]}`
      );
    }
  }

  const keyFlowPaths = [
    '/quick-experience/create',
    '/case/create',
    '/profile/index',
    '/chat/room',
    '/admin/login',
  ];
  const keyFlowApis = [
    'POST /sessions/quick',
    'POST /cases',
    'POST /interview/start',
    'POST /chat/rooms',
    'POST /admin/login',
  ];

  for (const value of keyFlowPaths) {
    if (!flowDoc.includes(value)) {
      issues.push(`[truth/flow] key route missing in 業務流程整合.md: ${value}`);
    }
  }
  for (const value of keyFlowApis) {
    if (!flowDoc.includes(value)) {
      issues.push(`[truth/flow] key api missing in 業務流程整合.md: ${value}`);
    }
  }

  const enumDocsToCheck = `${glossaryDoc}\n${flowDoc}\n${featureDoc}`;
  const requiredEnumValues = {
    PairingStatus: truth.prisma.enums.PairingStatus || [],
    CaseStatus: truth.prisma.enums.CaseStatus || [],
    InterviewStatus: truth.prisma.enums.InterviewStatus || [],
    ChatRoomStatus: truth.prisma.enums.ChatRoomStatus || [],
  };

  for (const [enumName, values] of Object.entries(requiredEnumValues)) {
    for (const value of values) {
      if (!enumDocsToCheck.includes(`\`${value}\``) && !enumDocsToCheck.includes(value)) {
        issues.push(`[truth/enums] ${enumName} value missing in flagship docs: ${value}`);
      }
    }
  }

  const readmeRequired = [
    'README.md',
    '功能特性清單.md',
    '頁面清單.md',
    '全接口清單-主文檔.md',
    '接口-功能-頁面-Mapping.md',
    '業務流程整合.md',
    '術語表.md',
  ];
  for (const item of readmeRequired) {
    if (!readmeDoc.includes(item)) {
      issues.push(`[truth/readme] root reference missing in README.md: ${item}`);
    }
  }

  const formalDocFiles = [...FORMAL_DOC_ROOT_FILES];
  for (const docsRoot of FORMAL_DOC_DOMAIN_DIRS) {
    const files = await collectFilesUnder(docsRoot, '.md');
    for (const fileName of files) {
      formalDocFiles.push(path.posix.join(docsRoot, fileName));
    }
  }
  const formalAuditLedgerDoc = await readDoc(FORMAL_DOC_AUDIT_LEDGER_PATH);
  const {
    statusByPath: formalLedgerStatusByPath,
    duplicatePaths: formalLedgerDuplicatePaths,
    rows: formalLedgerRows,
  } =
    parseAuditLedgerStatusRows(formalAuditLedgerDoc);
  const formalLedgerSummaryStats = parseAuditLedgerSummaryStats(formalAuditLedgerDoc);
  if (!formalLedgerSummaryStats) {
    issues.push(`[truth/formal-ledger] missing 摘要 section in ${FORMAL_DOC_AUDIT_LEDGER_PATH}`);
  } else {
    const expectedSummaryStats = new Map();
    expectedSummaryStats.set('文件總數', formalLedgerRows.length);
    for (const status of FORMAL_DOC_LEDGER_STATUS_KEYS) {
      expectedSummaryStats.set(
        `狀態：${status}`,
        formalLedgerRows.filter((row) => row.status === status).length
      );
    }
    for (const domain of FORMAL_DOC_LEDGER_DOMAIN_KEYS) {
      expectedSummaryStats.set(
        `子域：${domain}`,
        formalLedgerRows.filter((row) => row.domain === domain).length
      );
    }
    for (const [summaryKey, expectedValue] of expectedSummaryStats.entries()) {
      const actualValue = formalLedgerSummaryStats.get(summaryKey);
      if (typeof actualValue !== 'number') {
        issues.push(
          `[truth/formal-ledger] missing summary stat in ${FORMAL_DOC_AUDIT_LEDGER_PATH}: ${summaryKey}`
        );
        continue;
      }
      if (actualValue !== expectedValue) {
        issues.push(
          `[truth/formal-ledger] summary stat drift in ${FORMAL_DOC_AUDIT_LEDGER_PATH}: ${summaryKey} doc=${actualValue} calc=${expectedValue}`
        );
      }
    }
  }
  for (const duplicatePath of formalLedgerDuplicatePaths) {
    issues.push(
      `[truth/formal-ledger] duplicate formal-doc ledger row in ${FORMAL_DOC_AUDIT_LEDGER_PATH}: ${duplicatePath}`
    );
  }
  for (const formalDocPath of formalDocFiles) {
    const ledgerStatus = formalLedgerStatusByPath.get(formalDocPath);
    if (!ledgerStatus) {
      issues.push(
        `[truth/formal-ledger] missing formal-doc ledger row in ${FORMAL_DOC_AUDIT_LEDGER_PATH}: ${formalDocPath}`
      );
      continue;
    }
    if (!FORMAL_DOC_CLOSED_LEDGER_STATUSES.has(ledgerStatus)) {
      issues.push(
        `[truth/formal-ledger] formal-doc ledger status not closed for ${formalDocPath}: ${ledgerStatus}`
      );
    }
  }
  const allowlistHitKeys = new Set();
  const formalAuditCommitRefs = new Map();
  const formalAuditRows = [];
  for (const relativePath of formalDocFiles) {
    const docContent = await readDoc(relativePath);
    if (!docContent.includes('CORE_DOC_AUDIT_METADATA:START')) {
      issues.push(`[truth/formal-metadata] missing metadata header in ${relativePath}`);
    }
    if (!/\*\*文檔類型\*\*[：:]\s*\S+/.test(docContent)) {
      issues.push(`[truth/formal-metadata] missing 文檔類型 in ${relativePath}`);
    }
    if (/\*\*文檔類型\*\*[：:]\s*`?(?:未標註|待補|TBD)`?/i.test(docContent)) {
      issues.push(`[truth/formal-metadata] placeholder 文檔類型 found in ${relativePath}`);
    }
    if (!/\*\*覆蓋範圍\*\*[：:]\s*\S+/.test(docContent)) {
      issues.push(`[truth/formal-metadata] missing 覆蓋範圍 in ${relativePath}`);
    }
    if (/\*\*覆蓋範圍\*\*[：:]\s*`?(?:未標註|待補|TBD)`?/i.test(docContent)) {
      issues.push(`[truth/formal-metadata] placeholder 覆蓋範圍 found in ${relativePath}`);
    }
    if (!/\*\*取證代碼入口\*\*[：:]\s*\S+/.test(docContent)) {
      issues.push(`[truth/formal-metadata] missing 取證代碼入口 in ${relativePath}`);
    }
    if (/\*\*取證代碼入口\*\*[：:]\s*`?(?:未標註|待補|TBD)`?/i.test(docContent)) {
      issues.push(`[truth/formal-metadata] placeholder 取證代碼入口 found in ${relativePath}`);
    }
    const metadataEvidencePathRefs = extractFormalMetadataEvidencePathRefs(docContent);
    if (metadataEvidencePathRefs.length === 0) {
      issues.push(
        `[truth/formal-metadata] no backticked metadata evidence path refs in ${relativePath}`
      );
    }
    for (const pathRef of metadataEvidencePathRefs) {
      if (!isAllowedMetadataEvidencePath(pathRef)) {
        issues.push(
          `[truth/formal-metadata] metadata evidence path not allowed by policy in ${relativePath}: ${pathRef}`
        );
      }
    }
    if (
      metadataEvidencePathRefs.length > 0 &&
      !metadataEvidencePathRefs.some((pathRef) => isNonDocMetadataEvidencePath(pathRef))
    ) {
      issues.push(
        `[truth/formal-metadata] metadata evidence path refs must include at least one non-doc code path in ${relativePath}`
      );
    }
    const concreteMetadataEvidencePathRefs = metadataEvidencePathRefs.filter(
      (pathRef) => !isWildcardPathToken(pathRef)
    );
    if (metadataEvidencePathRefs.length > 0 && concreteMetadataEvidencePathRefs.length === 0) {
      issues.push(
        `[truth/formal-metadata] metadata evidence path refs must include concrete repo path in ${relativePath}`
      );
    }
    for (const evidencePathRef of concreteMetadataEvidencePathRefs) {
      const absEvidencePath = path.join(repoRoot, evidencePathRef);
      if (!(await pathExists(absEvidencePath))) {
        issues.push(
          `[truth/formal-metadata] metadata evidence path missing in repo (${relativePath}): ${evidencePathRef}`
        );
        continue;
      }
      if (!(await hasGitTrackedPath(evidencePathRef))) {
        if (!isScriptPathWiredInPackageScripts(evidencePathRef, rootPackageJson)) {
          issues.push(
            `[truth/formal-metadata] metadata evidence path is neither git-tracked nor package-script wired (${relativePath}): ${evidencePathRef}`
          );
        }
      }
    }
    const wildcardMetadataEvidencePathRefs = metadataEvidencePathRefs.filter((pathRef) =>
      isWildcardPathToken(pathRef)
    );
    for (const wildcardPathRef of wildcardMetadataEvidencePathRefs) {
      if (!(await hasGitPathspecMatch(wildcardPathRef))) {
        issues.push(
          `[truth/formal-metadata] metadata wildcard evidence path has no git match (${relativePath}): ${wildcardPathRef}`
        );
      }
    }
    const lastAuditedCommitMatch = docContent.match(/\*\*最後核驗 Commit\*\*[：:]\s*`([0-9a-f]{7,40})`/);
    if (!lastAuditedCommitMatch) {
      issues.push(`[truth/formal-metadata] missing or invalid 最後核驗 Commit in ${relativePath}`);
    } else {
      const commitRef = lastAuditedCommitMatch[1];
      if (!formalAuditCommitRefs.has(commitRef)) {
        formalAuditCommitRefs.set(commitRef, []);
      }
      formalAuditCommitRefs.get(commitRef).push(relativePath);
    }
    const lastAuditedDateMatch = docContent.match(/\*\*最後核驗日期\*\*[：:]\s*`([0-9]{4}-[0-9]{2}-[0-9]{2})`/);
    if (!lastAuditedDateMatch) {
      issues.push(`[truth/formal-metadata] missing or invalid 最後核驗日期 in ${relativePath}`);
    } else if (Number.isNaN(Date.parse(`${lastAuditedDateMatch[1]}T00:00:00Z`))) {
      issues.push(`[truth/formal-metadata] invalid 最後核驗日期 value in ${relativePath}`);
    } else if (lastAuditedCommitMatch) {
      const lastUpdatedMatch = docContent.match(/\*\*最後更新\*\*[：:]\s*`?([0-9]{4}-[0-9]{2}-[0-9]{2})`?/);
      if (lastUpdatedMatch) {
        const lastUpdatedDate = lastUpdatedMatch[1];
        if (Number.isNaN(Date.parse(`${lastUpdatedDate}T00:00:00Z`))) {
          issues.push(`[truth/formal-metadata] invalid 最後更新 value in ${relativePath}`);
        } else if (lastUpdatedDate !== lastAuditedDateMatch[1]) {
          issues.push(
            `[truth/formal-metadata] 最後更新與最後核驗日期不一致 in ${relativePath}: updated=${lastUpdatedDate}, audited=${lastAuditedDateMatch[1]}`
          );
        }
      }
      formalAuditRows.push({
        relativePath,
        commitRef: lastAuditedCommitMatch[1],
        auditedDate: lastAuditedDateMatch[1],
      });
    }
    if (docContent.includes('**SSOT 屬性**：非現行 SSOT')) {
      issues.push(`[truth/formal-metadata] formal doc marked as non-SSOT: ${relativePath}`);
    }

    const repoPathRefs = extractBacktickRepoPathRefs(docContent);
    if (repoPathRefs.length === 0) {
      issues.push(`[truth/formal-metadata] no repo-path evidence tokens found in ${relativePath}`);
    }
    const allowEntries = FORMAL_DOC_MISSING_PATH_ALLOWLIST[relativePath] || [];
    const allowMap = new Map(allowEntries.map((entry) => [entry.path, entry]));
    for (const repoPathRef of repoPathRefs) {
      const absPath = path.join(repoRoot, repoPathRef);
      if (await pathExists(absPath)) {
        continue;
      }
      const allowEntry = allowMap.get(repoPathRef);
      if (allowEntry) {
        const allowKey = `${relativePath}::${repoPathRef}`;
        allowlistHitKeys.add(allowKey);
        if (allowEntry.marker && !docContent.includes(allowEntry.marker)) {
          issues.push(
            `[truth/formal-path] allowlisted missing path marker drift in ${relativePath}: ${repoPathRef} (missing marker: ${allowEntry.marker})`
          );
        }
        continue;
      }
      issues.push(`[truth/formal-path] ${relativePath} references missing repo path: ${repoPathRef}`);
    }
  }
  for (const [docPath, entries] of Object.entries(FORMAL_DOC_MISSING_PATH_ALLOWLIST)) {
    for (const entry of entries) {
      const allowKey = `${docPath}::${entry.path}`;
      if (!allowlistHitKeys.has(allowKey)) {
        issues.push(`[truth/formal-path] stale allowlist entry (not found in doc): ${docPath} -> ${entry.path}`);
      }
    }
  }
  const commitDateByRef = new Map();
  for (const [commitRef, docPaths] of formalAuditCommitRefs.entries()) {
    if (!(await isResolvableGitCommit(commitRef))) {
      issues.push(
        `[truth/formal-metadata] unresolvable 最後核驗 Commit ${commitRef} in docs: ${docPaths.join(', ')}`
      );
      continue;
    }
    if (!(await isCommitAncestorOfHead(commitRef))) {
      issues.push(
        `[truth/formal-metadata] audited commit not reachable from HEAD ${commitRef} in docs: ${docPaths.join(', ')}`
      );
    }
    const commitDateYmd = await readGitCommitDateYmd(commitRef);
    if (!commitDateYmd) {
      issues.push(
        `[truth/formal-metadata] cannot resolve commit date for ${commitRef} in docs: ${docPaths.join(', ')}`
      );
      continue;
    }
    commitDateByRef.set(commitRef, commitDateYmd);
  }
  for (const { relativePath, commitRef, auditedDate } of formalAuditRows) {
    const commitDateYmd = commitDateByRef.get(commitRef);
    if (auditedDate > shanghaiTodayYmd) {
      issues.push(
        `[truth/formal-metadata] 最後核驗日期晚於今日 in ${relativePath}: audited=${auditedDate}, today=${shanghaiTodayYmd}`
      );
    }
    if (!commitDateYmd) {
      continue;
    }
    if (auditedDate < commitDateYmd) {
      issues.push(
        `[truth/formal-metadata] 最後核驗日期早於commit日期 in ${relativePath}: audited=${auditedDate}, commit=${commitRef}, commit_date=${commitDateYmd}`
      );
    }
  }

  const flagshipDocs = [
    ['README.md', readmeDoc],
    ['功能特性清單.md', featureDoc],
    ['頁面清單.md', pageListDoc],
    ['全接口清單-主文檔.md', apiMainDoc],
    ['接口-功能-頁面-Mapping.md', mappingDoc],
    ['業務流程整合.md', flowDoc],
    ['術語表.md', glossaryDoc],
  ];
  for (const [docName, docContent] of flagshipDocs) {
    for (const testPathRef of extractBacktickTestPathRefs(docContent)) {
      const absTestPath = path.join(repoRoot, testPathRef);
      if (!(await pathExists(absTestPath))) {
        issues.push(`[truth/batch1-flagship] ${docName} references missing test file: ${testPathRef}`);
      }
    }
    for (const scriptPathRef of extractBacktickScriptPathRefs(docContent)) {
      const absScriptPath = path.join(repoRoot, scriptPathRef);
      if (!(await pathExists(absScriptPath))) {
        issues.push(`[truth/batch1-flagship] ${docName} references missing script file: ${scriptPathRef}`);
      }
    }
  }

  const interfaceDocFiles = await collectFilesUnder('06-接口描述', '.md');
  for (const fileName of interfaceDocFiles) {
    const docPath = path.posix.join('06-接口描述', fileName);
    const docContent = await readDoc(docPath);
    for (const testPathRef of extractBacktickTestPathRefs(docContent)) {
      const absTestPath = path.join(repoRoot, testPathRef);
      if (!(await pathExists(absTestPath))) {
        issues.push(`[truth/batch4-interface] ${docPath} references missing test file: ${testPathRef}`);
      }
    }
    for (const scriptPathRef of extractBacktickScriptPathRefs(docContent)) {
      const absScriptPath = path.join(repoRoot, scriptPathRef);
      if (!(await pathExists(absScriptPath))) {
        issues.push(`[truth/batch4-interface] ${docPath} references missing script file: ${scriptPathRef}`);
      }
    }
  }

  const batch23DocRoots = [
    '01-認證與會話',
    '02-用戶端核心流程',
    '03-管理端與平台治理',
    '04-共用機制',
    '05-工程架構與共享層',
  ];
  for (const docsRoot of batch23DocRoots) {
    const docsUnderRoot = await collectFilesUnder(docsRoot, '.md');
    for (const fileName of docsUnderRoot) {
      const docPath = path.posix.join(docsRoot, fileName);
      const docContent = await readDoc(docPath);
      for (const testPathRef of extractBacktickTestPathRefs(docContent)) {
        const absTestPath = path.join(repoRoot, testPathRef);
        if (!(await pathExists(absTestPath))) {
          issues.push(`[truth/batch2-3] ${docPath} references missing test file: ${testPathRef}`);
        }
      }
      for (const scriptPathRef of extractBacktickScriptPathRefs(docContent)) {
        const absScriptPath = path.join(repoRoot, scriptPathRef);
        if (!(await pathExists(absScriptPath))) {
          issues.push(`[truth/batch2-3] ${docPath} references missing script file: ${scriptPathRef}`);
        }
      }
    }
  }

  const hasModeSplitInCode = caseServiceCode.includes(
    'case_.mode === CASE_MODE.COLLABORATIVE && Boolean(case_.session_id)'
  );
  if (hasModeSplitInCode) {
    const modeSplitExpectations = [
      ['全接口清單-主文檔.md', apiMainDoc],
      ['06-接口描述/03-case.md', caseInterfaceDoc],
      ['06-接口描述/04-judgment.md', judgmentInterfaceDoc],
      ['01-認證與會話/00-認證與會話總覽.md', authOverviewDoc],
      ['功能特性清單.md', featureDoc],
      ['接口-功能-頁面-Mapping.md', mappingDoc],
      ['業務流程整合.md', flowDoc],
    ];

    for (const [docName, docContent] of modeSplitExpectations) {
      if (!docContent.includes('collaborative(session_id=null)')) {
        issues.push(
          `[truth/auth] mode-split marker missing in ${docName}: collaborative(session_id=null)`
        );
      }
    }
  }

  if (
    publicRouteCode.includes("redirectTo = '/case/list'") &&
    publicRouteCode.includes('rawFrom === \'/\'') &&
    [
      "'/case'",
      "'/judgment'",
      "'/reconciliation'",
      "'/execution'",
      "'/profile'",
      "'/interview'",
      "'/quick-experience'",
      "'/chat'",
    ].every((token) => publicRouteCode.includes(token))
  ) {
    const authOverviewRouteTokens = [
      '`/auth/*`',
      '`PublicRoute`',
      'location.state.from.pathname',
      '`/case`',
      '`/judgment`',
      '`/reconciliation`',
      '`/execution`',
      '`/profile`',
      '`/interview`',
      '`/quick-experience`',
      '`/chat`',
      '`/case/list`',
    ];
    for (const token of authOverviewRouteTokens) {
      if (!authOverviewDoc.includes(token)) {
        issues.push(
          `[truth/batch2-auth] 01-認證與會話/00-認證與會話總覽.md missing PublicRoute redirect token: ${token}`
        );
      }
    }
  }

  if (
    protectedRouteCode.includes("redirectTo = '/auth/login'") &&
    protectedRouteCode.includes('if (!_hasHydrated && timedOut)')
  ) {
    const protectedRouteTokens = ['`/auth/login`', '`ProtectedRoute`', 'hydration 逾時'];
    for (const token of protectedRouteTokens) {
      if (!authOverviewDoc.includes(token)) {
        issues.push(
          `[truth/batch2-auth] 01-認證與會話/00-認證與會話總覽.md missing ProtectedRoute token: ${token}`
        );
      }
    }
  }

  if (
    sessionServiceCode.includes('pairing_id: currentSession.pairing_id') &&
    sessionServiceCode.includes('case_id: currentSession.case_id') &&
    sessionServiceCode.includes('session_data: currentSession.session_data') &&
    sessionServiceCode.includes('tx.case.updateMany') &&
    sessionServiceCode.includes('tx.pairing.updateMany')
  ) {
    const authSessionTokens = ['新建 -> 遷移 `case_id/pairing_id/session_data` -> 刪舊', 'caseSessionMap'];
    for (const token of authSessionTokens) {
      if (!authSessionInterfaceDoc.includes(token)) {
        issues.push(
          `[truth/batch2-auth] 06-接口描述/01-auth-session.md missing session-rotation token: ${token}`
        );
      }
    }
    const authOverviewTokens = ['原子旋轉 session', '`case_id`、`pairing_id` 與 `session_data`'];
    for (const token of authOverviewTokens) {
      if (!authOverviewDoc.includes(token)) {
        issues.push(
          `[truth/batch2-auth] 01-認證與會話/00-認證與會話總覽.md missing session-rotation token: ${token}`
        );
      }
    }
  }

  if (
    authStoreCode.includes('claimSession(quickSessionId).catch') &&
    authStoreCode.includes('Failed to claim quick session on login') &&
    authStoreCode.includes('Failed to claim quick session')
  ) {
    if (!authOverviewDoc.includes('失敗可告警，但不得反向宣告 auth 主流程失敗')) {
      issues.push(
        '[truth/batch2-auth] 01-認證與會話/00-認證與會話總覽.md must keep claim-session weak-dependency rule'
      );
    }
    if (!authSessionInterfaceDoc.includes('弱依賴')) {
      issues.push(
        '[truth/batch2-auth] 06-接口描述/01-auth-session.md must mark claim-session as weak dependency'
      );
    }
  }

  if (
    caseServiceCode.includes("phase: 'a_done'") &&
    caseServiceCode.includes("phase: 'submitted'") &&
    caseServiceCode.includes("ValidationUtils.validateStatement(data.plaintiff_statement, '角色A陳述', 30)") &&
    caseServiceCode.includes("ValidationUtils.validateStatement(data.defendant_statement!, '角色B陳述', 10)")
  ) {
    const collaborativeTokens = [
      '/quick-experience/collaborative',
      'phase = a_done + session_id',
      'phase = a_done -> submitted',
      '`case_id + X-Session-Id`',
    ];
    for (const token of collaborativeTokens) {
      if (!authFlowOverviewDoc.includes(token)) {
        issues.push(
          `[truth/batch2-flow] 02-用戶端核心流程/00-用戶端核心流程總覽.md missing collaborative-phase token: ${token}`
        );
      }
    }
  }

  if (
    caseCreatePageCode.includes("pairingStatus === 'active'") &&
    caseCreatePageCode.includes("navigate('/profile/pairing')")
  ) {
    const pairingGateTokens = ['pairing gate', '`/profile/pairing`', '`/case/create`'];
    for (const token of pairingGateTokens) {
      if (!authFlowOverviewDoc.includes(token)) {
        issues.push(
          `[truth/batch2-flow] 02-用戶端核心流程/00-用戶端核心流程總覽.md missing pairing-gate token: ${token}`
        );
      }
    }
  }

  if (
    caseCreatePageCode.includes("useInterviewTrigger('pre_case')") &&
    caseCreatePageCode.includes('richness < PRE_CASE_RICHNESS_THRESHOLD')
  ) {
    const preCaseTokens = ['`pre_case`', 'richness', '訪談建議'];
    for (const token of preCaseTokens) {
      if (!authFlowOverviewDoc.includes(token)) {
        issues.push(
          `[truth/batch2-flow] 02-用戶端核心流程/00-用戶端核心流程總覽.md missing pre-case interview token: ${token}`
        );
      }
    }
  }

  if (
    profilePairingPageCode.includes('const resumeData = await checkResume()') &&
    profilePairingPageCode.includes("const session = await startSession('onboarding')")
  ) {
    const onboardingTokens = ['onboarding', '`GET /api/v1/interview/resume`'];
    for (const token of onboardingTokens) {
      if (!authFlowOverviewDoc.includes(token)) {
        issues.push(
          `[truth/batch2-flow] 02-用戶端核心流程/00-用戶端核心流程總覽.md missing onboarding interview token: ${token}`
        );
      }
    }
  }

  if (
    interviewRoutesCode.includes('interviewController.startSession.bind') &&
    interviewRoutesCode.includes('interviewController.respond.bind') &&
    interviewRoutesCode.includes('interviewController.skip.bind') &&
    interviewRoutesCode.includes('interviewController.endSession.bind') &&
    interviewRoutesCode.includes('interviewController.cancel.bind') &&
    interviewRoutesCode.includes('interviewController.retryFailed.bind') &&
    interviewRoutesCode.includes('interviewController.checkResume.bind') &&
    interviewRoutesCode.includes('requireConsent')
  ) {
    if (!authFlowOverviewDoc.includes('start / respond / skip / end / cancel / retry / resume')) {
      issues.push(
        '[truth/batch2-flow] 02-用戶端核心流程/00-用戶端核心流程總覽.md must keep full interview action set under consent gate'
      );
    }
    if (!authFlowOverviewDoc.includes('全部要求登入且通過 consent gate')) {
      issues.push(
        '[truth/batch2-flow] 02-用戶端核心流程/00-用戶端核心流程總覽.md must keep interview login+consent gate statement'
      );
    }
    if (!interviewInterfaceDoc.includes('authenticate + requireConsent')) {
      issues.push(
        '[truth/batch2-flow] 06-接口描述/06-interview-psych-profile.md must keep authenticate + requireConsent marker'
      );
    }
  }

  if (chatServiceCode.includes('接受邀請需要登入帳號')) {
    if (
      !authOverviewDoc.includes('/api/v1/chat/invites/:inviteCode/accept') ||
      !authOverviewDoc.includes('已登入帳號')
    ) {
      issues.push(
        '[truth/batch2-auth] 01-認證與會話/00-認證與會話總覽.md must keep chat invite accept user-only marker'
      );
    }
  }

  const notificationsRoute = truth.frontend.frontendPageRoutes.find(
    (route) => route.fullPath === '/notifications'
  );
  if (notificationsRoute?.guardType === 'ProtectedRoute') {
    if (!authFlowOverviewDoc.includes('/notifications') || !authFlowOverviewDoc.includes('受保護前台路由')) {
      issues.push(
        '[truth/batch2-flow] 02-用戶端核心流程/00-用戶端核心流程總覽.md must keep notifications protected-route marker'
      );
    }
  }

  const rootWorkspaces = Array.isArray(rootPackageJson.workspaces)
    ? rootPackageJson.workspaces
    : [];
  if (
    rootWorkspaces.length === 2 &&
    rootWorkspaces.includes('frontend') &&
    rootWorkspaces.includes('frontend-admin')
  ) {
    const workspaceTokens = [
      ['05-工程架構與共享層/00-工程架構與共享層總覽.md', architectureOverviewDoc, 'root npm workspaces 目前只有 `frontend/` 與 `frontend-admin/`'],
      ['05-工程架構與共享層/01-本地開發與工作區基線.md', workspaceBaselineDoc, 'root workspace'],
      ['05-工程架構與共享層/Repo平台分層與共享規範.md', repoLayerSpecDoc, '不進 root workspace'],
    ];
    for (const [docName, docContent, token] of workspaceTokens) {
      if (!docContent.includes(token)) {
        issues.push(`[truth/batch3-architecture] ${docName} missing workspace-contract token: ${token}`);
      }
    }
  }

  const frontendHasContractsAlias =
    /"@cj\/contracts"\s*:/.test(frontendTsconfigText) &&
    /"@cj\/api-client"\s*:/.test(frontendTsconfigText);
  if (frontendHasContractsAlias) {
    const frontendAliasTokens = [
      ['05-工程架構與共享層/00-工程架構與共享層總覽.md', architectureOverviewDoc, '`frontend/` 已用 tsconfig alias 接入 `@cj/contracts`'],
      ['05-工程架構與共享層/Repo平台分層與共享規範.md', repoLayerSpecDoc, '`frontend/tsconfig.app.json` 已接上 `@cj/contracts` 與 `@cj/api-client` alias'],
    ];
    for (const [docName, docContent, token] of frontendAliasTokens) {
      if (!docContent.includes(token)) {
        issues.push(`[truth/batch3-architecture] ${docName} missing frontend-alias token: ${token}`);
      }
    }
  }

  const frontendAdminHasOnlyLocalAlias =
    /"@\/\*"\s*:/.test(frontendAdminTsconfigText) &&
    !/"@cj\/contracts"\s*:/.test(frontendAdminTsconfigText) &&
    !/"@cj\/api-client"\s*:/.test(frontendAdminTsconfigText);
  if (frontendAdminHasOnlyLocalAlias) {
    const adminAliasTokens = [
      ['05-工程架構與共享層/00-工程架構與共享層總覽.md', architectureOverviewDoc, '`frontend-admin/` 目前只有 `@/*` alias，尚未接入 `@cj/contracts` 或 `@cj/api-client`'],
      ['05-工程架構與共享層/Repo平台分層與共享規範.md', repoLayerSpecDoc, '`frontend-admin/` 尚未接入 `@cj/contracts` / `@cj/api-client` alias'],
    ];
    for (const [docName, docContent, token] of adminAliasTokens) {
      if (!docContent.includes(token)) {
        issues.push(`[truth/batch3-architecture] ${docName} missing frontend-admin alias token: ${token}`);
      }
    }
  }

  const backendAndMobileHaveAlias =
    /"@cj\/contracts"\s*:/.test(backendTsconfigText) &&
    /"@cj\/contracts"\s*:/.test(mobileTsconfigText) &&
    /"@cj\/api-client"\s*:/.test(backendTsconfigText) &&
    /"@cj\/api-client"\s*:/.test(mobileTsconfigText);
  if (backendAndMobileHaveAlias) {
    const reservedAliasTokens = [
      ['05-工程架構與共享層/00-工程架構與共享層總覽.md', architectureOverviewDoc, '`backend/` 與 `mobile/` 只完成 alias 預留'],
      ['05-工程架構與共享層/Repo平台分層與共享規範.md', repoLayerSpecDoc, '`backend/tsconfig.json` 與 `mobile/tsconfig.json` 已預留共享 package alias'],
    ];
    for (const [docName, docContent, token] of reservedAliasTokens) {
      if (!docContent.includes(token)) {
        issues.push(`[truth/batch3-architecture] ${docName} missing reserved-alias token: ${token}`);
      }
    }
  }

  if (requestServiceCode.includes('axios.create(') && adminRequestServiceCode.includes('axios.create(')) {
    const requestStackTokens = ['`frontend/src/services/request.ts`', '`frontend-admin/src/services/request.ts`', '兩條正式請求堆棧'];
    for (const token of requestStackTokens) {
      if (!commonMechanismDoc.includes(token)) {
        issues.push(`[truth/batch3-common] 04-共用機制/00-共用機制總覽.md missing request-stack token: ${token}`);
      }
    }
  }

  const hasAdminRedirectRoute = truth.frontend.frontendPageRoutes.some(
    (route) => route.fullPath === '/admin/*'
  );
  if (
    hasAdminRedirectRoute &&
    adminEntryCode.includes('VITE_ADMIN_LOGIN_URL') &&
    adminEntryCode.includes('normalizeAbsoluteUrl') &&
    adminEntryCode.includes("parsed.protocol !== 'http:'") &&
    adminEntryCode.includes("parsed.protocol !== 'https:'")
  ) {
    const adminBoundaryTokens = [
      ['03-管理端與平台治理/00-管理端與平台治理總覽.md', adminGovernanceOverviewDoc, '`admin/*`'],
      ['03-管理端與平台治理/00-管理端與平台治理總覽.md', adminGovernanceOverviewDoc, '`AdminRedirect`'],
      ['03-管理端與平台治理/00-管理端與平台治理總覽.md', adminGovernanceOverviewDoc, '`VITE_ADMIN_LOGIN_URL`'],
      ['03-管理端與平台治理/00-管理端與平台治理總覽.md', adminGovernanceOverviewDoc, '絕對'],
      ['04-共用機制/00-共用機制總覽.md', commonMechanismDoc, '`AdminRedirect`'],
    ];
    for (const [docName, docContent, token] of adminBoundaryTokens) {
      if (!docContent.includes(token)) {
        issues.push(`[truth/batch3-admin] ${docName} missing admin-redirect boundary token: ${token}`);
      }
    }
  }

  const adminPermissionTokens = [
    'ops:read',
    'ops:execute',
    'config:read',
    'config:write',
    'users:read',
    'users:write',
    'reports:read',
    'alerts:write',
    'admin:all',
  ];
  if (adminPermissionTokens.every((token) => adminAuthCode.includes(`'${token}'`))) {
    for (const token of adminPermissionTokens) {
      if (!adminGovernanceOverviewDoc.includes(`\`${token}\``)) {
        issues.push(
          `[truth/batch3-admin] 03-管理端與平台治理/00-管理端與平台治理總覽.md missing RBAC permission token: ${token}`
        );
      }
    }
  }

  if (
    adminRoutesCode.includes("requireAdminPermissionAll('users:read', 'ops:read')") &&
    adminRoutesCode.includes("requireAdminPermissionAll('alerts:write', 'ops:execute')")
  ) {
    const permissionMatrixTokens = [
      '`/admin/audit-logs*` 需同時具備 `users:read` 與 `ops:read`',
      '`/admin/alerts/rules` 需同時具備 `alerts:write` 與 `ops:execute`',
    ];
    for (const token of permissionMatrixTokens) {
      if (!adminGovernanceOverviewDoc.includes(token)) {
        issues.push(
          `[truth/batch3-admin] 03-管理端與平台治理/00-管理端與平台治理總覽.md missing RBAC matrix token: ${token}`
        );
      }
    }
  }

  if (validationCode.includes("mode: Joi.string().valid('remote', 'collaborative')")) {
    if (!featureDoc.includes('mode=remote|collaborative')) {
      issues.push(
        '[truth/feature] 功能特性清單.md missing formal case mode contract: mode=remote|collaborative'
      );
    }
  }

  if (chatServiceCode.includes('接受邀請需要登入帳號')) {
    const apiAcceptRow = findEndpointRow(
      apiMainDoc,
      'POST',
      '/api/v1/chat/invites/:inviteCode/accept'
    );
    if (!apiAcceptRow) {
      issues.push(
        '[truth/chat] chat invite accept row missing in 全接口清單-主文檔.md: POST /api/v1/chat/invites/:inviteCode/accept'
      );
    } else {
      if (!apiAcceptRow.includes('| User')) {
        issues.push(
          '[truth/chat] chat invite accept must be documented as User endpoint in 全接口清單-主文檔.md'
        );
      }
      if (!apiAcceptRow.includes('必須')) {
        issues.push(
          '[truth/chat] chat invite accept auth requirement missing (`必須`) in 全接口清單-主文檔.md'
        );
      }
    }

    const mappingAcceptRow =
      mappingDoc
        .split('\n')
        .find((line) => line.includes('`POST /api/v1/chat/invites/:inviteCode/accept`')) || null;
    if (!mappingAcceptRow || !mappingAcceptRow.includes('User only')) {
      issues.push(
        '[truth/chat] 接口-功能-頁面-Mapping.md must mark POST /api/v1/chat/invites/:inviteCode/accept as User only'
      );
    }

    const chatAcceptRow =
      chatInterfaceDoc
        .split('\n')
        .find((line) => line.includes('`POST /api/v1/chat/invites/:inviteCode/accept`')) || null;
    if (!chatAcceptRow || !chatAcceptRow.includes('UNAUTHORIZED')) {
      issues.push(
        '[truth/chat] 06-接口描述/07-chat.md must include UNAUTHORIZED for POST /api/v1/chat/invites/:inviteCode/accept'
      );
    }
  }

  if (chatServiceCode.includes('需登入才能離開聊天室')) {
    const chatLeaveRow =
      chatInterfaceDoc
        .split('\n')
        .find((line) => line.includes('`POST /api/v1/chat/rooms/:roomId/leave`')) || null;
    if (!chatLeaveRow || !chatLeaveRow.includes('UNAUTHORIZED')) {
      issues.push(
        '[truth/chat] 06-接口描述/07-chat.md must include UNAUTHORIZED for POST /api/v1/chat/rooms/:roomId/leave'
      );
    }
  }

  if (chatServiceCode.includes("throw Errors.FORBIDDEN('你沒有該聊天室權限')")) {
    const chatGetRoomRow =
      chatInterfaceDoc
        .split('\n')
        .find((line) => line.includes('`GET /api/v1/chat/rooms/:roomId` |')) || null;
    if (!chatGetRoomRow || !chatGetRoomRow.includes('FORBIDDEN') || chatGetRoomRow.includes('NOT_FOUND')) {
      issues.push(
        '[truth/chat] 06-接口描述/07-chat.md GET /api/v1/chat/rooms/:roomId row must use FORBIDDEN-only access semantics (no NOT_FOUND)'
      );
    }
  }

  if (
    chatServiceCode.includes('includedMessageIds') &&
    chatServiceCode.includes("message_type: 'user_text'") &&
    chatServiceCode.includes('visibility_scope: ChatVisibilityScope.all') &&
    chatServiceCode.includes('Errors.NOT_FOUND')
  ) {
    const chatRequestJudgmentContractRow =
      apiMainDoc
        .split('\n')
        .find(
          (line) =>
            line.includes('`POST /api/v1/chat/rooms/:roomId/request-judgment`') &&
            line.includes('`included_message_ids?`')
        ) || null;
    if (
      !chatRequestJudgmentContractRow ||
      !chatRequestJudgmentContractRow.includes('NOT_FOUND') ||
      !chatRequestJudgmentContractRow.includes('AI_SERVICE_ERROR')
    ) {
      issues.push(
        '[truth/chat] 全接口清單-主文檔.md compact contract row for request-judgment must include NOT_FOUND and AI_SERVICE_ERROR'
      );
    }

    const chatRequestJudgmentErrorMatrixRow =
      apiMainDoc
        .split('\n')
        .find(
          (line) =>
            line.includes('`POST /api/v1/chat/rooms/:roomId/request-judgment`') &&
            line.includes('錯誤碼覆蓋矩陣')
        ) || null;
    if (
      !chatRequestJudgmentErrorMatrixRow ||
      !chatRequestJudgmentErrorMatrixRow.includes('NOT_FOUND') ||
      !chatRequestJudgmentErrorMatrixRow.includes('AI_SERVICE_ERROR')
    ) {
      issues.push(
        '[truth/chat] 全接口清單-主文檔.md high-risk error matrix row for request-judgment must include NOT_FOUND and AI_SERVICE_ERROR'
      );
    }

    const chatRequestJudgmentRiskRow =
      apiMainDoc
        .split('\n')
        .find(
          (line) =>
            line.includes('/chat/rooms/:roomId/request-judgment') &&
            line.includes('聊天轉判決冪等')
        ) || null;
    if (
      !chatRequestJudgmentRiskRow ||
      !chatRequestJudgmentRiskRow.includes('included_message_ids') ||
      !chatRequestJudgmentRiskRow.includes('user_text')
    ) {
      issues.push(
        '[truth/chat] 全接口清單-主文檔.md risk row for request-judgment must keep included_message_ids user_text whitelist semantics'
      );
    }
  }

  if (!interviewStoreCode.includes('cancelledDraft')) {
    const cancelledDraftMentions = [
      ['06-接口描述/06-interview-psych-profile.md', interviewInterfaceDoc],
      ['功能特性清單.md', featureDoc],
    ];
    for (const [docName, docContent] of cancelledDraftMentions) {
      const staleLines = docContent
        .split('\n')
        .filter(
          (line) =>
            line.includes('cancelled draft') &&
            !line.includes('不再') &&
            !line.includes('不顯示') &&
            !line.includes('不渲染')
        );
      if (staleLines.length > 0) {
        issues.push(
          `[truth/interview] ${docName} still claims visible cancelled draft, but interviewStore no longer keeps cancelledDraft state`
        );
      }
    }
  }

  if (interviewServiceCode.includes('loadValidatedTurnContext')) {
    if (!interviewInterfaceDoc.includes('前置錯誤現在會在提交當下同步返回')) {
      issues.push(
        '[truth/interview] 06-接口描述/06-interview-psych-profile.md must document submit pre-validation sync error semantics'
      );
    }
  }

  if (
    interviewChatPageCode.includes('const intervalMs = 2500') &&
    interviewChatPageCode.includes('const maxAttempts = 24') &&
    interviewChatPageCode.includes('canonicalSyncLockRef.current') &&
    interviewChatPageCode.includes('syncSessionSilently(sessionId)')
  ) {
    const interviewCanonicalTokens = ['2500ms', '`24`', '有界 canonical 自愈輪詢', 'lock'];
    for (const token of interviewCanonicalTokens) {
      if (!interviewInterfaceDoc.includes(token)) {
        issues.push(
          `[truth/interview] 06-接口描述/06-interview-psych-profile.md missing canonical self-heal polling token: ${token}`
        );
      }
    }

    const featureInterviewCanonicalTokens = ['2500ms', '`24`', '有界 canonical 自愈輪詢'];
    for (const token of featureInterviewCanonicalTokens) {
      if (!featureDoc.includes(token)) {
        issues.push(
          `[truth/interview] 功能特性清單.md missing Interview canonical self-heal token: ${token}`
        );
      }
    }
  }

  if (
    chatServiceCode.includes("message_type: 'user_text'") &&
    chatServiceCode.includes('includedMessageIds') &&
    chatServiceCode.includes('Errors.NOT_FOUND') &&
    chatServiceCode.includes('visibility_scope: ChatVisibilityScope.all')
  ) {
    const chatIncludedMessageTokens = ['included_message_ids', 'message_type=user_text', 'visibility_scope=all', 'NOT_FOUND'];
    for (const token of chatIncludedMessageTokens) {
      if (!chatInterfaceDoc.includes(token)) {
        issues.push(
          `[truth/chat] 06-接口描述/07-chat.md missing included_message_ids whitelist token: ${token}`
        );
      }
    }

    const featureChatWhitelistTokens = [
      'included_message_ids',
      'user_text',
      'visibility_scope=all',
      'NOT_FOUND',
      'AI_SERVICE_ERROR',
    ];
    for (const token of featureChatWhitelistTokens) {
      if (!featureDoc.includes(token)) {
        issues.push(
          `[truth/chat] 功能特性清單.md missing request-judgment whitelist token: ${token}`
        );
      }
    }

    const flowChatWhitelistTokens = ['included_message_ids', 'NOT_FOUND', 'AI_SERVICE_ERROR'];
    for (const token of flowChatWhitelistTokens) {
      if (!flowDoc.includes(token)) {
        issues.push(
          `[truth/chat] 業務流程整合.md missing P04 request-judgment failure/whitelist token: ${token}`
        );
      }
    }

    const mappingChatWhitelistTokens = [
      'included_message_ids',
      'user_text',
      'visibility_scope=all',
      'NOT_FOUND',
    ];
    for (const token of mappingChatWhitelistTokens) {
      if (!mappingDoc.includes(token)) {
        issues.push(
          `[truth/chat] 接口-功能-頁面-Mapping.md missing request-judgment mapping token: ${token}`
        );
      }
    }
  }

  if (requestServiceCode.includes('instanceof FormData') && requestServiceCode.includes('Content-Type')) {
    if (
      !profilePairingInterfaceDoc.includes('FormData') ||
      !profilePairingInterfaceDoc.includes('Content-Type') ||
      !profilePairingInterfaceDoc.includes('boundary')
    ) {
      issues.push(
        '[truth/upload] 06-接口描述/02-user-profile-pairing.md must document FormData Content-Type boundary handling for avatar upload'
      );
    }
  }

  if (backendAppCode.includes("'PATCH'")) {
    if (!envBaselineDoc.includes('PATCH') || !envBaselineDoc.includes('CORS')) {
      issues.push(
        '[truth/env] 03-管理端與平台治理/01-環境與部署基線.md must document CORS PATCH method support'
      );
    }
  }

  if (backendEnvCode.includes('LOCAL_DEV_ORIGINS_DEFAULT') && backendEnvCode.includes('mergeAllowedOrigins')) {
    if (!envBaselineDoc.includes('4173-4175') || !envBaselineDoc.includes('5173-5175')) {
      issues.push(
        '[truth/env] 03-管理端與平台治理/01-環境與部署基線.md must document development ALLOWED_ORIGINS local-port merge baseline'
      );
    }
  }

  if (constantsCode.includes('OPENAI_REQUEST: 90000')) {
    if (!commonMechanismDoc.includes('OPENAI_REQUEST=90000ms')) {
      issues.push(
        '[truth/ai] 04-共用機制/00-共用機制總覽.md missing OPENAI_REQUEST=90000ms runtime budget'
      );
    }
  }

  if (constantsCode.includes('JUDGMENT_GENERATION: 180000')) {
    if (!commonMechanismDoc.includes('JUDGMENT_GENERATION=180000ms')) {
      issues.push(
        '[truth/ai] 04-共用機制/00-共用機制總覽.md missing JUDGMENT_GENERATION=180000ms runtime budget'
      );
    }
  }

  if (constantsCode.includes('JUDGMENT_GENERATION: 300')) {
    if (!commonMechanismDoc.includes('LOCK_TTL.JUDGMENT_GENERATION=300s')) {
      issues.push(
        '[truth/ai] 04-共用機制/00-共用機制總覽.md missing LOCK_TTL.JUDGMENT_GENERATION=300s runtime budget'
      );
    }
  }

  if (authServiceCode.includes('if (!user.email_verified)') && authServiceCode.includes('if (!user.is_active)')) {
    const loginRow = findEndpointRow(authSessionInterfaceDoc, 'POST', '/api/v1/auth/login');
    if (!loginRow || !loginRow.includes('UNAUTHORIZED')) {
      issues.push(
        '[truth/auth] 06-接口描述/01-auth-session.md must include UNAUTHORIZED for POST /api/v1/auth/login (inactive/unverified account)'
      );
    }
  }

  if (authServiceCode.includes('if (!user) {') && authServiceCode.includes('return;')) {
    if (
      !authSessionInterfaceDoc.includes('不存在帳號時仍回成功') &&
      !authSessionInterfaceDoc.includes('不暴露用戶是否存在')
    ) {
      issues.push(
        '[truth/auth] 06-接口描述/01-auth-session.md must document reset-password anti-enumeration semantics (non-existent account still success)'
      );
    }
  }

  if (sessionControllerCode.includes('hasConflict') && sessionControllerCode.includes('INVALID_SESSION_ID')) {
    if (!authSessionInterfaceDoc.includes('僅保留單一 `X-Session-Id`')) {
      issues.push(
        '[truth/session] 06-接口描述/01-auth-session.md must document refresh conflict handling (single X-Session-Id source)'
      );
    }
  }

  if (adminControllerCode.includes('async listJobs')) {
    const jobsRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/jobs');
    if (!jobsRow || !jobsRow.includes('data.jobs')) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md must include GET /api/v1/admin/jobs with data.jobs[] contract'
      );
    }
  }

  if (adminControllerCode.includes('async healthDetailed')) {
    const healthDetailedRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/health/detailed');
    if (
      !healthDetailedRow ||
      !healthDetailedRow.includes('cronStarted') ||
      !healthDetailedRow.includes('activeJobCount') ||
      !healthDetailedRow.includes('performance') ||
      !healthDetailedRow.includes('data.env')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md health/detailed row must document cronStarted/activeJobCount/performance/env fields'
      );
    }
  }

  if (adminControllerCode.includes('async getInterviewRuntimeConfig')) {
    const runtimeRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/runtime/interview');
    if (!runtimeRow || !runtimeRow.includes('defaults') || !runtimeRow.includes('runtime') || !runtimeRow.includes('source')) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md must document runtime/interview response as defaults/runtime/source'
      );
    }
  }

  const adminConfigListLimit100 =
    adminConfigsPageCode.includes('listConfigs({ limit: 100, offset: 0 })') &&
    adminSettingsPageCode.includes('listConfigs({ limit: 100, offset: 0 })');
  if (adminConfigListLimit100) {
    if (
      !adminInterfaceDoc.includes('listConfigs({ limit: 100, offset: 0 })') &&
      !adminInterfaceDoc.includes('limit=100')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md must document Configs/Settings listConfigs limit=100 fetch window'
      );
    }
    if (!flowDoc.includes('Config/Settings 首屏讀取窗口目前統一為 `limit=100`')) {
      issues.push(
        '[truth/flow] 業務流程整合.md P05 step 5 must document Configs/Settings limit=100 fetch window'
      );
    }
  }

  const adminUsersSearchRouteBound = /router\.get\(\s*'\/users'[\s\S]*?validate\(adminSearchPaginationQuerySchema\)/m.test(
    adminRoutesCode
  );
  const adminUsersSearchSchemaBound =
    validationCode.includes('adminSearchPaginationQuerySchema') &&
    validationCode.includes("q: Joi.string().max(255).optional().allow('')") &&
    validationCode.includes('limit: Joi.number().integer().min(1).max(100).optional()') &&
    validationCode.includes('offset: Joi.number().integer().min(0).optional()');
  if (adminUsersSearchRouteBound && adminUsersSearchSchemaBound) {
    const usersInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/users');
    if (
      !usersInterfaceRow ||
      !usersInterfaceRow.includes('q') ||
      !usersInterfaceRow.includes('limit') ||
      !usersInterfaceRow.includes('offset')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/users row must document q/limit/offset query contract'
      );
    }

    const usersApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/users');
    if (
      !usersApiMainRow ||
      !usersApiMainRow.includes('q') ||
      !usersApiMainRow.includes('limit') ||
      !usersApiMainRow.includes('offset')
    ) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/users row must include q/limit/offset semantics'
      );
    }

    const usersMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/users');
    if (
      !usersMappingRow ||
      !usersMappingRow.includes('q') ||
      !usersMappingRow.includes('limit') ||
      !usersMappingRow.includes('offset')
    ) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/users row must include q/limit/offset semantics'
      );
    }

    const usersFlowRow = flowDoc.split('\n').find((line) => line.includes('GET /admin/users*')) || null;
    if (
      !usersFlowRow ||
      !usersFlowRow.includes('q') ||
      !usersFlowRow.includes('limit') ||
      !usersFlowRow.includes('offset')
    ) {
      issues.push(
        '[truth/flow] 業務流程整合.md P05 step 6 must document /admin/users query contract as q + limit/offset'
      );
    }
  }

  const adminAdminUsersSearchRouteBound =
    /router\.get\(\s*'\/admin-users'[\s\S]*?validate\(adminSearchPaginationQuerySchema\)/m.test(
      adminRoutesCode
    );
  if (adminAdminUsersSearchRouteBound && adminUsersSearchSchemaBound) {
    const adminUsersInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/admin-users');
    if (
      !adminUsersInterfaceRow ||
      !adminUsersInterfaceRow.includes('q') ||
      !adminUsersInterfaceRow.includes('limit') ||
      !adminUsersInterfaceRow.includes('offset')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/admin-users row must document q/limit/offset query contract'
      );
    }

    const adminUsersApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/admin-users');
    if (
      !adminUsersApiMainRow ||
      !adminUsersApiMainRow.includes('q') ||
      !adminUsersApiMainRow.includes('limit') ||
      !adminUsersApiMainRow.includes('offset')
    ) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/admin-users row must include q/limit/offset semantics'
      );
    }

    const adminUsersMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/admin-users');
    if (
      !adminUsersMappingRow ||
      !adminUsersMappingRow.includes('q') ||
      !adminUsersMappingRow.includes('limit') ||
      !adminUsersMappingRow.includes('offset')
    ) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/admin-users row must include q/limit/offset semantics'
      );
    }
  }

  const adminAuditLogsRouteBound = /router\.get\(\s*'\/audit-logs'[\s\S]*?validate\(adminAuditLogsQuerySchema\)/m.test(
    adminRoutesCode
  );
  const adminAuditLogsSchemaBound =
    validationCode.includes('adminAuditLogsQuerySchema') &&
    validationCode.includes('entityType: Joi.string().max(50).optional()') &&
    validationCode.includes('action: Joi.string().max(50).optional()') &&
    validationCode.includes('from: Joi.string().isoDate().optional()') &&
    validationCode.includes('to: Joi.string().isoDate().optional()') &&
    validationCode.includes('limit: Joi.number().integer().min(1).max(100).optional()') &&
    validationCode.includes('offset: Joi.number().integer().min(0).optional()');
  if (adminAuditLogsRouteBound && adminAuditLogsSchemaBound) {
    const auditInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/audit-logs');
    if (
      !auditInterfaceRow ||
      !auditInterfaceRow.includes('entityType') ||
      !auditInterfaceRow.includes('action') ||
      !auditInterfaceRow.includes('from') ||
      !auditInterfaceRow.includes('to') ||
      !auditInterfaceRow.includes('limit') ||
      !auditInterfaceRow.includes('offset')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/audit-logs row must document entityType/action/from/to/limit/offset query contract'
      );
    }

    const auditApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/audit-logs');
    if (
      !auditApiMainRow ||
      !auditApiMainRow.includes('entityType') ||
      !auditApiMainRow.includes('action') ||
      !auditApiMainRow.includes('from') ||
      !auditApiMainRow.includes('to') ||
      !auditApiMainRow.includes('limit') ||
      !auditApiMainRow.includes('offset')
    ) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/audit-logs row must include entityType/action/from/to/limit/offset semantics'
      );
    }

    const auditMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/audit-logs');
    if (
      !auditMappingRow ||
      !auditMappingRow.includes('entityType') ||
      !auditMappingRow.includes('action') ||
      !auditMappingRow.includes('from') ||
      !auditMappingRow.includes('to') ||
      !auditMappingRow.includes('limit') ||
      !auditMappingRow.includes('offset')
    ) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/audit-logs row must include entityType/action/from/to/limit/offset semantics'
      );
    }

    const auditFlowRow = flowDoc.split('\n').find((line) => line.includes('GET /admin/audit-logs*')) || null;
    if (
      !auditFlowRow ||
      !auditFlowRow.includes('entityType') ||
      !auditFlowRow.includes('action') ||
      !auditFlowRow.includes('from') ||
      !auditFlowRow.includes('to') ||
      !auditFlowRow.includes('limit') ||
      !auditFlowRow.includes('offset')
    ) {
      issues.push(
        '[truth/flow] 業務流程整合.md P05 step 7 must document /admin/audit-logs query contract as entityType/action/from/to + limit/offset'
      );
    }
  }

  const adminAuditLogsCsvRouteBound =
    /router\.get\(\s*'\/audit-logs\.csv'[\s\S]*?validate\(adminAuditLogsQuerySchema\)/m.test(
      adminRoutesCode
    );
  if (adminAuditLogsCsvRouteBound && adminAuditLogsSchemaBound) {
    const auditCsvInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/audit-logs.csv');
    if (
      !auditCsvInterfaceRow ||
      !auditCsvInterfaceRow.includes('entityType') ||
      !auditCsvInterfaceRow.includes('action') ||
      !auditCsvInterfaceRow.includes('from') ||
      !auditCsvInterfaceRow.includes('to') ||
      !auditCsvInterfaceRow.includes('limit') ||
      !auditCsvInterfaceRow.includes('offset')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/audit-logs.csv row must document entityType/action/from/to/limit/offset query contract'
      );
    }

    const auditCsvApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/audit-logs.csv');
    if (
      !auditCsvApiMainRow ||
      !auditCsvApiMainRow.includes('entityType') ||
      !auditCsvApiMainRow.includes('action') ||
      !auditCsvApiMainRow.includes('from') ||
      !auditCsvApiMainRow.includes('to') ||
      !auditCsvApiMainRow.includes('limit') ||
      !auditCsvApiMainRow.includes('offset')
    ) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/audit-logs.csv row must include entityType/action/from/to/limit/offset semantics'
      );
    }

    const auditCsvMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/audit-logs.csv');
    if (
      !auditCsvMappingRow ||
      !auditCsvMappingRow.includes('entityType') ||
      !auditCsvMappingRow.includes('action') ||
      !auditCsvMappingRow.includes('from') ||
      !auditCsvMappingRow.includes('to') ||
      !auditCsvMappingRow.includes('limit') ||
      !auditCsvMappingRow.includes('offset')
    ) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/audit-logs.csv row must include entityType/action/from/to/limit/offset semantics'
      );
    }
  }

  const adminAIStreamReportRouteBound =
    /router\.get\(\s*'\/reports\/ai-streams'\s*,[\s\S]*?validate\(adminAIStreamReportQuerySchema\)/m.test(
      adminRoutesCode
    );
  const adminAIStreamReportSchemaBound =
    validationCode.includes('adminAIStreamReportQuerySchema') &&
    validationCode.includes('days: Joi.number().integer().min(1).max(90).optional()') &&
    validationCode.includes('limit: Joi.number().integer().min(1).max(50).optional()');
  const adminAIStreamReportPayloadBound =
    adminControllerCode.includes('async reportAIStreams') &&
    adminControllerCode.includes('const days = parseDaysRange(req);') &&
    adminControllerCode.includes('const limit = Math.min(Math.max(Number(req.query.limit ?? 10) || 10, 1), 50);') &&
    aiStreamServiceCode.includes('windowDays: days') &&
    aiStreamServiceCode.includes('retentionPolicy: this.getRetentionPolicy()') &&
    aiStreamServiceCode.includes('recentFailures:');
  if (adminAIStreamReportRouteBound && adminAIStreamReportSchemaBound && adminAIStreamReportPayloadBound) {
    const reportInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/reports/ai-streams');
    if (
      !reportInterfaceRow ||
      !reportInterfaceRow.includes('days') ||
      !reportInterfaceRow.includes('limit') ||
      !reportInterfaceRow.includes('windowDays') ||
      !reportInterfaceRow.includes('retentionPolicy') ||
      !reportInterfaceRow.includes('totals') ||
      !reportInterfaceRow.includes('recentFailures')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/reports/ai-streams row must document days/limit query and windowDays/retentionPolicy/totals/recentFailures response contract'
      );
    }

    const reportApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/reports/ai-streams');
    if (!reportApiMainRow || !reportApiMainRow.includes('days') || !reportApiMainRow.includes('limit')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/ai-streams row must include days/limit semantics'
      );
    }
    if (!apiMainDoc.includes('data.windowDays,data.retentionPolicy,data.totals')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/ai-streams deep contract must include windowDays/retentionPolicy/totals'
      );
    }

    const reportMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/reports/ai-streams');
    if (!reportMappingRow || !reportMappingRow.includes('days') || !reportMappingRow.includes('limit')) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/reports/ai-streams row must include days/limit semantics'
      );
    }
  }

  const adminAIStreamSessionsRouteBound =
    /router\.get\(\s*'\/reports\/ai-streams\/sessions'\s*,[\s\S]*?validate\(adminAIStreamListQuerySchema\)/m.test(
      adminRoutesCode
    );
  const adminAIStreamSessionsSchemaBound =
    validationCode.includes('adminAIStreamListQuerySchema') &&
    validationCode.includes('status: Joi.string().valid(') &&
    validationCode.includes('scopeType: Joi.string().max(50).optional()') &&
    validationCode.includes('scopeId: Joi.string().max(100).optional()') &&
    validationCode.includes('requestId: Joi.string().max(100).optional()') &&
    validationCode.includes('streamId: Joi.string().max(100).optional()') &&
    validationCode.includes("source: Joi.string().valid('live', 'archive', 'all').optional()");
  const adminAIStreamSessionsPayloadBound =
    adminControllerCode.includes('async listAIStreamSessions') &&
    adminControllerCode.includes('const { limit, offset } = parsePagination(req);') &&
    adminControllerCode.includes('const source = parseAIStreamSource(req);') &&
    aiStreamServiceCode.includes('source, total: live.total + archive.total') &&
    aiStreamServiceCode.includes('return { source, total: live.total, limit, offset, items: live.items };');
  if (adminAIStreamSessionsRouteBound && adminAIStreamSessionsSchemaBound && adminAIStreamSessionsPayloadBound) {
    const sessionsInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/reports/ai-streams/sessions');
    if (
      !sessionsInterfaceRow ||
      !sessionsInterfaceRow.includes('days') ||
      !sessionsInterfaceRow.includes('limit') ||
      !sessionsInterfaceRow.includes('offset') ||
      !sessionsInterfaceRow.includes('status') ||
      !sessionsInterfaceRow.includes('scopeType') ||
      !sessionsInterfaceRow.includes('scopeId') ||
      !sessionsInterfaceRow.includes('requestId') ||
      !sessionsInterfaceRow.includes('streamId') ||
      !sessionsInterfaceRow.includes('source') ||
      !sessionsInterfaceRow.includes('live/archive/all') ||
      !sessionsInterfaceRow.includes('data.source') ||
      !sessionsInterfaceRow.includes('data.total') ||
      !sessionsInterfaceRow.includes('data.limit') ||
      !sessionsInterfaceRow.includes('data.offset') ||
      !sessionsInterfaceRow.includes('data.items[]')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/reports/ai-streams/sessions row must document full filter query + source(live/archive/all) and source/total/limit/offset/items response contract'
      );
    }

    const sessionsApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/reports/ai-streams/sessions');
    if (
      !sessionsApiMainRow ||
      !sessionsApiMainRow.includes('limit') ||
      !sessionsApiMainRow.includes('offset') ||
      !sessionsApiMainRow.includes('source')
    ) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/ai-streams/sessions row must include limit/offset/source semantics'
      );
    }
    if (!apiMainDoc.includes('data.source,data.total,data.limit,data.offset,data.items[]')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/ai-streams/sessions deep contract must include source/total/limit/offset/items'
      );
    }

    const sessionsMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/reports/ai-streams/sessions');
    if (
      !sessionsMappingRow ||
      !sessionsMappingRow.includes('limit') ||
      !sessionsMappingRow.includes('offset') ||
      !sessionsMappingRow.includes('source')
    ) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/reports/ai-streams/sessions row must include filter/source semantics'
      );
    }
  }

  const adminAIStreamDetailRouteBound =
    /router\.get\(\s*'\/reports\/ai-streams\/sessions\/:streamId'\s*,[\s\S]*?validate\(adminAIStreamDetailSchema\)/m.test(
      adminRoutesCode
    );
  const adminAIStreamDetailSchemaBound =
    validationCode.includes('adminAIStreamDetailSchema') &&
    validationCode.includes('eventLimit: Joi.number().integer().min(1).max(1000).optional()') &&
    validationCode.includes("source: Joi.string().valid('live', 'archive', 'all').optional()");
  const adminAIStreamDetailPayloadBound =
    adminControllerCode.includes('async getAIStreamDetail') &&
    adminControllerCode.includes('const source = parseAIStreamSource(req);') &&
    adminControllerCode.includes('const eventLimit = Math.min(Math.max(Number(req.query.eventLimit ?? 200) || 200, 1), 1000);') &&
    adminControllerCode.includes("throw Errors.NOT_FOUND('AI Stream 不存在');") &&
    aiStreamServiceCode.includes("if (source === 'archive') return fetchArchive();");
  if (adminAIStreamDetailRouteBound && adminAIStreamDetailSchemaBound && adminAIStreamDetailPayloadBound) {
    const detailInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/reports/ai-streams/sessions/:streamId');
    if (
      !detailInterfaceRow ||
      !detailInterfaceRow.includes('eventLimit') ||
      !detailInterfaceRow.includes('source') ||
      !detailInterfaceRow.includes('live/archive/all') ||
      !detailInterfaceRow.includes('data.source') ||
      !detailInterfaceRow.includes('data.session') ||
      !detailInterfaceRow.includes('data.events[]') ||
      !detailInterfaceRow.includes('NOT_FOUND')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/reports/ai-streams/sessions/:streamId row must document eventLimit/source(live/archive/all), source/session/events response and NOT_FOUND'
      );
    }

    const detailApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/reports/ai-streams/sessions/:streamId');
    if (!detailApiMainRow || !detailApiMainRow.includes('eventLimit') || !detailApiMainRow.includes('source')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/ai-streams/sessions/:streamId row must include eventLimit/source semantics'
      );
    }
    if (!apiMainDoc.includes('data.source(live/archive),data.session,data.events[]')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/ai-streams/sessions/:streamId deep contract must include source/session/events'
      );
    }

    const detailMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/reports/ai-streams/sessions/:streamId');
    if (!detailMappingRow || !detailMappingRow.includes('source') || !detailMappingRow.includes('eventLimit')) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/reports/ai-streams/sessions/:streamId row must include source/eventLimit semantics'
      );
    }
  }

  if (adminAIStreamReportRouteBound && adminAIStreamSessionsRouteBound && adminAIStreamDetailRouteBound) {
    const aiStreamFlowRow = flowDoc.split('\n').find((line) => line.includes('GET /admin/reports/ai-streams*')) || null;
    if (
      !aiStreamFlowRow ||
      !aiStreamFlowRow.includes('days + limit') ||
      !aiStreamFlowRow.includes('source(live/archive/all)') ||
      !aiStreamFlowRow.includes('eventLimit/source') ||
      !aiStreamFlowRow.includes('VALIDATION_ERROR') ||
      !aiStreamFlowRow.includes('NOT_FOUND')
    ) {
      issues.push(
        '[truth/flow] 業務流程整合.md P05 AI Stream governance step must document ai-streams*/sessions/detail query contracts and VALIDATION_ERROR/NOT_FOUND recovery branch'
      );
    }
  }

  const adminReportsOverviewRouteBound = /router\.get\(\s*'\/reports\/overview'[\s\S]*?reportOverview\.bind\(adminController\)/m.test(
    adminRoutesCode
  );
  const adminReportsOverviewPayloadBound =
    adminControllerCode.includes('async reportOverview') &&
    adminControllerCode.includes('totals: {') &&
    adminControllerCode.includes('conversion') &&
    adminControllerCode.includes('pairingRate') &&
    adminControllerCode.includes('caseCreationRate') &&
    adminControllerCode.includes('judgmentCompletionRate') &&
    adminControllerCode.includes('caseCompletionRate');
  if (adminReportsOverviewRouteBound && adminReportsOverviewPayloadBound) {
    const overviewInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/reports/overview');
    if (
      !overviewInterfaceRow ||
      !overviewInterfaceRow.includes('data.totals') ||
      !overviewInterfaceRow.includes('data.conversion') ||
      !overviewInterfaceRow.includes('pairingRate') ||
      !overviewInterfaceRow.includes('caseCreationRate') ||
      !overviewInterfaceRow.includes('judgmentCompletionRate') ||
      !overviewInterfaceRow.includes('caseCompletionRate')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/reports/overview row must document totals/conversion payload and conversion keys'
      );
    }

    const overviewApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/reports/overview');
    if (!overviewApiMainRow || !overviewApiMainRow.includes('totals') || !overviewApiMainRow.includes('conversion')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/overview row must include totals/conversion semantics'
      );
    }
    if (!apiMainDoc.includes('data.totals,data.conversion')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/overview deep contract must include data.totals,data.conversion'
      );
    }

    const overviewMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/reports/overview');
    if (!overviewMappingRow || !overviewMappingRow.includes('totals') || !overviewMappingRow.includes('conversion')) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/reports/overview row must include totals/conversion semantics'
      );
    }
  }

  const adminReportsFunnelRouteBound = /router\.get\(\s*'\/reports\/funnel'[\s\S]*?reportFunnel\.bind\(adminController\)/m.test(
    adminRoutesCode
  );
  const adminReportsFunnelPayloadBound =
    adminControllerCode.includes('async reportFunnel') &&
    adminControllerCode.includes("key: 'register'") &&
    adminControllerCode.includes("key: 'pairing'") &&
    adminControllerCode.includes("key: 'case'") &&
    adminControllerCode.includes("key: 'judgment'") &&
    adminControllerCode.includes("key: 'execution_complete'");
  if (adminReportsFunnelRouteBound && adminReportsFunnelPayloadBound) {
    const funnelInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/reports/funnel');
    if (
      !funnelInterfaceRow ||
      !funnelInterfaceRow.includes('data.stages[]') ||
      !funnelInterfaceRow.includes('register') ||
      !funnelInterfaceRow.includes('execution_complete')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/reports/funnel row must document stages[] and register/execution_complete key coverage'
      );
    }

    const funnelApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/reports/funnel');
    if (!funnelApiMainRow || !funnelApiMainRow.includes('stages')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/funnel row must include stages[] semantics'
      );
    }
    if (!apiMainDoc.includes('data.stages[]')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/funnel deep contract must include data.stages[]'
      );
    }

    const funnelMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/reports/funnel');
    if (!funnelMappingRow || !funnelMappingRow.includes('stages')) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/reports/funnel row must include stages[] semantics'
      );
    }
  }

  const adminReportsCostsRouteBound = /router\.get\(\s*'\/reports\/costs'[\s\S]*?reportCosts\.bind\(adminController\)/m.test(
    adminRoutesCode
  );
  const adminReportsCostsPayloadBound =
    adminControllerCode.includes('async reportCosts') &&
    adminControllerCode.includes('costMonitoringService.getAdminCostReport');
  if (adminReportsCostsRouteBound && adminReportsCostsPayloadBound) {
    const costsInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/reports/costs');
    if (
      !costsInterfaceRow ||
      !costsInterfaceRow.includes('generatedAt') ||
      !costsInterfaceRow.includes('currency') ||
      !costsInterfaceRow.includes('partial') ||
      !costsInterfaceRow.includes('reasons') ||
      !costsInterfaceRow.includes('summary') ||
      !costsInterfaceRow.includes('redis') ||
      !costsInterfaceRow.includes('railway') ||
      !costsInterfaceRow.includes('openai')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/reports/costs row must document generatedAt/currency/partial/reasons/summary/redis/railway/openai payload'
      );
    }

    const costsApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/reports/costs');
    if (
      !costsApiMainRow ||
      !costsApiMainRow.includes('currency') ||
      !costsApiMainRow.includes('partial') ||
      !costsApiMainRow.includes('summary')
    ) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/costs row must include currency/partial/summary semantics'
      );
    }
    if (!apiMainDoc.includes('data.generatedAt,data.currency,data.partial,data.summary,data.redis,data.railway,data.openai')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/costs deep contract must include generatedAt/currency/partial/summary/redis/railway/openai'
      );
    }

    const costsMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/reports/costs');
    if (!costsMappingRow || !costsMappingRow.includes('currency') || !costsMappingRow.includes('summary')) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/reports/costs row must include currency/summary semantics'
      );
    }
  }

  const adminReportsOverviewCsvRouteBound =
    /router\.get\(\s*'\/reports\/overview\.csv'[\s\S]*?exportOverviewCsv\.bind\(adminController\)/m.test(
      adminRoutesCode
    );
  const adminReportsOverviewCsvPayloadBound =
    adminControllerCode.includes('async exportOverviewCsv') &&
    adminControllerCode.includes("'metric,value'") &&
    adminControllerCode.includes('users,${users}') &&
    adminControllerCode.includes('cases,${cases}') &&
    adminControllerCode.includes('judgments,${judgments}') &&
    adminControllerCode.includes('attachment; filename="admin-overview.csv"');
  if (adminReportsOverviewCsvRouteBound && adminReportsOverviewCsvPayloadBound) {
    const overviewCsvInterfaceRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/admin/reports/overview.csv');
    if (
      !overviewCsvInterfaceRow ||
      !overviewCsvInterfaceRow.includes('blob') ||
      !overviewCsvInterfaceRow.includes('metric,value') ||
      !overviewCsvInterfaceRow.includes('users/cases/judgments')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/admin/reports/overview.csv row must document blob csv metric,value with users/cases/judgments metrics'
      );
    }

    const overviewCsvApiMainRow = findEndpointRow(apiMainDoc, 'GET', '/api/v1/admin/reports/overview.csv');
    if (!overviewCsvApiMainRow || !overviewCsvApiMainRow.includes('CSV') || !overviewCsvApiMainRow.includes('metric,value')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/overview.csv row must include csv metric,value semantics'
      );
    }
    if (!apiMainDoc.includes('blob(csv:metric,value)')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md GET /api/v1/admin/reports/overview.csv deep contract must include blob(csv:metric,value)'
      );
    }

    const overviewCsvMappingRow = findEndpointRow(mappingDoc, 'GET', '/api/v1/admin/reports/overview.csv');
    if (!overviewCsvMappingRow || !overviewCsvMappingRow.includes('CSV') || !overviewCsvMappingRow.includes('metric,value')) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md GET /api/v1/admin/reports/overview.csv row must include CSV metric,value semantics'
      );
    }
  }

  const adminReportsCustomRouteBound =
    /router\.post\(\s*'\/reports\/custom'[\s\S]*?validate\(adminCustomReportSchema\)[\s\S]*?customReport\.bind\(adminController\)/m.test(
      adminRoutesCode
    );
  const adminReportsCustomSchemaBound =
    validationCode.includes('adminCustomReportSchema') &&
    validationCode.includes("Joi.string().valid('dau', 'mau', 'judgment_failed')") &&
    validationCode.includes('.min(1)') &&
    validationCode.includes('.max(20)') &&
    validationCode.includes('.required()');
  const adminReportsCustomPayloadBound =
    adminControllerCode.includes('async customReport') &&
    adminControllerCode.includes("if (metrics.includes('dau'))") &&
    adminControllerCode.includes("if (metrics.includes('mau'))") &&
    adminControllerCode.includes("if (metrics.includes('judgment_failed'))") &&
    adminControllerCode.includes('data: { metrics: result }');
  if (adminReportsCustomRouteBound && adminReportsCustomSchemaBound && adminReportsCustomPayloadBound) {
    const customInterfaceRow = findEndpointRow(adminInterfaceDoc, 'POST', '/api/v1/admin/reports/custom');
    if (
      !customInterfaceRow ||
      !customInterfaceRow.includes('metrics[]') ||
      !customInterfaceRow.includes('dau/mau/judgment_failed') ||
      !customInterfaceRow.includes('1-20') ||
      !customInterfaceRow.includes('data.metrics') ||
      !customInterfaceRow.includes('FORBIDDEN') ||
      !customInterfaceRow.includes('VALIDATION_ERROR')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md POST /api/v1/admin/reports/custom row must document metrics enum/min-max and FORBIDDEN/VALIDATION_ERROR'
      );
    }

    const customApiMainRow = findEndpointRow(apiMainDoc, 'POST', '/api/v1/admin/reports/custom');
    if (!customApiMainRow || !customApiMainRow.includes('metrics') || !customApiMainRow.includes('dau')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md POST /api/v1/admin/reports/custom row must include metrics enum semantics'
      );
    }
    if (!apiMainDoc.includes('metrics[]: dau/mau/judgment_failed (1-20)')) {
      issues.push(
        '[truth/api] 全接口清單-主文檔.md POST /api/v1/admin/reports/custom deep contract must include metrics[]: dau/mau/judgment_failed (1-20)'
      );
    }

    const customMappingRow = findEndpointRow(mappingDoc, 'POST', '/api/v1/admin/reports/custom');
    if (!customMappingRow || !customMappingRow.includes('metrics[]') || !customMappingRow.includes('judgment_failed')) {
      issues.push(
        '[truth/mapping] 接口-功能-頁面-Mapping.md POST /api/v1/admin/reports/custom row must include metrics enum semantics'
      );
    }
  }

  if (
    adminReportsOverviewRouteBound &&
    adminReportsFunnelRouteBound &&
    adminReportsCostsRouteBound &&
    adminReportsOverviewCsvRouteBound &&
    adminReportsCustomRouteBound
  ) {
    const reportFlowRow =
      flowDoc.split('\n').find((line) => line.includes('GET /admin/reports/overview|funnel|costs')) || null;
    if (
      !reportFlowRow ||
      !reportFlowRow.includes('POST /admin/reports/custom') ||
      !reportFlowRow.includes('GET /admin/reports/overview.csv') ||
      !reportFlowRow.includes('dau/mau/judgment_failed') ||
      !reportFlowRow.includes('1-20') ||
      !reportFlowRow.includes('VALIDATION_ERROR') ||
      !reportFlowRow.includes('FORBIDDEN')
    ) {
      issues.push(
        '[truth/flow] 業務流程整合.md P05 report step must document overview/funnel/costs/custom/overview.csv contracts and VALIDATION_ERROR/FORBIDDEN recovery branch'
      );
    }
  }

  if (validationCode.includes('mediaProviderCatalogQuerySchema')) {
    const providersRow = findEndpointRow(adminInterfaceDoc, 'GET', '/api/v1/providers');
    if (!providersRow || !providersRow.includes('providerType?') || providersRow.includes('activeOnly') || providersRow.includes('includeConfig')) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md GET /api/v1/providers row must align with current query contract (providerType only)'
      );
    }
  }

  if (validationCode.includes('mediaProviderEstimateSchema')) {
    const estimateRow = findEndpointRow(adminInterfaceDoc, 'POST', '/api/v1/providers/:providerKey/estimate');
    if (
      !estimateRow ||
      !estimateRow.includes('pricingOverride') ||
      !estimateRow.includes('unitPriceUsd') ||
      estimateRow.includes('prompt')
    ) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md provider estimate row must match count/durationSeconds/pricingOverride contract (no prompt)'
      );
    }
  }

  if (validationCode.includes('mediaProviderTestSchema')) {
    const testRow = findEndpointRow(adminInterfaceDoc, 'POST', '/api/v1/providers/:providerKey/test');
    if (!testRow || !testRow.includes('latencyMs') || !testRow.includes('data.success')) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md provider test row must document providerKey/success/message/latencyMs response'
      );
    }
  }

  if (validationCode.includes('mediaProviderGenerateImageSchema')) {
    const imageRow = findEndpointRow(adminInterfaceDoc, 'POST', '/api/v1/providers/:providerKey/images');
    if (!imageRow || !imageRow.includes('assets[]') || !imageRow.includes('requestId')) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md provider images row must document requestId + assets[] response'
      );
    }
  }

  if (validationCode.includes('mediaProviderGenerateVideoSchema')) {
    const videoRow = findEndpointRow(adminInterfaceDoc, 'POST', '/api/v1/providers/:providerKey/videos');
    if (!videoRow || !videoRow.includes('assets[]') || !videoRow.includes('requestId')) {
      issues.push(
        '[truth/admin] 06-接口描述/09-admin.md provider videos row must document requestId + assets[] response'
      );
    }
  }

  if (backendAppCode.includes("path === '/version'") && backendAppCode.includes("path === '/api/v1/version'")) {
    const versionApiRow = findEndpointRow(healthMetricsInterfaceDoc, 'GET', '/api/v1/version');
    const versionRootRow = findEndpointRow(healthMetricsInterfaceDoc, 'GET', '/version');
    if (!versionApiRow || !versionRootRow) {
      issues.push(
        '[truth/health] 06-接口描述/10-health-metrics.md must document both GET /api/v1/version and GET /version'
      );
    }
  }

  if (healthRoutesCode.includes("router.get('/version'") && metaRoutesCode.includes("router.get('/version'")) {
    if (!healthMetricsInterfaceDoc.includes('/api/v1/version') || !healthMetricsInterfaceDoc.includes('同 payload')) {
      issues.push(
        '[truth/health] 06-接口描述/10-health-metrics.md must explain /version and /api/v1/version same-payload semantics'
      );
    }
  }

  if (metricsRoutesCode.includes('METRICS_ALLOWED_IPS') && metricsRoutesCode.includes('X-Metrics-Token')) {
    if (!healthMetricsInterfaceDoc.includes('token 或 IP 白名單')) {
      issues.push(
        '[truth/health] 06-接口描述/10-health-metrics.md must document metrics token-or-IP allowlist protection'
      );
    }
  }

  if (frontendVersionInfoCode.includes('/version') && frontendAdminVersionInfoCode.includes('/version')) {
    if (!healthMetricsInterfaceDoc.includes("VITE_API_BASE_URL + '/version'")) {
      issues.push(
        "[truth/health] 06-接口描述/10-health-metrics.md must document frontend/admin version panel source: VITE_API_BASE_URL + '/version'"
      );
    }
  }

  const staleApiEvidencePathTokens = [
    'frontend-admin/pages/Admin/Health',
    'frontend-admin/pages/Admin/Jobs',
    'frontend-admin/pages/Admin/Reports',
    'frontend-admin/pages/Admin/Settings',
    'frontend/versionInfo',
    'frontend-admin/versionInfo',
  ];
  for (const token of staleApiEvidencePathTokens) {
    if (apiMainDoc.includes(token)) {
      issues.push(`[truth/api] 全接口清單-主文檔.md contains stale evidence path token: ${token}`);
    }
  }

  const requiredApiEvidencePathTokens = [
    'frontend-admin/src/pages/Admin/Health',
    'frontend-admin/src/pages/Admin/Jobs',
    'frontend-admin/src/pages/Admin/Reports',
    'frontend-admin/src/pages/Admin/Settings',
    'frontend/src/utils/versionInfo.ts',
    'frontend-admin/src/utils/versionInfo.ts',
  ];
  for (const token of requiredApiEvidencePathTokens) {
    if (!apiMainDoc.includes(token)) {
      issues.push(`[truth/api] 全接口清單-主文檔.md missing normalized evidence path token: ${token}`);
    }
  }

  if (validationCode.includes('createNotificationSchema')) {
    const createNotificationRow = findEndpointRow(
      contentNotificationInterfaceDoc,
      'POST',
      '/api/v1/notifications'
    );
    if (!createNotificationRow) {
      issues.push(
        '[truth/notification] 06-接口描述/08-content-notification.md missing row: POST /api/v1/notifications'
      );
    } else {
      if (!createNotificationRow.includes('channel') || !createNotificationRow.includes('template_code')) {
        issues.push(
          '[truth/notification] POST /api/v1/notifications must document channel/template_code request fields in 08-content-notification.md'
        );
      }
      if (!createNotificationRow.includes('VALIDATION_ERROR')) {
        issues.push(
          '[truth/notification] POST /api/v1/notifications must include VALIDATION_ERROR in 08-content-notification.md'
        );
      }
    }
  }

  if (validationCode.includes('notificationListQuerySchema')) {
    const listNotificationRow = findEndpointRow(
      contentNotificationInterfaceDoc,
      'GET',
      '/api/v1/notifications'
    );
    if (!listNotificationRow || !listNotificationRow.includes('VALIDATION_ERROR')) {
      issues.push(
        '[truth/notification] GET /api/v1/notifications must include VALIDATION_ERROR in 08-content-notification.md'
      );
    }
  }

  if (validationCode.includes('notificationIdParamSchema')) {
    const notificationIdEndpoints = [
      '/api/v1/notifications/:id/read',
      '/api/v1/notifications/:id/dismiss',
      '/api/v1/notifications/:id/snooze',
      '/api/v1/notifications/:id/act',
    ];
    for (const endpointPath of notificationIdEndpoints) {
      const row = findEndpointRow(contentNotificationInterfaceDoc, 'POST', endpointPath);
      if (!row || !row.includes('VALIDATION_ERROR')) {
        issues.push(
          `[truth/notification] ${endpointPath} must include VALIDATION_ERROR in 08-content-notification.md`
        );
      }
    }
  }

  if (validationCode.includes('createContentLinkSchema')) {
    const recommendationsRow = findEndpointRow(
      contentNotificationInterfaceDoc,
      'GET',
      '/api/v1/content-items/recommendations/:caseId'
    );
    if (!recommendationsRow || !recommendationsRow.includes('relation?')) {
      issues.push(
        '[truth/content] GET /api/v1/content-items/recommendations/:caseId must document query relation? in 08-content-notification.md'
      );
    }
  }

  if (
    validationCode.includes("mode: Joi.string().valid('lower_pressure', 'slower_pace', 'solo_first')") &&
    validationCode.includes("reason: Joi.string().valid('needs_help', 'farther', 'high_stress', 'manual')")
  ) {
    const replanContractTokens = [
      'mode(lower_pressure/slower_pace/solo_first)',
      'reason(needs_help/farther/high_stress/manual)',
      'data.track{track_id,status,accepted,stream_scope,scope_id,stream_id,request_id}',
      '202 Accepted',
      '/api/v1/streams/repair_track/:id',
    ];
    for (const token of replanContractTokens) {
      if (!reconciliationExecutionInterfaceDoc.includes(token)) {
        issues.push(
          `[truth/repair-journey] 06-接口描述/05-reconciliation-execution.md missing replan contract token: ${token}`
        );
      }
    }
  }

  if (
    executionServiceCode.includes("existingSnapshot && ['created', 'queued', 'started', 'streaming', 'completed'].includes(existingSnapshot.status)")
  ) {
    const idempotentMarkers = [
      'created/queued/started/streaming/completed',
      '直接返回既有 `stream_id/request_id`',
    ];
    for (const token of idempotentMarkers) {
      if (!reconciliationExecutionInterfaceDoc.includes(token)) {
        issues.push(
          `[truth/repair-journey] 06-接口描述/05-reconciliation-execution.md missing replan idempotent marker: ${token}`
        );
      }
    }
  }

  if (
    executionServiceCode.includes('active_replan_stream_id') &&
    executionServiceCode.includes("['persisted', 'failed', 'cancelled']")
  ) {
    const replanStateMarkers = [
      'replan_state',
      'active_replan_stream_id',
      'persisted/failed/cancelled',
    ];
    for (const token of replanStateMarkers) {
      if (!reconciliationExecutionInterfaceDoc.includes(token)) {
        issues.push(
          `[truth/repair-journey] 06-接口描述/05-reconciliation-execution.md missing replan stream-state marker: ${token}`
        );
      }
    }
  }

  if (executionServiceCode.includes('const primaryCtaMap') && executionServiceCode.includes('const secondaryCtaMap')) {
    const primaryCtaMappings = [
      'draft -> commit_plan',
      'partner_invited -> view_invitation_status',
      'solo_active/co_active -> continue_today_step',
      'replanning -> replan_track',
      'paused -> resume_track',
      'completed -> review_completed_journey',
      'closed -> review_history',
    ];
    const secondaryCtaMappings = [
      'draft -> review_direction',
      'partner_invited -> continue_solo',
      'solo_active/co_active/replanning -> pause_track',
      'paused -> review_direction',
      'completed/closed -> restart_new_round',
    ];
    for (const token of [...primaryCtaMappings, ...secondaryCtaMappings]) {
      if (!reconciliationExecutionInterfaceDoc.includes(token)) {
        issues.push(
          `[truth/repair-journey] 06-接口描述/05-reconciliation-execution.md missing CTA mapping token: ${token}`
        );
      }
    }
  }

  if (
    reconciliationServiceCode.includes(
      "const shouldKeepRuntimeState = ['solo_active', 'co_active', 'paused', 'completed', 'closed', 'replanning'].includes(track.status);"
    )
  ) {
    const inviteRuntimeStateMarkers = [
      'solo_active/co_active/paused/replanning/completed/closed',
      '不覆蓋運行態',
    ];
    for (const token of inviteRuntimeStateMarkers) {
      if (!reconciliationExecutionInterfaceDoc.includes(token)) {
        issues.push(
          `[truth/repair-journey] 06-接口描述/05-reconciliation-execution.md missing invite runtime-state marker: ${token}`
        );
      }
    }
  }

  if (
    executionServiceCode.includes('status: progressResult.status') &&
    executionServiceCode.includes('progress: progressResult.progress')
  ) {
    for (const token of ['`data.status`', '`data.progress`', '`data.plan_id`']) {
      if (!reconciliationExecutionInterfaceDoc.includes(token)) {
        issues.push(
          `[truth/repair-journey] 06-接口描述/05-reconciliation-execution.md missing execution status field token: ${token}`
        );
      }
    }
  }

  if (latestManualRegression) {
    for (const flowId of MANUAL_FLOW_IDS) {
      const summaryStatus = latestManualRegression.summaryStatuses[flowId] || 'MISSING';
      const recordStatus = latestManualRegression.recordStatuses[flowId] || 'MISSING';

      if (summaryStatus === 'MISSING') {
        issues.push(
          `[truth/manual-regression] summary.md (${latestManualRegression.latestDate}) missing status row for ${flowId}`
        );
      }
      if (recordStatus === 'MISSING') {
        issues.push(
          `[truth/manual-regression] record.md (${latestManualRegression.latestDate}) missing status for ${flowId}`
        );
      }
      if (summaryStatus !== 'MISSING' && recordStatus !== 'MISSING' && summaryStatus !== recordStatus) {
        issues.push(
          `[truth/manual-regression] status drift for ${flowId} (${latestManualRegression.latestDate}): summary=${summaryStatus}, record=${recordStatus}`
        );
      }
    }

    const allFlowsPassed = MANUAL_FLOW_IDS.every(
      (flowId) =>
        latestManualRegression.summaryStatuses[flowId] === 'PASS' &&
        latestManualRegression.recordStatuses[flowId] === 'PASS'
    );
    if (allFlowsPassed) {
      const staleManualRegressionPatterns = [
        {
          label: 'manual-regression-pending-row',
          pattern: /手動回歸結果尚未形成正式記錄\s*\|\s*待補/,
        },
        {
          label: 'manual-regression-pending-batch',
          pattern: /P01-P05\s*=\s*PENDING/,
        },
      ];
      for (const { label, pattern } of staleManualRegressionPatterns) {
        if (pattern.test(activeRiskDoc)) {
          issues.push(
            `[truth/risk] 07-待處理問題與治理/待處理/已知風險清單-2026-03-17.md contains stale manual-regression marker: ${label}`
          );
        }
      }
    }
  }

  if (frontendPackageJson.scripts?.['test:e2e:critical-guard']) {
    const expectedCriticalGuardCommand = 'npm run --workspace frontend test:e2e:critical-guard';
    const expectedSmokeCommand = 'npm run smoke:staging';
    const testingDocsToCheck = [
      ['08-測試規範與驗收/01-測試文檔分層與使用規則.md', testingRulesDoc],
      ['08-測試規範與驗收/02-AI流式與Chat治理驗收基線.md', testingAIGateDoc],
    ];

    for (const [docName, docContent] of testingDocsToCheck) {
      if (!docContent.includes(expectedCriticalGuardCommand)) {
        issues.push(`[truth/testing] ${docName} missing workspace command: ${expectedCriticalGuardCommand}`);
      }
      if (!docContent.includes(expectedSmokeCommand)) {
        issues.push(`[truth/testing] ${docName} missing root command: ${expectedSmokeCommand}`);
      }
    }
  }

  if (rootPackageJson.scripts?.['manual-regression:gate']) {
    const expectedGateCommand = 'npm run manual-regression:gate';
    const gateDocsToCheck = [
      ['08-測試規範與驗收/01-測試文檔分層與使用規則.md', testingRulesDoc],
      ['08-測試規範與驗收/02-AI流式與Chat治理驗收基線.md', testingAIGateDoc],
    ];
    for (const [docName, docContent] of gateDocsToCheck) {
      if (!docContent.includes(expectedGateCommand)) {
        issues.push(`[truth/testing] ${docName} missing manual regression gate command: ${expectedGateCommand}`);
      }
    }
  }

  if (
    manualGateScriptCode.includes("runStep('check-strict'") &&
    manualGateScriptCode.includes("runStep('summarize'")
  ) {
    if (
      !testingRulesDoc.includes('manual-regression:*') ||
      !testingRulesDoc.includes('manual-regression:gate')
    ) {
      issues.push(
        '[truth/testing] 08-測試規範與驗收/01-測試文檔分層與使用規則.md must describe manual-regression:* and manual-regression:gate usage'
      );
    }
  }

  if (
    criticalE2ESkipGuardCode.includes('criticalE2eFiles') &&
    criticalE2ESkipGuardCode.includes('skipPattern')
  ) {
    if (!testingAIGateDoc.includes('test:e2e:critical-guard')) {
      issues.push(
        '[truth/testing] 08-測試規範與驗收/02-AI流式與Chat治理驗收基線.md must mention critical E2E skip guard command'
      );
    }
  }

  if (
    aiStreamServiceCode.includes('Redis unavailable, falling back to in-memory runtime') &&
    aiStreamServiceCode.includes("getBackendMode(): 'redis' | 'memory'")
  ) {
    const runtimeDegradeMarkers = ['Redis 不可達', '降級 memory'];
    for (const token of runtimeDegradeMarkers) {
      if (!testingAIGateDoc.includes(token)) {
        issues.push(
          `[truth/testing] 08-測試規範與驗收/02-AI流式與Chat治理驗收基線.md missing runtime degrade marker: ${token}`
        );
      }
    }
  }

  if (activeRiskDoc.includes('原 `R-01（手動回歸結果尚未形成正式記錄）`')) {
    issues.push(
      '[truth/risk] 07-待處理問題與治理/待處理/已知風險清單-2026-03-17.md still uses duplicated R-01 label for historical manual-regression item'
    );
  }

  if (!activeRiskDoc.includes('R-MR-01')) {
    issues.push(
      '[truth/risk] 07-待處理問題與治理/待處理/已知風險清單-2026-03-17.md must retain historical manual-regression closure label as R-MR-01'
    );
  }

  if (outOfScopeIssueDoc.includes('`v1.3.1`')) {
    issues.push(
      '[truth/risk] 07-待處理問題與治理/不處理/不納入發版項清單-2026-03-17.md contains stale release label `v1.3.1`'
    );
  }

  if (!handledIssueLedgerDoc.includes('../../測試/回歸與驗收/發版前回歸記錄-2026-03-17.md')) {
    issues.push(
      '[truth/risk] 07-待處理問題與治理/已處理/業務缺陷收斂台帳-2026-03-17.md must link to ../../測試/回歸與驗收/發版前回歸記錄-2026-03-17.md'
    );
  }

  const workspacePlaywrightCommand = 'npm exec --workspace frontend -- playwright test -c e2e/playwright.config.ts';
  const staleRootChatPlaywrightPattern =
    /npm exec -- playwright test -c e2e\/playwright\.config\.ts[\s\S]{0,260}?e2e\/chat\//;
  const batch5CommandDocsRoots = ['07-待處理問題與治理', '08-測試規範與驗收', '測試'];
  const staleRootCommandDocs = [];
  for (const docsRoot of batch5CommandDocsRoots) {
    const docsUnderRoot = await collectFilesUnder(docsRoot, '.md');
    for (const relativePath of docsUnderRoot) {
      const docPath = path.posix.join(docsRoot, relativePath);
      const content = await readDoc(docPath);
      if (staleRootChatPlaywrightPattern.test(content)) {
        staleRootCommandDocs.push(docPath);
      }
      const testPathRefs = extractBacktickTestPathRefs(content);
      for (const testPathRef of testPathRefs) {
        const absTestPath = path.join(repoRoot, testPathRef);
        if (!(await pathExists(absTestPath))) {
          issues.push(
            `[truth/batch5-testing] ${docPath} references missing test file: ${testPathRef}`
          );
        }
      }
    }
  }
  for (const relativePath of staleRootCommandDocs) {
    issues.push(
      `[truth/batch5-testing] ${relativePath} contains stale root playwright + e2e/chat command without --workspace frontend`
    );
  }

  if (!handledIssueLedgerDoc.includes(workspacePlaywrightCommand)) {
    issues.push(
      '[truth/risk] 07-待處理問題與治理/已處理/業務缺陷收斂台帳-2026-03-17.md must use workspace playwright command: npm exec --workspace frontend -- playwright test -c e2e/playwright.config.ts'
    );
  }
  if (staleRootChatPlaywrightPattern.test(handledIssueLedgerDoc)) {
    issues.push(
      '[truth/risk] 07-待處理問題與治理/已處理/業務缺陷收斂台帳-2026-03-17.md contains stale root playwright + e2e/chat command without --workspace frontend'
    );
  }

  if (
    !testingReadmeDoc.includes('01-測試文檔分層與使用規則.md') ||
    !testingReadmeDoc.includes('02-AI流式與Chat治理驗收基線.md')
  ) {
    issues.push(
      '[truth/testing] 08-測試規範與驗收/README.md must expose both formal test-spec entries'
    );
  }

  const latestManualEvidenceSummary = '90-證據與盤點/手動回歸證據/2026-04-18/summary.md';
  const testEntryDocs = [
    ['測試/README.md', testingActiveEntryDoc],
    ['測試/回歸與驗收/README.md', testingRegressionReadmeDoc],
  ];
  for (const [docName, docContent] of testEntryDocs) {
    if (!docContent.includes(latestManualEvidenceSummary)) {
      issues.push(`[truth/testing] ${docName} must reference latest manual evidence summary: ${latestManualEvidenceSummary}`);
    }
    if (!docContent.includes('manual-regression:gate')) {
      issues.push(`[truth/testing] ${docName} must reference manual-regression:gate as active gate entry`);
    }
  }

  if (
    !testingRegressionRecordDoc.includes('結果（當時，2026-03-17）') ||
    !testingRegressionRecordDoc.includes('P01-P05 = PASS')
  ) {
    issues.push(
      '[truth/testing] 測試/回歸與驗收/發版前回歸記錄-2026-03-17.md must clearly mark historical status and link latest P01-P05 PASS context'
    );
  }

  if (!testingRegressionRecordDoc.includes(workspacePlaywrightCommand)) {
    issues.push(
      '[truth/testing] 測試/回歸與驗收/發版前回歸記錄-2026-03-17.md must use workspace playwright command: npm exec --workspace frontend -- playwright test -c e2e/playwright.config.ts'
    );
  }
  if (staleRootChatPlaywrightPattern.test(testingRegressionRecordDoc)) {
    issues.push(
      '[truth/testing] 測試/回歸與驗收/發版前回歸記錄-2026-03-17.md contains stale root playwright + e2e/chat command without --workspace frontend'
    );
  }

  if (
    rootPackageJson.scripts?.['manual-regression:init'] &&
    !testingManualRunbookDoc.includes('npm run manual-regression:init -- --date <YYYY-MM-DD>')
  ) {
    issues.push(
      '[truth/testing] 測試/回歸與驗收/發版前手動回歸執行版-2026-03-17.md must use <YYYY-MM-DD> placeholder for manual-regression:init'
    );
  }

  if (
    !testingManualRunbookDoc.includes('若本次批次不是 `2026-03-17`') ||
    !testingManualPackDoc.includes('若本次執行批次不是 `2026-03-17`')
  ) {
    issues.push(
      '[truth/testing] 手動回歸包/執行版 must explicitly require replacing historical date paths when running non-2026-03-17 batches'
    );
  }

  const quickScenarioFiles = (await collectFilesUnder('測試/活躍場景案例/quick-experience', '.md'))
    .filter((fileName) => fileName !== 'README.md')
    .map((fileName) => path.basename(fileName))
    .sort();
  const quickScenarioCountMatch = testingQuickExperienceReadmeDoc.match(/包含\s*([0-9]+)\s*份/);
  if (!quickScenarioCountMatch) {
    issues.push(
      '[truth/batch5-testing] 測試/活躍場景案例/quick-experience/README.md must declare case count with `包含 X 份`'
    );
  } else {
    const declaredCount = Number(quickScenarioCountMatch[1]);
    if (declaredCount !== quickScenarioFiles.length) {
      issues.push(
        `[truth/batch5-testing] quick-experience case count mismatch: docs=${declaredCount} files=${quickScenarioFiles.length}`
      );
    }
  }

  const quickScenarioTableNames = [...new Set(extractTableFirstColumnMarkdownNames(testingQuickExperienceReadmeDoc))].sort();
  for (const fileName of quickScenarioFiles) {
    if (!quickScenarioTableNames.includes(fileName)) {
      issues.push(
        `[truth/batch5-testing] quick-experience README table missing scenario row: ${fileName}`
      );
    }
  }
  for (const fileName of quickScenarioTableNames) {
    if (!quickScenarioFiles.includes(fileName)) {
      issues.push(
        `[truth/batch5-testing] quick-experience README table contains stale scenario row: ${fileName}`
      );
    }
  }

  const chatScenarioFiles = (await collectFilesUnder('測試/活躍場景案例/chat-room', '.md'))
    .filter((fileName) => fileName !== 'README.md')
    .map((fileName) => path.basename(fileName))
    .sort();
  const chatScenarioTableNames = [...new Set(extractTableFirstColumnMarkdownNames(testingChatRoomReadmeDoc))].sort();
  for (const fileName of chatScenarioFiles) {
    if (!chatScenarioTableNames.includes(fileName)) {
      issues.push(
        `[truth/batch5-testing] chat-room README table missing scenario row: ${fileName}`
      );
    }
  }
  for (const fileName of chatScenarioTableNames) {
    if (!chatScenarioFiles.includes(fileName)) {
      issues.push(
        `[truth/batch5-testing] chat-room README table contains stale scenario row: ${fileName}`
      );
    }
  }

  const activeScenarioReadmeTokens = ['quick-experience/README.md', 'chat-room/README.md'];
  for (const token of activeScenarioReadmeTokens) {
    if (!testingScenarioReadmeDoc.includes(token)) {
      issues.push(
        `[truth/batch5-testing] 測試/活躍場景案例/README.md missing active entry token: ${token}`
      );
    }
  }

  if (
    !testingChatRoomReadmeDoc.includes('backend/tests/unit/services/chat-ai-orchestrator.service.test.ts')
  ) {
    issues.push(
      '[truth/batch5-testing] 測試/活躍場景案例/chat-room/README.md must reference chat-ai-orchestrator unit test entry'
    );
  } else {
    const chatOrchestratorTestPath = path.join(
      repoRoot,
      'backend/tests/unit/services/chat-ai-orchestrator.service.test.ts'
    );
    if (!(await pathExists(chatOrchestratorTestPath))) {
      issues.push(
        '[truth/batch5-testing] chat-room README references missing file: backend/tests/unit/services/chat-ai-orchestrator.service.test.ts'
      );
    }
  }

  const regressionActiveDocs = [
    'Repair Journey 2.3 場景驗收矩陣.md',
    '未登入直連-回歸驗證清單.md',
    '發版前手動回歸包-2026-03-17.md',
    '發版前手動回歸執行版-2026-03-17.md',
  ];
  for (const fileName of regressionActiveDocs) {
    if (!testingRegressionReadmeDoc.includes(fileName)) {
      issues.push(`[truth/batch5-testing] 測試/回歸與驗收/README.md missing active entry: ${fileName}`);
    }
    const absFilePath = path.join(coreDocsRoot, '測試', '回歸與驗收', fileName);
    if (!(await pathExists(absFilePath))) {
      issues.push(`[truth/batch5-testing] 測試/回歸與驗收 missing active file on disk: ${fileName}`);
    }
  }

  const manualPackEvidenceRefs = [
    'frontend/e2e/chat/quick-experience-claim-session.e2e.ts',
    'backend/tests/integration/quick-experience.flow.test.ts',
    'scripts/smoke-production-like.sh',
    'scripts/smoke-claim-session-production-like.sh',
    'frontend/e2e/chat/judgment-handoff.e2e.ts',
    'frontend/e2e/chat/execution-flow.e2e.ts',
    'frontend/e2e/chat/interview-recovery-flow.e2e.ts',
    'frontend/e2e/chat/chat-failure-matrix.e2e.ts',
    'e2e/admin/admin-critical-flow.e2e.ts',
    'e2e/admin/admin-config-flow.e2e.ts',
  ];
  for (const relativePath of manualPackEvidenceRefs) {
    if (!testingManualPackDoc.includes(relativePath)) {
      issues.push(
        `[truth/batch5-testing] 測試/回歸與驗收/發版前手動回歸包-2026-03-17.md missing evidence reference: ${relativePath}`
      );
    }
    const absPath = path.join(repoRoot, relativePath);
    if (!(await pathExists(absPath))) {
      issues.push(`[truth/batch5-testing] manual-pack references missing file: ${relativePath}`);
    }
  }

  const runbookScriptTokens = [
    ['manual-regression:check:strict', 'npm run manual-regression:check:strict'],
    ['manual-regression:summarize', 'npm run manual-regression:summarize'],
    ['manual-regression:gate', 'npm run manual-regression:gate'],
    ['manual-regression:mark', 'npm run manual-regression:mark -- --date'],
  ];
  for (const [scriptName, commandToken] of runbookScriptTokens) {
    if (rootPackageJson.scripts?.[scriptName] && !testingManualRunbookDoc.includes(commandToken)) {
      issues.push(
        `[truth/batch5-testing] 測試/回歸與驗收/發版前手動回歸執行版-2026-03-17.md missing command token: ${commandToken}`
      );
    }
  }

  const frontendRouteMap = new Map(
    truth.frontend.frontendPageRoutes.map((route) => [route.fullPath, route])
  );
  const adminRouteSet = new Set(truth.frontend.adminExternalRoutes.map((route) => route.fullPath));
  const unauthChecklistExpectations = [
    { path: '/case/list', guard: 'ProtectedRoute' },
    { path: '/profile/settings', guard: 'ProtectedRoute' },
    { path: '/auth/login', guard: 'PublicRoute' },
  ];
  for (const expectation of unauthChecklistExpectations) {
    const route = frontendRouteMap.get(expectation.path);
    if (!route || route.guardType !== expectation.guard) {
      issues.push(
        `[truth/batch5-testing] 未登入直連清單依賴路由漂移: ${expectation.path} expected guard=${expectation.guard}`
      );
      continue;
    }
    if (!testingUnauthDirectChecklistDoc.includes(`\`${expectation.path}\``)) {
      issues.push(
        `[truth/batch5-testing] 測試/回歸與驗收/未登入直連-回歸驗證清單.md missing route token: ${expectation.path}`
      );
    }
  }

  const adminChecklistRoutes = ['/admin/login', '/admin/ops/jobs'];
  for (const routePath of adminChecklistRoutes) {
    if (!adminRouteSet.has(routePath)) {
      issues.push(`[truth/batch5-testing] 未登入直連清單依賴管理端路由不存在: ${routePath}`);
      continue;
    }
    if (!testingUnauthDirectChecklistDoc.includes(`\`${routePath}\``)) {
      issues.push(
        `[truth/batch5-testing] 測試/回歸與驗收/未登入直連-回歸驗證清單.md missing admin route token: ${routePath}`
      );
    }
  }

  const repairJourneyRoutes = [
    '/judgment/:id',
    '/reconciliation/:judgmentId',
    '/reconciliation/:judgmentId/:id',
    '/execution/dashboard',
    '/execution/:planId/checkin',
    '/execution/:planId/replan',
    '/notifications',
  ];
  for (const routePath of repairJourneyRoutes) {
    const route = frontendRouteMap.get(routePath);
    if (!route) {
      issues.push(`[truth/batch5-testing] Repair Journey matrix depends on missing frontend route: ${routePath}`);
      continue;
    }
    if (!testingRepairJourneyMatrixDoc.includes(`\`${routePath}\``)) {
      issues.push(
        `[truth/batch5-testing] 測試/回歸與驗收/Repair Journey 2.3 場景驗收矩陣.md missing route token: ${routePath}`
      );
    }
  }

  const repairJourneyTestRefs = [
    {
      filePath: 'backend/tests/unit/routes/notification.routes.test.ts',
      docTokens: ['backend/tests/unit/routes/notification.routes.test.ts', 'tests/unit/routes/notification.routes.test.ts'],
    },
    {
      filePath: 'backend/tests/unit/routes/reconciliation.routes.test.ts',
      docTokens: ['backend/tests/unit/routes/reconciliation.routes.test.ts', 'tests/unit/routes/reconciliation.routes.test.ts'],
    },
    {
      filePath: 'backend/tests/unit/services/reconciliation.service.test.ts',
      docTokens: ['backend/tests/unit/services/reconciliation.service.test.ts', 'tests/unit/services/reconciliation.service.test.ts'],
    },
    {
      filePath: 'backend/tests/unit/services/execution.service.test.ts',
      docTokens: ['backend/tests/unit/services/execution.service.test.ts', 'tests/unit/services/execution.service.test.ts'],
    },
    {
      filePath: 'frontend/src/services/api/notifications.test.ts',
      docTokens: ['frontend/src/services/api/notifications.test.ts', 'src/services/api/notifications.test.ts'],
    },
    {
      filePath: 'frontend/src/pages/Notifications/index.test.tsx',
      docTokens: ['frontend/src/pages/Notifications/index.test.tsx', 'src/pages/Notifications/index.test.tsx'],
    },
    {
      filePath: 'frontend/src/pages/Execution/Dashboard/index.test.tsx',
      docTokens: ['frontend/src/pages/Execution/Dashboard/index.test.tsx', 'src/pages/Execution/Dashboard/index.test.tsx'],
    },
    {
      filePath: 'frontend/src/pages/Reconciliation/Detail/index.test.tsx',
      docTokens: ['frontend/src/pages/Reconciliation/Detail/index.test.tsx', 'src/pages/Reconciliation/Detail/index.test.tsx'],
    },
    {
      filePath: 'frontend/src/pages/Reconciliation/List/index.test.tsx',
      docTokens: ['frontend/src/pages/Reconciliation/List/index.test.tsx', 'src/pages/Reconciliation/List/index.test.tsx'],
    },
  ];
  for (const { filePath, docTokens } of repairJourneyTestRefs) {
    if (!docTokens.some((token) => testingRepairJourneyMatrixDoc.includes(token))) {
      issues.push(
        `[truth/batch5-testing] Repair Journey matrix missing test reference: ${filePath}`
      );
    }
    if (!(await pathExists(path.join(repoRoot, filePath)))) {
      issues.push(`[truth/batch5-testing] Repair Journey matrix references missing file: ${filePath}`);
    }
  }

  const batch6DocPaths = (
    await Promise.all(
      ['90-證據與盤點', '99-歷史降級索引', '文件收斂'].map((dir) =>
        collectMarkdownDocsUnder(dir)
      )
    )
  )
    .flat()
    .sort();

  const batch6MetadataDocs = await Promise.all(
    batch6DocPaths.map(async (docName) => [docName, await readDoc(docName)])
  );

  for (const [docName, docContent] of batch6MetadataDocs) {
    if (!docContent.includes('CORE_DOC_AUDIT_METADATA:START')) {
      issues.push(`[truth/batch6] missing metadata header in ${docName}`);
    }
    if (/\*\*來源時間\*\*[：:]\s*`?未標註`?/.test(docContent) || /來源時間[：:]\s*`?未標註`?/.test(docContent)) {
      issues.push(`[truth/batch6] placeholder source time found in ${docName}: 來源時間=未標註`);
    }
    if (!docContent.includes('**SSOT 屬性**：非現行 SSOT')) {
      issues.push(`[truth/batch6] non-SSOT marker missing in ${docName}`);
    }
    if (!/\*\*最後核驗 Commit\*\*：`[^`]+`/.test(docContent)) {
      issues.push(`[truth/batch6] missing audited commit metadata in ${docName}`);
    }
    if (!/\*\*最後核驗日期\*\*：`[0-9]{4}-[0-9]{2}-[0-9]{2}`/.test(docContent)) {
      issues.push(`[truth/batch6] missing audited date metadata in ${docName}`);
    }
  }

  const evidenceSnapshotReadme =
    batch6MetadataDocs.find(([docName]) => docName === '90-證據與盤點/頁面HTML快照/README.md')?.[1] || '';
  if (
    !evidenceSnapshotReadme ||
    !evidenceSnapshotReadme.includes('scripts/export-static-pages.mjs') ||
    !evidenceSnapshotReadme.includes('manifest.json') ||
    !evidenceSnapshotReadme.includes('generated_at')
  ) {
    issues.push(
      '[truth/batch6] 90-證據與盤點/頁面HTML快照/README.md must keep script + manifest + generated_at traceability markers'
    );
  }

  let snapshotManifest = null;
  try {
    snapshotManifest = JSON.parse(snapshotManifestRaw);
  } catch {
    issues.push('[truth/batch6] 90-證據與盤點/頁面HTML快照/manifest.json must be valid JSON');
  }

  if (snapshotManifest) {
    const generatedAt = snapshotManifest.generated_at;
    if (typeof generatedAt !== 'string' || Number.isNaN(Date.parse(generatedAt))) {
      issues.push(
        '[truth/batch6] 90-證據與盤點/頁面HTML快照/manifest.json generated_at must be valid ISO timestamp'
      );
    }

    if (
      typeof generatedAt === 'string' &&
      evidenceSnapshotReadme &&
      !evidenceSnapshotReadme.includes(`manifest.json.generated_at = ${generatedAt}`)
    ) {
      issues.push(
        '[truth/batch6] 90-證據與盤點/頁面HTML快照/README.md must pin current manifest generated_at'
      );
    }

    if (!Array.isArray(snapshotManifest.frontend) || !Array.isArray(snapshotManifest.admin)) {
      issues.push(
        '[truth/batch6] 90-證據與盤點/頁面HTML快照/manifest.json must contain frontend[] and admin[] arrays'
      );
    } else {
      const snapshotHtmlFiles = await collectFilesUnder('90-證據與盤點/頁面HTML快照', '.html');
      const manifestEntries = [
        ...snapshotManifest.frontend.map((entry) => ({ ...entry, area: 'frontend' })),
        ...snapshotManifest.admin.map((entry) => ({ ...entry, area: 'frontend-admin' })),
      ];

      const diskFileSet = new Set(snapshotHtmlFiles);
      const manifestFileSet = new Set();
      const routeSet = new Set();

      for (const entry of manifestEntries) {
        if (!entry || typeof entry !== 'object') {
          issues.push('[truth/batch6] manifest entry must be object with file/route');
          continue;
        }

        const { file, route, area } = entry;
        if (typeof file !== 'string' || !file.endsWith('.html')) {
          issues.push('[truth/batch6] manifest entry file must be .html path string');
          continue;
        }
        if (typeof route !== 'string' || !route.startsWith('/')) {
          issues.push(`[truth/batch6] manifest route must start with '/': ${String(route)}`);
        }

        if (area === 'frontend' && !file.startsWith('frontend/')) {
          issues.push(`[truth/batch6] frontend manifest file must be under frontend/: ${file}`);
        }
        if (area === 'frontend-admin' && !file.startsWith('frontend-admin/')) {
          issues.push(
            `[truth/batch6] admin manifest file must be under frontend-admin/: ${file}`
          );
        }

        if (manifestFileSet.has(file)) {
          issues.push(`[truth/batch6] duplicate manifest file entry: ${file}`);
        }
        manifestFileSet.add(file);

        const routeKey = `${area}:${route}`;
        if (routeSet.has(routeKey)) {
          issues.push(`[truth/batch6] duplicate manifest route entry in ${area}: ${route}`);
        }
        routeSet.add(routeKey);

        if (!diskFileSet.has(file)) {
          issues.push(`[truth/batch6] manifest references missing html file: ${file}`);
        }
      }

      const missingInManifest = snapshotHtmlFiles.filter((file) => !manifestFileSet.has(file));
      if (missingInManifest.length > 0) {
        issues.push(
          `[truth/batch6] html files missing in manifest.json: ${missingInManifest.join(', ')}`
        );
      }
    }
  }

  if (issues.length > 0) {
    console.error('[docs-truth] drift detected:');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `[docs-truth] ok: ${truth.backend.endpoints.length} endpoints, ${truth.frontend.stats.totalRoutes} frontend routes, ${truth.frontend.adminExternalRoutes.length} admin routes, enum coverage verified, critical auth semantics verified, formal-doc ledger coverage+summary semantics verified, formal-doc metadata semantics verified, formal-doc metadata evidence-path semantics verified, formal-doc metadata path-policy semantics verified, formal-doc metadata non-doc-evidence semantics verified, formal-doc metadata tracked-or-script-wired semantics verified, formal-doc metadata wildcard-evidence semantics verified, formal-doc audited-commit resolve semantics verified, formal-doc audited-commit ancestry semantics verified, formal-doc audited-date chronology semantics verified, formal-doc audited-date non-future semantics verified, formal-doc last-update coherence semantics verified, formal-doc global path-reference semantics verified, batch-1 flagship path-reference semantics verified, batch-2 auth+user-flow semantics verified, batch-2/3 formal-doc path-reference semantics verified, batch-3 governance+architecture semantics verified, batch-4 interface path-reference semantics verified, admin+health semantics verified, content+notification semantics verified, risk semantics verified, testing semantics verified, batch-5 scenario+regression semantics verified, batch-6 metadata semantics verified, html-snapshot manifest consistency verified`
  );
}

main().catch((error) => {
  console.error('[docs-truth] failed to run');
  console.error(error);
  process.exitCode = 1;
});
