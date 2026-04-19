import fs from 'node:fs/promises';
import path from 'node:path';
import { extractCoreDocsTruth } from './lib/core-docs-truth.mjs';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const coreDocsRoot = path.join(repoRoot, 'docs', '核心開發文件');
const MANUAL_FLOW_IDS = ['P01', 'P02', 'P03', 'P04', 'P05'];
const API_STATUS_VALUES = new Set(['已使用', '候選廢棄', '已確認廢棄']);
const GENERIC_STREAM_DOC_ENDPOINTS = [
  '/api/v1/streams/case_judgment/:id',
  '/api/v1/streams/repair_track/:id',
  '/api/v1/streams/interview_session/:id',
  '/api/v1/streams/chat_room/:roomId',
];

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

function stripInlineCodeToken(value) {
  return value.replace(/^`|`$/g, '').trim();
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
    `[docs-truth] ok: ${truth.backend.endpoints.length} endpoints, ${truth.frontend.stats.totalRoutes} frontend routes, ${truth.frontend.adminExternalRoutes.length} admin routes, enum coverage verified, critical auth semantics verified, batch-2 auth+user-flow semantics verified, batch-3 governance+architecture semantics verified, admin+health semantics verified, content+notification semantics verified, risk semantics verified, testing semantics verified, batch-5 scenario+regression semantics verified, batch-6 metadata semantics verified, html-snapshot manifest consistency verified`
  );
}

main().catch((error) => {
  console.error('[docs-truth] failed to run');
  console.error(error);
  process.exitCode = 1;
});
