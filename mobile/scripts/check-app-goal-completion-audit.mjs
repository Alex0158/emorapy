import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectReleaseEnvFileArgs, loadReleaseEnvFilesFromArgs } from './lib/release-env-file.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');
try {
  loadReleaseEnvFilesFromArgs(process.argv.slice(2), {
    roots: [process.cwd(), mobileRoot, repoRoot],
  });
} catch (error) {
  console.error(`[goal-completion-audit] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
const strict = process.argv.includes('--strict');
const json = process.argv.includes('--json');
const releaseEnvFileArgs = collectReleaseEnvFileArgs(process.argv.slice(2));
const reportDirArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--report-dir='));
const reportDir = reportDirArg
  ? path.resolve(process.cwd(), reportDirArg.slice('--report-dir='.length))
  : null;

const objective =
  '完成 Emorapy App 版全面開發：以 Expo + React Native + TypeScript、iOS 優先且 Android 兼容為主線，按 App PRD / M0-M6 Roadmap 逐步完成普通用戶 App 的 Quick、Auth/Session、Profile/Interview、Chat、Formal Case/Judgment/Repair、Push/Deep Link、Media Upload、Telemetry、UI/UX、測試驗收與核心文件/進度回寫。';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function readJsonIfExists(relativePath) {
  if (!relativePath || !exists(relativePath)) return null;
  try {
    return readJson(relativePath);
  } catch {
    return null;
  }
}

function readText(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath))
    ? fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
    : '';
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function anyExists(relativePaths) {
  return relativePaths.some(exists);
}

function allExist(relativePaths) {
  return relativePaths.every(exists);
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function fileIncludes(relativePath, needles) {
  return includesAll(readText(relativePath), needles);
}

function runNodeScript(relativePath, args = []) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, relativePath), ...args], {
    cwd: mobileRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
    },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function tail(value, max = 1200) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  const slice = text.slice(text.length - max);
  const firstNewline = slice.indexOf('\n');
  return firstNewline >= 0 ? slice.slice(firstNewline + 1).trim() : slice;
}

function listLatest(prefix) {
  const evidenceRoot = path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證');
  if (!fs.existsSync(evidenceRoot)) return null;
  const match = fs
    .readdirSync(evidenceRoot)
    .filter((entry) => entry.startsWith(prefix))
    .sort()
    .reverse()[0];
  return match ? `docs/核心開發文件/90-證據與盤點/環境與發版驗證/${match}` : null;
}

function safeTimestamp(value) {
  return String(value).replace(/[:.]/g, '-');
}

function writeReportIfRequested(audit) {
  if (!reportDir) return null;
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `App-Goal-Completion-Audit-${safeTimestamp(audit.generated_at)}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(audit, null, 2)}\n`);
  return reportPath;
}

const mobilePkg = readJson('mobile/package.json');
const scripts = mobilePkg.scripts ?? {};
const deps = {
  ...(mobilePkg.dependencies ?? {}),
  ...(mobilePkg.devDependencies ?? {}),
};
const roadmap = readText('docs/核心開發文件/20-App端/03-App完整版本開發Roadmap.md');
const prd = readText('docs/核心開發文件/20-App端/02-App完整版本工程PRD.md');
const appOverview = readText('docs/核心開發文件/20-App端/00-App端總覽.md');
const testBaseline = readText('docs/核心開發文件/08-測試規範與驗收/03-App測試與證據接入基線.md');
const releaseDoc = readText('docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md');
const goalDoc = readText('docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md');
const pendingLedger = readText('docs/核心開發文件/07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md');
const externalSignoffPending = readText('docs/核心開發文件/07-待處理問題與治理/待處理/App外部ReleaseSignoff待辦-2026-05-16.md');
const copyCheckSource = readText('mobile/scripts/check-user-copy-contracts.mjs');
const externalStatusContractSource = readText('mobile/scripts/check-release-external-evidence-status-contract.mjs');
const prereqReportContractSource = readText('mobile/scripts/check-release-external-signoff-prerequisite-report.mjs');
const externalSignoffSource = readText('mobile/scripts/run-release-external-evidence-signoff.mjs');
const trueServiceSmokeSource = readText('mobile/scripts/app-true-service-smoke.mjs');
const trueServiceContractSource = readText('mobile/scripts/check-app-true-service-smoke-contracts.mjs');
const githubSecretsSyncContractSource = readText('mobile/scripts/check-release-github-secret-sync-contract.mjs');
const externalStatusContractNeedles = [
  'release:external-evidence:validate -- --physical-platform=ios',
  'release:external-evidence:run -- --physical-platform=ios',
  'APP_IOS_DEVICE_APP_PATH=<signed-app-path>',
  'release:external-evidence:validate -- --physical-platform=android',
  'release:external-evidence:run -- --physical-platform=android',
  'APP_ANDROID_DEVICE_SERIAL=<physical-device-serial>',
  'env_files.values_redacted',
  'env_files.loaded',
  'release:completion:audit:strict',
];
const prereqReportContractNeedles = [
  "expectedPhysicalPlatform = 'ios'",
  'android-validate-only',
  'Android validate blocks on device visibility',
  'placeholder-env-file',
  'REPLACE_WITH_ placeholders must not satisfy release prerequisites',
  'unsafe env-file keys are rejected',
  'unsupported --release-env-file key: NODE_OPTIONS',
  'device_visibility.android',
  'android_physical_device_visible',
  'requested_device_visible',
];
const externalSignoffEnvFileNeedles = [
  '--release-env-file=',
  'allowedReleaseEnvFileKeys',
  'unsupported --release-env-file key',
  'isPlaceholderValue',
  'REPLACE_WITH_',
  'loaded_keys',
];

function parseJsonOutput(result) {
  try {
    return JSON.parse(result.stdout || '');
  } catch {
    return null;
  }
}

function formatReleaseSignoffCaveat(releaseCompletionAudit, strictResult) {
  if (strictResult.status === 0) return null;

  const sections = [];
  if (Array.isArray(releaseCompletionAudit?.blocker_ids) && releaseCompletionAudit.blocker_ids.length > 0) {
    sections.push(`blocker_ids: ${releaseCompletionAudit.blocker_ids.join(', ')}`);
  }
  if (
    Array.isArray(releaseCompletionAudit?.handoff_blocker_ids) &&
      releaseCompletionAudit.handoff_blocker_ids.length > 0
  ) {
    sections.push(`handoff_blocker_ids: ${releaseCompletionAudit.handoff_blocker_ids.join(', ')}`);
  }
  if (releaseSignoffDetails.prerequisite_only_blocker_ids.length > 0) {
    sections.push(`prerequisite_only_blocker_ids: ${releaseSignoffDetails.prerequisite_only_blocker_ids.join(', ')}`);
  }
  if (releaseSignoffDetails.latest_external_handoff_path) {
    sections.push(`external_handoff: ${releaseSignoffDetails.latest_external_handoff_path}`);
  }
  if (Array.isArray(releaseCompletionAudit?.warnings) && releaseCompletionAudit.warnings.length > 0) {
    sections.push(`warnings:\n- ${releaseCompletionAudit.warnings.join('\n- ')}`);
  }
  if (Array.isArray(releaseCompletionAudit?.blockers) && releaseCompletionAudit.blockers.length > 0) {
    sections.push(`blockers:\n- ${releaseCompletionAudit.blockers.join('\n- ')}`);
  }
  if (Array.isArray(releaseCompletionAudit?.failures) && releaseCompletionAudit.failures.length > 0) {
    sections.push(`failures:\n- ${releaseCompletionAudit.failures.join('\n- ')}`);
  }

  if (sections.length > 0) return sections.join('\n');
  return tail(`${strictResult.stdout}\n${strictResult.stderr}`, 2000);
}

function buildReleaseSignoffDetails(releaseCompletionAudit, strictResult, handoffPath, handoff) {
  const handoffItems = Array.isArray(handoff?.items) ? handoff.items : [];
  const idsByFlag = (flagName) => [
    ...new Set(
      handoffItems
        .filter((entry) => entry?.[flagName] === true && typeof entry.blocker_id === 'string' && entry.blocker_id.length > 0)
        .map((entry) => entry.blocker_id)
    ),
  ];

  return {
    release_audit_type: typeof releaseCompletionAudit?.type === 'string' ? releaseCompletionAudit.type : null,
    release_audit_complete: releaseCompletionAudit?.complete === true,
    release_audit_strict_exit_code: strictResult.status ?? 1,
    blocker_ids: Array.isArray(releaseCompletionAudit?.blocker_ids) ? releaseCompletionAudit.blocker_ids : [],
    handoff_blocker_ids: Array.isArray(releaseCompletionAudit?.handoff_blocker_ids)
      ? releaseCompletionAudit.handoff_blocker_ids
      : [],
    latest_external_handoff_path: handoffPath,
    prerequisite_only_blocker_ids: idsByFlag('prerequisite_only'),
    release_completion_handoff_blocker_ids: idsByFlag('release_completion_blocker'),
    handoff_summary: handoff?.summary ?? null,
    source_release_completion_audit_generated_at:
      typeof handoff?.source_release_completion_audit_generated_at === 'string'
        ? handoff.source_release_completion_audit_generated_at
        : null,
  };
}

const releaseCompletionAuditResult = runNodeScript('mobile/scripts/check-release-completion-audit.mjs', [
  '--json',
  ...releaseEnvFileArgs,
]);
const releaseCompletionAudit = parseJsonOutput(releaseCompletionAuditResult);
const releaseStrict = runNodeScript('mobile/scripts/check-release-completion-audit.mjs', [
  '--strict',
  ...releaseEnvFileArgs,
]);
const latestExternalHandoffPath = listLatest('App-External-Evidence-Handoff-');
const latestExternalHandoff = readJsonIfExists(latestExternalHandoffPath);
const releaseSignoffDetails = buildReleaseSignoffDetails(
  releaseCompletionAudit,
  releaseStrict,
  latestExternalHandoffPath,
  latestExternalHandoff
);
const requiredGoalGateScripts = [
  'test',
  'routes:check',
  'features:check',
  'true-service:check',
  'web:routes:smoke',
  'maestro:check',
  'native:check',
  'android:check',
  'docs:check',
  'docs:audit:dry-run:current',
  'device-discovery:check',
  'release:evidence:check',
  'release:external-evidence:status',
  'release:external-evidence:status:contract',
  'release:external-evidence:fixtures:check',
  'release:external-evidence:handoff:check',
  'release:external-evidence:handoff:contract',
  'release:external-evidence:prereq-report:check',
  'release:external-evidence:workflow:check',
  'release:external-evidence:env-template:check',
  'release:external-evidence:input-status',
  'release:external-evidence:github-secrets:sync:contract',
  'release:external-evidence:signoff',
  'release:external-evidence:signoff:android-dry-run',
  'release:completion:audit',
  'release:completion:audit:contract',
  'goal:completion:audit:contract',
];

function check(id, requirement, evidence, passed, caveat = null, details = null) {
  const entry = {
    id,
    requirement,
    evidence,
    status: passed ? 'passed' : 'missing_or_incomplete',
    caveat,
  };
  if (details) entry.details = details;
  return entry;
}

const trueServiceSmokeNeedlesByMilestone = {
  m1: [
    "addStep(report, 'm1.quick_case_create', 'passed'",
    "addStep(report, 'm1.claim_session', 'passed'",
    "addStep(report, 'm1.case_judgment_stream_replay', 'passed'",
    "addStep(report, 'm1.expired_submit_session_recovered', 'passed'",
    "addStep(report, 'm1.expired_result_access_rejected', 'passed'",
    "addStep(report, 'm1.expired_claim_session_ignored', 'passed'",
  ],
  m2: [
    "addStep(report, 'm2.interview_response_complete', 'passed'",
    "addStep(report, 'm2.my_story_completion', 'passed'",
    "addStep(report, 'm2.failed_session_retry_accept', 'passed'",
    "addStep(report, 'm2.partial_success_retry_rejected', 'passed'",
  ],
  m3: [
    "addStep(report, 'm3.room_create', 'passed'",
    "addStep(report, 'm3.invite_accept', 'passed'",
    "addStep(report, 'm3.request_judgment', 'passed'",
  ],
  m4: [
    "stepPrefix: 'm4'",
    '`${stepPrefix}.evidence_upload`',
    "addStep(report, 'm4.repair_plan_select', 'passed'",
    "addStep(report, 'm4.execution_confirm', 'passed'",
    "addStep(report, 'm4.repair_track_replan_stream', 'passed'",
  ],
  m5: [
    "addStep(report, 'm5.push_token_register', 'passed'",
    "addStep(report, 'm5.notification_act', 'passed'",
    "addStep(report, 'm5.upload_case_create', 'passed'",
    "stepPrefix: 'm5'",
    "addStep(report, 'm5.telemetry_ingest', 'passed'",
    "addStep(report, 'm5.push_token_revoke', 'passed'",
  ],
};

function hasTrueServiceSmokeContract(milestone) {
  return includesAll(trueServiceSmokeSource, trueServiceSmokeNeedlesByMilestone[milestone] ?? []);
}

const checklist = [
  check(
    'tech_stack',
    'Expo + React Native + TypeScript is the App implementation stack.',
    [
      'mobile/package.json dependencies: expo, react-native, typescript',
      'mobile/app.json',
      'mobile/tsconfig.json',
    ],
    Boolean(deps.expo && deps['react-native'] && deps.typescript && exists('mobile/app.json') && exists('mobile/tsconfig.json'))
  ),
  check(
    'ios_first_android_compatible',
    'The App is iOS-first and Android-compatible, not a Web wrapper.',
    [
      'mobile/app.json iOS bundle + Android package',
      'mobile/eas.json',
      listLatest('App-Android-Toolchain-') ?? 'missing Android toolchain evidence',
      listLatest('App-Android-Maestro-') ?? 'missing Android Maestro evidence',
      listLatest('App-iOS-Release-Simulator-') ?? 'missing iOS Release simulator evidence',
    ],
    allExist(['mobile/app.json', 'mobile/eas.json']) &&
      Boolean(listLatest('App-Android-Toolchain-')) &&
      Boolean(listLatest('App-Android-Maestro-')) &&
      Boolean(listLatest('App-iOS-Release-Simulator-')),
    'External EAS / TestFlight / physical device evidence remains separate.'
  ),
  check(
    'm0_foundation',
    'M0 Foundation shell, route groups, providers, adapters, smoke gates are present.',
    [
      'mobile/app/_layout.tsx',
      'mobile/app/(public)',
      'mobile/app/(app)',
      'mobile/src/platform',
      'mobile/src/providers',
      'mobile/scripts/check-app-route-contracts.mjs',
      'mobile/scripts/check-platform-boundaries.mjs',
      'mobile/scripts/check-maestro-flows.mjs',
    ],
    allExist([
      'mobile/app/_layout.tsx',
      'mobile/app/(public)',
      'mobile/app/(app)',
      'mobile/src/platform',
      'mobile/src/providers',
      'mobile/scripts/check-app-route-contracts.mjs',
      'mobile/scripts/check-platform-boundaries.mjs',
      'mobile/scripts/check-maestro-flows.mjs',
    ])
  ),
  check(
    'm1_quick_auth',
    'M1 Quick + Auth / Session screens, clients, and tests are present.',
    [
      'mobile/src/features/m1',
      'mobile/__tests__/m1-screens.test.js',
      'packages/api-client/src/m1.ts',
      'mobile/maestro/10-quick-auth-form-smoke.yaml',
      'M1 true-service smoke harness contract: quick case, claim-session, case_judgment replay, expired session recovery',
    ],
    allExist([
      'mobile/src/features/m1',
      'mobile/__tests__/m1-screens.test.js',
      'packages/api-client/src/m1.ts',
      'mobile/maestro/10-quick-auth-form-smoke.yaml',
    ]) && hasTrueServiceSmokeContract('m1')
  ),
  check(
    'm2_profile_interview',
    'M2 Profile + Interview screens, AI stream recovery tests, and shared client are present.',
    [
      'mobile/src/features/m2',
      'mobile/__tests__/m2-screens.test.js',
      'packages/api-client/src/m2.ts',
      'mobile/maestro/40-profile-interview-auth-gate-smoke.yaml',
      'M2 true-service smoke harness contract: deep interview, failed-session retry, partial-success rejection',
    ],
    allExist([
      'mobile/src/features/m2',
      'mobile/__tests__/m2-screens.test.js',
      'packages/api-client/src/m2.ts',
      'mobile/maestro/40-profile-interview-auth-gate-smoke.yaml',
    ]) && hasTrueServiceSmokeContract('m2')
  ),
  check(
    'm3_chat',
    'M3 Chat room, invite, message stream, AI draft, judgment request artifacts are present.',
    [
      'mobile/src/features/m3',
      'mobile/__tests__/m3-screens.test.js',
      'packages/api-client/src/m3.ts',
      'mobile/maestro/20-chat-entry-auth-gate-smoke.yaml',
      'M3 true-service smoke harness contract: room/message/invite accept/request judgment',
    ],
    allExist([
      'mobile/src/features/m3',
      'mobile/__tests__/m3-screens.test.js',
      'packages/api-client/src/m3.ts',
      'mobile/maestro/20-chat-entry-auth-gate-smoke.yaml',
    ]) && hasTrueServiceSmokeContract('m3')
  ),
  check(
    'm4_formal_case_repair',
    'M4 Formal Case / Judgment / Repair Journey screens, stream recovery, and smoke artifacts are present.',
    [
      'mobile/src/features/m4',
      'mobile/__tests__/m4-screens.test.js',
      'packages/api-client/src/m4.ts',
      'mobile/maestro/50-case-repair-auth-gate-smoke.yaml',
      'M4 true-service smoke harness contract: formal evidence upload, plan select, execution confirm, replan stream',
    ],
    allExist([
      'mobile/src/features/m4',
      'mobile/__tests__/m4-screens.test.js',
      'packages/api-client/src/m4.ts',
      'mobile/maestro/50-case-repair-auth-gate-smoke.yaml',
    ]) && hasTrueServiceSmokeContract('m4')
  ),
  check(
    'm5_push_deeplink_upload_telemetry',
    'M5 Push / Deep Link / Media Upload / Telemetry artifacts are present.',
    [
      'mobile/src/features/m5',
      'mobile/src/platform/notifications/native.ts',
      'mobile/src/platform/linking',
      'mobile/src/platform/upload/native.ts',
      'mobile/src/platform/telemetry',
      'backend/src/routes/app-telemetry.routes.ts',
      'backend/src/services/app-telemetry.service.ts',
      'backend/src/services/push-notification.service.ts',
      'backend/src/routes/app-telemetry.routes.ts /telemetry/otlp/v1/traces safe OTLP collector baseline',
      'mobile/scripts/run-telemetry-runtime-smoke.mjs telemetry runtime evidence runner',
      'release:completion:audit validates App telemetry runtime pass evidence and release backend version commit alignment',
      'M5 true-service smoke harness contract: push token lifecycle, notification actions, upload/delete, telemetry ingest',
    ],
    allExist([
      'mobile/src/features/m5',
      'mobile/src/platform/notifications/native.ts',
      'mobile/src/platform/linking',
      'mobile/src/platform/upload/native.ts',
      'mobile/src/platform/telemetry',
      'backend/src/routes/app-telemetry.routes.ts',
      'backend/src/services/app-telemetry.service.ts',
      'backend/src/services/push-notification.service.ts',
    ]) &&
      fileIncludes('mobile/src/platform/telemetry/client.ts', ['/telemetry/otlp/v1/traces', 'resourceSpans']) &&
      fileIncludes('backend/src/routes/app-telemetry.routes.ts', ['/telemetry/otlp/v1/traces']) &&
      fileIncludes('backend/src/services/app-telemetry.service.ts', ['recordOtlpTraces', 'otlpCollector']) &&
      hasTrueServiceSmokeContract('m5'),
    'Provider delivery, physical-device notification landing, native selected media, and native crash runtime remain external evidence items.'
  ),
  check(
    'ui_ux_accessibility',
    'UI/UX and accessibility gates are present for App screens.',
    [
      'mobile/src/ui',
      'mobile/scripts/check-accessibility-contracts.mjs',
      'mobile/scripts/check-user-copy-contracts.mjs',
      'mobile/src/features/m2/labels.ts visible copy module scan',
      'mobile/src/ui/components.test.js',
      'script accessibility:check',
      'script copy:check',
    ],
    allExist([
      'mobile/src/ui',
      'mobile/scripts/check-accessibility-contracts.mjs',
      'mobile/scripts/check-user-copy-contracts.mjs',
      'mobile/src/features/m2/labels.ts',
      'mobile/src/ui/components.test.js',
    ]) &&
      includesAll(copyCheckSource, [
        "const scannedRoots = ['app', 'src/ui', 'src/features'];",
        'isVisibleCopyModule',
        'visible copy module',
        'relationship_history',
      ]) &&
      fileIncludes('mobile/src/features/m2/labels.test.js', ['not.toMatch', 'relationship_history']) &&
      Boolean(scripts['accessibility:check']) &&
      Boolean(scripts['copy:check'])
  ),
  check(
    'tests_and_gates',
    'Jest, RNTL, feature coverage contracts, true-service smoke contract gate, web route smoke, Maestro, native readiness, Android readiness, core-doc checks, release evidence, shared external evidence policy, status / fixture / handoff / env / workflow / GitHub secret sync contracts, and preflight gates are wired.',
    [
      'mobile/package.json scripts test / routes:check / features:check / true-service:check / web:routes:smoke / maestro:check / native:check / android:check / docs:check / docs:audit:dry-run:current / release:external-evidence:status:contract / release:external-evidence:fixtures:check / release:external-evidence:handoff:check / release:external-evidence:handoff:contract / release:external-evidence:prereq-report:check / release:external-evidence:workflow:check / release:external-evidence:env-template:check / release:external-evidence:input-status / release:external-evidence:github-secrets:sync:contract / release:external-evidence:signoff / release:external-evidence:signoff:android-dry-run / release:completion:audit:contract / release:preflight',
      'release:preflight command includes each required App gate script',
      'docs:check and docs:audit:dry-run:current keep core document structure, truth checks, stale App status guard, and current SSOT metadata in the App preflight path',
      'mobile/scripts/check-app-feature-coverage-contracts.mjs feature milestone coverage contract',
      'mobile/scripts/check-app-true-service-smoke-contracts.mjs M1-M5 true-service smoke harness contract',
      'mobile/scripts/lib/release-evidence-policy.mjs shared external evidence policy',
      'mobile/scripts/run-telemetry-runtime-smoke.mjs App telemetry runtime event + OTLP release evidence runner',
      'release:completion:audit:contract covers app-release-completion-audit JSON schema, blocker_ids / status-scoped handoff_blocker_ids consistency, checks[].handoff_catalog_ids mapping, external handoff coverage, strict exit-code consistency, required release blocker ids, and preflight wiring',
      'release:evidence:check validates App-External-Evidence-Status-*.json and App-External-Evidence-Handoff-*.json identity, blocker alignment, status env_files redaction/provenance schema, current release completion audit handoff_blocker_ids coverage, release/prerequisite classification, timestamp coherence, command coverage, final gates, and docs references',
      'release:external-evidence:status:contract covers iOS/Android platform-specific validate/run next commands, signed app path, Android serial, and strict audit gate',
      'release:external-evidence:prereq-report:check covers iOS/Android device_visibility, Android physical-device validate, env-file placeholder guard, and env-file key allowlist',
      'release:external-evidence:github-secrets:sync:contract covers local-only redacted dry-run, current-completion/evidence-refresh grouping, DATABASE_URL and ASC private key mapping, controlled secret redaction, and apply-only GitHub dependency',
      listLatest('App-Native-Maestro-') ?? 'missing App-Native-Maestro evidence',
      listLatest('App-Android-Maestro-') ?? 'missing App-Android-Maestro evidence',
    ],
    Boolean(scripts['release:preflight']) &&
      requiredGoalGateScripts.every((scriptName) => Boolean(scripts[scriptName])) &&
      requiredGoalGateScripts.every((scriptName) => scripts['release:preflight'].includes(scriptName)) &&
      exists('mobile/scripts/check-app-feature-coverage-contracts.mjs') &&
      includesAll(trueServiceContractSource, [
        'm1.case_judgment_stream_replay',
        'm2.partial_success_retry_rejected',
        'm3.request_judgment',
        'm4.repair_track_replan_stream',
        'm5.telemetry_ingest',
        'release:preflight must include true-service:check',
      ]) &&
      fileIncludes('mobile/scripts/lib/release-evidence-policy.mjs', [
        'buildReleaseEvidencePolicies',
        'validateEvidenceAgainstPolicy',
        'summarizeEvidenceCandidate',
        'telemetry_runtime',
      ]) &&
      Boolean(scripts['telemetry:runtime:smoke']) &&
      scripts['release:external-evidence:dry-run']?.includes('telemetry:runtime:smoke -- --dry-run') &&
      fileIncludes('mobile/scripts/check-release-evidence.mjs', [
        "findEvidenceByPrefix('App-External-Evidence-Status-', ['.json'])",
        "findEvidenceByPrefix('App-External-Evidence-Handoff-', ['.json'])",
        'requireSameIdSet',
        'env_files.values_redacted',
        'env_files.loaded',
        'external status blockers and handoff items',
        'release:external-evidence:validate -- --physical-platform=ios',
        'release:external-evidence:validate -- --physical-platform=android',
        'goal completion audit doc',
      ]) &&
      includesAll(externalStatusContractSource, externalStatusContractNeedles) &&
      includesAll(prereqReportContractSource, prereqReportContractNeedles) &&
      includesAll(externalSignoffSource, externalSignoffEnvFileNeedles) &&
      includesAll(githubSecretsSyncContractSource, [
        'dry-run is local-only',
        "PATH: ''",
        'ready_for_current_completion_sync_inputs',
        'ready_for_evidence_refresh_sync_inputs',
        'APP_RELEASE_DATABASE_URL',
        'APP_STORE_CONNECT_PRIVATE_KEY',
        'CONTROLLED_EXPO_TOKEN_DO_NOT_LEAK',
        'apply attempt without gh',
      ]) &&
      Boolean(listLatest('App-Native-Maestro-')) &&
      Boolean(listLatest('App-Android-Maestro-'))
  ),
  check(
    'docs_progress_rewrite',
    'Core App PRD, Roadmap, test baseline, release evidence, and pending ledger are updated.',
    [
      'docs/核心開發文件/20-App端/02-App完整版本工程PRD.md',
      'docs/核心開發文件/20-App端/03-App完整版本開發Roadmap.md',
      'docs/核心開發文件/08-測試規範與驗收/03-App測試與證據接入基線.md',
      'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md',
      'docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md',
      'docs/核心開發文件/07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md',
      'docs/核心開發文件/07-待處理問題與治理/待處理/App外部ReleaseSignoff待辦-2026-05-16.md',
    ],
    Boolean(prd && roadmap && testBaseline && releaseDoc && goalDoc && pendingLedger && externalSignoffPending) &&
      includesAll(roadmap, ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']) &&
      includesAll(releaseDoc, ['goal:completion:audit', 'release:completion:audit:strict', 'physical device', 'TestFlight']) &&
      includesAll(testBaseline, ['goal:completion:audit', 'release:completion:audit:strict']) &&
      includesAll(pendingLedger, ['goal:completion:audit', 'release:completion:audit:strict']) &&
      includesAll(externalSignoffPending, [
        'release:external-evidence:github-secrets:strict',
        'release:external-evidence:github-secrets:sync:contract',
        'release:completion:audit:strict',
        'ready_for_workflow_validate=false',
      ])
  ),
  check(
    'release_signoff',
    'Release sign-off strict audit must pass before the goal can be called complete.',
    [
      'mobile/scripts/check-release-completion-audit.mjs --strict',
      'npm --prefix mobile run release:completion:audit:strict',
    ],
    releaseStrict.status === 0,
    formatReleaseSignoffCaveat(releaseCompletionAudit, releaseStrict),
    releaseSignoffDetails
  ),
];

const passed = checklist.filter((entry) => entry.status === 'passed');
const missing = checklist.filter((entry) => entry.status !== 'passed');
const complete = missing.length === 0;

const audit = {
  objective,
  generated_at: new Date().toISOString(),
  complete,
  summary: {
    passed: passed.length,
    missing_or_incomplete: missing.length,
  },
  checklist,
};
const writtenReportPath = writeReportIfRequested(audit);

if (json) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  console.log('[app-goal-completion-audit] objective');
  console.log(`- ${objective}`);
  console.log('[app-goal-completion-audit] prompt-to-artifact checklist');
  for (const entry of checklist) {
    console.log(`- ${entry.status === 'passed' ? 'PASS' : 'MISSING'} ${entry.id}: ${entry.requirement}`);
    for (const evidence of entry.evidence) {
      console.log(`  evidence: ${evidence}`);
    }
    if (entry.caveat) {
      console.log(`  caveat: ${entry.caveat}`);
    }
  }
  console.log(
    complete
      ? '[app-goal-completion-audit] complete: all checklist items passed.'
      : '[app-goal-completion-audit] not complete: missing or externally blocked checklist items remain.'
  );
  if (writtenReportPath) {
    console.log(`[app-goal-completion-audit] report: ${writtenReportPath}`);
  }
}

if (strict && !complete) {
  process.exit(1);
}
