import fs from 'node:fs/promises';
import path from 'node:path';
import { extractCoreDocsTruth } from './lib/core-docs-truth.mjs';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const coreDocsRoot = path.join(repoRoot, 'docs', '核心開發文件');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readDoc(relativePath) {
  return fs.readFile(path.join(coreDocsRoot, relativePath), 'utf8');
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

  return { latestDate, summary };
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
    caseInterfaceDoc,
    judgmentInterfaceDoc,
    chatInterfaceDoc,
    contentNotificationInterfaceDoc,
    activeRiskDoc,
    testingRulesDoc,
    testingAIGateDoc,
    authOverviewDoc,
    caseServiceCode,
    chatServiceCode,
    validationCode,
    frontendPackageJsonRaw,
    evidenceRootReadme,
    evidenceEnvReadme,
    evidenceSnapshotReadme,
    evidenceManualReadme,
    evidenceAIReadme,
    historyRootReadme,
    historyMigrationIndexDoc,
    historyAppPlanDoc,
    governanceRootReadme,
    governanceRulesDoc,
    governanceBatchIndexDoc,
    governancePostSealDoc,
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
    readDoc(path.join('06-接口描述', '03-case.md')),
    readDoc(path.join('06-接口描述', '04-judgment.md')),
    readDoc(path.join('06-接口描述', '07-chat.md')),
    readDoc(path.join('06-接口描述', '08-content-notification.md')),
    readDoc(path.join('07-待處理問題與治理', '待處理', '已知風險清單-2026-03-17.md')),
    readDoc(path.join('08-測試規範與驗收', '01-測試文檔分層與使用規則.md')),
    readDoc(path.join('08-測試規範與驗收', '02-AI流式與Chat治理驗收基線.md')),
    readDoc(path.join('01-認證與會話', '00-認證與會話總覽.md')),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'case.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'services', 'chat.service.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'backend', 'src', 'utils', 'validation.ts'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'frontend', 'package.json'), 'utf8'),
    readDoc(path.join('90-證據與盤點', 'README.md')),
    readDoc(path.join('90-證據與盤點', '環境與發版驗證', 'README.md')),
    readDoc(path.join('90-證據與盤點', '頁面HTML快照', 'README.md')),
    readDoc(path.join('90-證據與盤點', '手動回歸證據', 'README.md')),
    readDoc(path.join('90-證據與盤點', 'AI流式驗證', 'README.md')),
    readDoc(path.join('99-歷史降級索引', 'README.md')),
    readDoc(path.join('99-歷史降級索引', '00-2026-04-首輪重構遷移索引.md')),
    readDoc(path.join('99-歷史降級索引', 'APP版本開發方案-ReactNative-Expo.md')),
    readDoc(path.join('文件收斂', 'README.md')),
    readDoc(path.join('文件收斂', '00-CJ-文檔治理與同步規則.md')),
    readDoc(path.join('文件收斂', '01-CJ-文檔收斂台賬與批次索引.md')),
    readDoc(path.join('文件收斂', '文檔封板後-代碼與測試對齊清單.md')),
  ]);
  const latestManualRegression = await readLatestManualRegressionSummary();
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

  if (latestManualRegression) {
    const flowIds = ['P01', 'P02', 'P03', 'P04', 'P05'];
    const allFlowsPassed = flowIds.every((flowId) =>
      new RegExp(`\\|\\s*${flowId}\\b[^\\n]*\\|\\s*PASS\\s*\\|`).test(latestManualRegression.summary)
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

  const batch6MetadataDocs = [
    ['90-證據與盤點/README.md', evidenceRootReadme],
    ['90-證據與盤點/環境與發版驗證/README.md', evidenceEnvReadme],
    ['90-證據與盤點/頁面HTML快照/README.md', evidenceSnapshotReadme],
    ['90-證據與盤點/手動回歸證據/README.md', evidenceManualReadme],
    ['90-證據與盤點/AI流式驗證/README.md', evidenceAIReadme],
    ['99-歷史降級索引/README.md', historyRootReadme],
    ['99-歷史降級索引/00-2026-04-首輪重構遷移索引.md', historyMigrationIndexDoc],
    ['99-歷史降級索引/APP版本開發方案-ReactNative-Expo.md', historyAppPlanDoc],
    ['文件收斂/README.md', governanceRootReadme],
    ['文件收斂/00-CJ-文檔治理與同步規則.md', governanceRulesDoc],
    ['文件收斂/01-CJ-文檔收斂台賬與批次索引.md', governanceBatchIndexDoc],
    ['文件收斂/文檔封板後-代碼與測試對齊清單.md', governancePostSealDoc],
  ];

  for (const [docName, docContent] of batch6MetadataDocs) {
    if (!docContent.includes('CORE_DOC_AUDIT_METADATA:START')) {
      issues.push(`[truth/batch6] missing metadata header in ${docName}`);
    }
    if (docContent.includes('來源時間：未標註')) {
      issues.push(`[truth/batch6] placeholder source time found in ${docName}: 來源時間：未標註`);
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

  if (
    !evidenceSnapshotReadme.includes('scripts/export-static-pages.mjs') ||
    !evidenceSnapshotReadme.includes('manifest.json') ||
    !evidenceSnapshotReadme.includes('generated_at')
  ) {
    issues.push(
      '[truth/batch6] 90-證據與盤點/頁面HTML快照/README.md must keep script + manifest + generated_at traceability markers'
    );
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
    `[docs-truth] ok: ${truth.backend.endpoints.length} endpoints, ${truth.frontend.stats.totalRoutes} frontend routes, ${truth.frontend.adminExternalRoutes.length} admin routes, enum coverage verified, critical auth semantics verified, content+notification semantics verified, risk semantics verified, testing semantics verified, batch-6 metadata semantics verified`
  );
}

main().catch((error) => {
  console.error('[docs-truth] failed to run');
  console.error(error);
  process.exitCode = 1;
});
