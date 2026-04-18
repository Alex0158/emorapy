import fs from 'node:fs/promises';
import path from 'node:path';
import { extractCoreDocsTruth } from './lib/core-docs-truth.mjs';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const coreDocsRoot = path.join(repoRoot, 'docs', '核心開發文件');
const MANUAL_FLOW_IDS = ['P01', 'P02', 'P03', 'P04', 'P05'];

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

function parseStatValue(content, label) {
  const statRe = new RegExp(`\\|\\s*${escapeRegExp(label)}\\s*\\|\\s*([0-9]+)\\s*\\|`);
  const match = content.match(statRe);
  return match ? Number(match[1]) : null;
}

function ensureRouteRow(content, route) {
  return content
    .split('\n')
    .some((line) => line.includes(route.fullPath) && line.includes(route.guardType));
}

function ensureAdminRouteRow(content, fullPath) {
  return content.split('\n').some((line) => line.includes(fullPath));
}

function ensureEndpointRow(content, endpoint) {
  return content
    .split('\n')
    .some((line) => line.includes(endpoint.method) && line.includes(endpoint.path));
}

function findEndpointRow(content, method, endpointPath) {
  const methodToken = `| ${method}`;
  const inlineMethodPathToken = `\`${method} ${endpointPath}\``;
  const pathToken = `\`${endpointPath}\``;
  return (
    content
      .split('\n')
      .find(
        (line) =>
          (line.includes(methodToken) && line.includes(pathToken)) || line.includes(inlineMethodPathToken)
      ) || null
  );
}

function isCoveredByGenericStreamDocs(endpointPath, content) {
  if (endpointPath !== '/api/v1/streams/:scopeType/:scopeId') {
    return false;
  }
  return ['case_judgment', 'repair_track', 'interview_session', 'chat_room'].every((scope) =>
    content.includes(`/api/v1/streams/${scope}/:id`) || content.includes(`/api/v1/streams/${scope}/:roomId`)
  );
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
    reconciliationExecutionInterfaceDoc,
    envBaselineDoc,
    commonMechanismDoc,
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
    authOverviewDoc,
    authServiceCode,
    sessionControllerCode,
    caseServiceCode,
    interviewServiceCode,
    chatServiceCode,
    reconciliationServiceCode,
    executionServiceCode,
    adminControllerCode,
    backendEnvCode,
    backendAppCode,
    healthRoutesCode,
    metricsRoutesCode,
    metaRoutesCode,
    aiStreamServiceCode,
    constantsCode,
    requestServiceCode,
    interviewStoreCode,
    validationCode,
    frontendVersionInfoCode,
    frontendAdminVersionInfoCode,
    manualGateScriptCode,
    criticalE2ESkipGuardCode,
    rootPackageJsonRaw,
    frontendPackageJsonRaw,
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
    readDoc(path.join('06-接口描述', '05-reconciliation-execution.md')),
    readDoc(path.join('03-管理端與平台治理', '01-環境與部署基線.md')),
    readDoc(path.join('04-共用機制', '00-共用機制總覽.md')),
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
    readDoc(path.join('01-認證與會話', '00-認證與會話總覽.md')),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'auth.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'controllers', 'session.controller.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'case.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'interview.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'chat.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'reconciliation.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'execution.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'controllers', 'admin.controller.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'config', 'env.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'app.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'routes', 'health.routes.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'routes', 'metrics.routes.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'routes', 'meta.routes.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'ai-stream.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'utils', 'constants.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'services', 'request.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'store', 'interviewStore.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'utils', 'validation.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'src', 'utils', 'versionInfo.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend-admin', 'src', 'utils', 'versionInfo.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'scripts', 'run-manual-regression-gate.mjs'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'scripts', 'check-critical-e2e-skips.mjs'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'package.json'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'package.json'), 'utf8'),
    fs.readFile(path.join(coreDocsRoot, '90-證據與盤點', '頁面HTML快照', 'manifest.json'), 'utf8'),
  ]);
  const latestManualRegression = await readLatestManualRegressionSummary();
  const rootPackageJson = JSON.parse(rootPackageJsonRaw);
  const frontendPackageJson = JSON.parse(frontendPackageJsonRaw);

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

  for (const endpoint of truth.backend.endpoints) {
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
    `[docs-truth] ok: ${truth.backend.endpoints.length} endpoints, ${truth.frontend.stats.totalRoutes} frontend routes, ${truth.frontend.adminExternalRoutes.length} admin routes, enum coverage verified, critical auth semantics verified, admin+health semantics verified, content+notification semantics verified, risk semantics verified, testing semantics verified, batch-6 metadata semantics verified, html-snapshot manifest consistency verified`
  );
}

main().catch((error) => {
  console.error('[docs-truth] failed to run');
  console.error(error);
  process.exitCode = 1;
});
