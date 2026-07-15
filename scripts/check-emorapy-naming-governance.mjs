#!/usr/bin/env node

import { glob } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

const EXPECTED_APP_IDENTITY = {
  name: 'Emorapy',
  slug: 'emorapy-mobile',
  scheme: 'emorapy',
  iosBundleIdentifier: 'com.emorapy.app',
  androidPackage: 'com.emorapy.app',
};

const EXPECTED_PACKAGE_MANIFEST_NAMES = new Map([
  ['package.json', 'emorapy-root'],
  ['backend/package.json', 'emorapy-backend'],
  ['e2e/package.json', 'emorapy-admin-e2e'],
]);

const USER_FACING_SCAN_PATTERNS = [
  'backend/src/**/*.{ts,tsx}',
  'frontend/src/**/*.{ts,tsx}',
  'frontend-admin/**/*.{ts,tsx,html}',
  'mobile/app/**/*.{ts,tsx}',
  'mobile/src/**/*.{ts,tsx}',
];

const OPERATOR_VISIBLE_SCAN_PATTERNS = [
  'scripts/**/*.sh',
  'scripts/**/*.bat',
  'start-dev.bat',
];

// Developer-facing env templates. These are copied to real .env by developers,
// so legacy product brand copy and legacy cj_* dev DB fixture naming must not
// re-enter them. Legacy infra hostnames (mother-bear-court.vercel.app) remain
// allowed here as the current production default until the Emorapy domain
// migration, matching the ops release helper allowlist.
const ENV_EXAMPLE_SCAN_PATTERNS = [
  '**/.env.example',
];

const ENV_EXAMPLE_IGNORE_PATTERNS = [
  '**/node_modules/**',
];

const MARKETING_COPY_SCAN_PATTERNS = [
  'docs/核心營銷文件/**/*.md',
  'docs/核心營銷文件/**/*.csv',
];

const CURRENT_SOURCE_IDENTITY_SCAN_PATTERNS = [
  'frontend/src/**/*.{css,ts,tsx,html}',
  'frontend-admin/src/**/*.{css,ts,tsx,html}',
  'backend/src/**/*.{ts,tsx}',
  'mobile/app/**/*.{ts,tsx}',
  'mobile/src/**/*.{ts,tsx}',
  'mobile/scripts/**/*.mjs',
];

const CURRENT_DOC_LEADIN_FILES = [
  'docs/核心開發文件/01-認證與會話/00-認證與會話總覽.md',
  'docs/核心開發文件/02-用戶端核心流程/00-用戶端核心流程總覽.md',
  'docs/核心開發文件/03-管理端與平台治理/00-管理端與平台治理總覽.md',
  'docs/核心開發文件/03-管理端與平台治理/01-環境與部署基線.md',
  'docs/核心開發文件/03-管理端與平台治理/04-兩版本運作規範.md',
  'docs/核心開發文件/04-共用機制/00-共用機制總覽.md',
  'docs/核心開發文件/05-工程架構與共享層/Repo平台分層與共享規範.md',
  'docs/核心開發文件/08-測試規範與驗收/01-測試文檔分層與使用規則.md',
];

const CURRENT_DEV_CI_FIXTURE_SCAN_PATTERNS = [
  '.github/workflows/ci.yml',
  'backend/docker-compose.postgres.yml',
  'backend/docker-compose.redis.yml',
  'backend/tests/setup.ts',
  'backend/tests/unit/scripts/web-p0-true-service-smoke.test.ts',
  'backend/tests/unit/utils/seed-guard.test.ts',
  'docs/核心開發文件/05-工程架構與共享層/01-本地開發與工作區基線.md',
];

const CURRENT_TELEMETRY_FIXTURE_SCAN_PATTERNS = [
  'backend/tests/integration/smoke.test.ts',
  'backend/tests/unit/routes/app-telemetry.routes.test.ts',
  'backend/tests/unit/services/app-telemetry.service.test.ts',
  'mobile/src/platform/telemetry/client.test.js',
  'mobile/scripts/run-telemetry-runtime-smoke.mjs',
];

const USER_FACING_IGNORE_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/__tests__/**',
  '**/dist/**',
  '**/node_modules/**',
];

const OPERATOR_VISIBLE_IGNORE_PATTERNS = [
  '**/node_modules/**',
];

const CURRENT_SOURCE_IDENTITY_IGNORE_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/__tests__/**',
  '**/dist/**',
  '**/node_modules/**',
  'backend/tmp/**',
];

const APP_IDENTITY_FILES = [
  'mobile/app.json',
  'mobile/eas.json',
  'mobile/scripts/check-release-readiness.mjs',
  'mobile/scripts/check-android-readiness.mjs',
  'mobile/maestro/**/*.yaml',
  'mobile/maestro-side-effects/**/*.yaml',
];

const CURRENT_PACKAGE_SCOPE_SCAN_PATTERNS = [
  'package.json',
  'package-lock.json',
  'backend/**/*.{ts,tsx,json}',
  'frontend/**/*.{ts,tsx,json}',
  'frontend-admin/**/*.{ts,tsx,json}',
  'mobile/**/*.{ts,tsx,js,json}',
  'packages/**/*.{ts,tsx,js,json,d.ts}',
  'scripts/**/*.{js,mjs,cjs,ts,sh}',
  'docs/核心開發文件/**/*.md',
];

const CURRENT_PACKAGE_SCOPE_IGNORE_PATTERNS = [
  '**/node_modules/**',
  'backend/tmp/**',
  'mobile/ios/**',
  'mobile/android/**',
  'docs/核心開發文件/07-待處理問題與治理/已處理/**',
  'docs/核心開發文件/90-證據與盤點/**',
  'docs/核心開發文件/99-歷史降級索引/**',
  'docs/核心開發文件/文件收斂/**',
  'docs/核心開發文件/07-待處理問題與治理/待處理/Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md',
  'scripts/check-emorapy-naming-governance.mjs',
];

const LEGACY_VISIBLE_COPY_RULES = [
  {
    id: 'cj-platform-en',
    pattern: /\bCJ Platform\b/g,
    message: 'User-facing product copy must use Emorapy, not CJ Platform.',
  },
  {
    id: 'cj-platform-zh',
    pattern: /CJ 平台/g,
    message: 'User-facing product copy must use Emorapy, not CJ 平台.',
  },
  {
    id: 'cj-reminder-en',
    pattern: /\bCJ Reminder\b/g,
    message: 'User-facing notification copy must use Emorapy Reminder.',
  },
  {
    id: 'cj-reminder-zh',
    pattern: /CJ 提醒/g,
    message: 'User-facing notification copy must use Emorapy 提醒.',
  },
  {
    id: 'admin-title-cj',
    pattern: /Admin Login - CJ|Ops Dashboard - CJ|CJ Platform Admin|CJ Platform Ops Alert/g,
    message: 'Admin visible titles must use Emorapy.',
  },
  {
    id: 'legacy-backend-observability-service',
    pattern: /\bcj-platform-backend\b/g,
    message: 'Current backend observability service name must default to emorapy-backend.',
  },
];

const CURRENT_GOVERNANCE_ID_SCAN_PATTERNS = ['docs/核心開發文件/**/*.md'];

const CURRENT_GOVERNANCE_ID_IGNORE_PATTERNS = [
  'docs/核心開發文件/07-待處理問題與治理/已處理/**',
  'docs/核心開發文件/90-證據與盤點/**',
  'docs/核心開發文件/99-歷史降級索引/**',
  'docs/核心開發文件/文件收斂/**',
  'docs/核心開發文件/07-待處理問題與治理/待處理/Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md',
  'docs/核心開發文件/07-待處理問題與治理/待處理/Emorapy命名收斂剩餘任務Codex交接執行單-2026-06-21.md',
];

const LEGACY_GOVERNANCE_ID_RE = /\bCJ-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g;
const LEGACY_GOVERNANCE_ID_WILDCARD_RE = /\bCJ-[A-Z0-9]+(?:-[A-Z0-9]+)*-\*/g;

const LEGACY_MARKETING_COPY_RULES = [
  {
    id: 'legacy-marketing-cj-brand',
    pattern: /\bCJ\b/g,
    message: 'Current marketing copy must use Emorapy, not CJ.',
  },
  {
    id: 'legacy-marketing-cj-token-prefix',
    pattern: /\bCJ[_-][A-Za-z0-9_-]*/g,
    message: 'Current marketing asset identifiers must use an Emorapy prefix, not CJ_.',
  },
  {
    id: 'legacy-marketing-lowercase-cj-token-prefix',
    pattern: /\bcj-[a-z0-9-]+/g,
    message: 'Current marketing workflow identifiers must use Emorapy wording, not cj-*.',
  },
  {
    id: 'legacy-marketing-cj-platform-zh',
    pattern: /CJ 平台/g,
    message: 'Current marketing copy must use Emorapy, not CJ 平台.',
  },
  {
    id: 'legacy-marketing-cj-platform-en',
    pattern: /\bCJ Platform\b/g,
    message: 'Current marketing copy must use Emorapy, not CJ Platform.',
  },
  {
    id: 'legacy-marketing-mother-bear-court-brand',
    pattern: /Mother Bear Court|mother-bear-court/g,
    message: 'Current marketing copy must use Emorapy, not Mother Bear Court / mother-bear-court.',
  },
];

const LEGACY_APP_IDENTITY_RULES = [
  {
    id: 'legacy-ios-android-bundle',
    pattern: /com\.cj\.motherbearcourt/g,
    message: 'Current App identity must use com.emorapy.app, not com.cj.motherbearcourt.',
  },
  {
    id: 'legacy-eas-slug',
    pattern: /\bcj-mobile\b/g,
    message: 'Current App release identity must use emorapy-mobile, not cj-mobile.',
  },
  {
    id: 'legacy-deep-link-scheme',
    pattern: /(?:scheme|openLink):\s*['"]?cj(?::\/\/|['"]|\s|$)/g,
    message: 'Current App deep-link scheme must use emorapy.',
  },
];

const LEGACY_PACKAGE_SCOPE_RULES = [
  {
    id: 'legacy-contracts-scope',
    pattern: /@cj\/contracts/g,
    message: 'Current shared package identity must use @emorapy/contracts.',
  },
  {
    id: 'legacy-api-client-scope',
    pattern: /@cj\/api-client/g,
    message: 'Current shared package identity must use @emorapy/api-client.',
  },
];

const LEGACY_SOURCE_IDENTITY_RULES = [
  {
    id: 'legacy-design-token-system-title',
    pattern: /Mother Bear Court(?: Admin)? - Design Token System/g,
    message: 'Current source comments must describe design tokens as Emorapy, not Mother Bear Court.',
  },
  {
    id: 'legacy-app-telemetry-runtime-tag',
    pattern: /\bcj-app-(?:telemetry|otel)(?::send-failed)?\b/g,
    message: 'Current App telemetry runtime diagnostics must use emorapy-app-* tags.',
  },
  {
    id: 'legacy-app-telemetry-runtime-user-agent',
    pattern: /\bcj-app-telemetry-runtime-smoke\/1\.0\b/g,
    message: 'Current App telemetry runtime smoke User-Agent must use emorapy-app-telemetry-runtime-smoke.',
  },
  {
    id: 'legacy-app-release-contract-temp-prefix',
    pattern: /\bcj-(?:release-(?:evidence-sanitize|status(?:-[a-z-]+)?|signoff-prereq|handoff-report|evidence-fixtures)|goal-audit-contract)-/g,
    message: 'Current App release/audit contract temp fixture prefixes must use emorapy-* naming.',
  },
  {
    id: 'legacy-app-release-controlled-sentry-org',
    pattern: /\bcj-org\b/g,
    message: 'Current App release controlled Sentry org fixtures must use emorapy-org.',
  },
  {
    id: 'legacy-app-release-controlled-db-path',
    pattern: /release-db\.example(?:\.(?:com|invalid))?(?::\d+)?\/cj\b/g,
    message: 'Current App release controlled DB fixture paths must use /emorapy.',
  },
];

const LEGACY_DEV_CI_FIXTURE_RULES = [
  {
    id: 'legacy-dev-ci-postgres-db-name',
    pattern: /\bcj_(?:flow_test|smoke|dev|platform_test)\b/g,
    message: 'Current CI/local Postgres fixture databases must use emorapy_* names.',
  },
  {
    id: 'legacy-dev-ci-postgres-password',
    pattern: /\bcj_dev_pass\b/g,
    message: 'Current CI/local Postgres fixture passwords must use emorapy_dev_pass.',
  },
  {
    id: 'legacy-dev-ci-postgres-user',
    pattern: /(?:POSTGRES_USER:\s*cj\b|postgresql:\/\/cj:|pg_isready -U cj -d)/g,
    message: 'Current CI/local Postgres fixture users must use emorapy.',
  },
  {
    id: 'legacy-dev-compose-container-volume',
    pattern: /\bcj-backend-dev-(?:postgres|redis)(?:-data)?\b/g,
    message: 'Current local docker-compose helper container and volume names must use emorapy-backend-dev-*.',
  },
  {
    id: 'legacy-ci-dummy-jwt-prefix',
    pattern: /\bcj(?:Admin)?JwtProdKey\b/g,
    message: 'Current CI dummy JWT fixture names must use Emorapy naming.',
  },
];

const LEGACY_TELEMETRY_FIXTURE_RULES = [
  {
    id: 'legacy-app-otlp-scope-fixture',
    pattern: /\bcj\.mobile\.app\b/g,
    message: 'Current App OTLP telemetry scope fixtures must use emorapy.mobile.app.',
  },
];

const LEGACY_DOC_LEADIN_RULES = [
  {
    id: 'legacy-doc-product-subject',
    pattern: /`CJ` (?:前台身份建立|面向普通用戶|的前台主流程|的主站 admin|的環境矩陣|橫跨主 Web|的測試文檔)|定義 `CJ` 以後只承認|將 `mother-bear-court` 的平台分層正式定義/g,
    message: 'Current formal-doc lead-in text must use Emorapy as the product subject; legacy identifiers are only allowed when explicitly classified as aliases, IDs, env vars, infrastructure, or evidence.',
  },
];

const REQUIRED_POLICY_NEEDLES = [
  {
    file: 'AGENTS.md',
    needles: [
      'Emorapy Agent Guide',
      '`Emorapy` is the formal product, repo, and App release identity',
      'legacy aliases or compatibility infrastructure identifiers only',
    ],
  },
  {
    file: 'docs/核心開發文件/README.md',
    needles: [
      'Emorapy 核心開發文件',
      '不得作為新的對外文案、App Store metadata、native bundle ID 或 release identity',
    ],
  },
  {
    file: 'docs/核心營銷文件/README.md',
    needles: [
      '本目錄是 `Emorapy` 全項目的唯一營銷 SSOT',
      'Emorapy產品定位與行銷策略分析.md',
      'Emorapy專屬營銷分析報告-2026-03-29.md',
    ],
  },
  {
    file: 'docs/核心開發文件/術語表.md',
    needles: [
      '| Emorapy | 產品正式對外名稱',
      '| CJ | 歷史項目別名與 legacy internal identifier',
      '現行 governance ID namespace 為 `EMO-*`',
      '`CJ-*` governance ID namespace 只作歷史追溯',
      '@cj/*` 歷史 package-scope 引用',
      '| Mother Bear Court / mother-bear-court | 歷史品牌 / repo / deploy alias',
    ],
  },
  {
    file: 'docs/核心開發文件/07-待處理問題與治理/待處理/Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md',
    needles: [
      '掃描結果不得以總量清零作唯一目標；必須按 allowlist 分類後驗收。',
      'P5 入口文件收斂',
      'P5 current docs 舊名 allowlist 分類',
      'P5 legacy governance ID namespace policy',
      'P5 current source design-token comment cleanup',
      'P5 core marketing SSOT naming cleanup',
      'P4 CI / local true-service Postgres fixture naming',
      'P4 App OTLP telemetry scope fixture naming',
      'P4 release commit env alias contract',
      'P4 legacy production hostname compatibility gate',
      'P4 Sentry native crash project / release identity handoff',
      'P4 Web localStorage key migration',
      'P4 Admin Web locale storage key migration',
      'P4 App SecureStore key migration',
      'Legacy requirement / governance IDs',
      'Historical package-scope references',
      '正式 internal workspace package scope 改為 `@emorapy/contracts` 與 `@emorapy/api-client`',
    ],
  },
  {
    file: 'docs/核心開發文件/90-證據與盤點/README.md',
    needles: [
      'Emorapy 命名與歷史證據 provenance',
      '歷史證據原文不得為了命名收斂而機械改寫',
      '後續新增的 release evidence',
    ],
  },
  {
    file: 'docs/核心開發文件/99-歷史降級索引/README.md',
    needles: [
      'Emorapy 命名與歷史方案 provenance',
      '不得為了命名收斂改寫歷史方案原文',
      '不代表當前正式產品名、App Store metadata、native identifiers',
    ],
  },
];

const failures = [];

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function fail(message) {
  failures.push(message);
}

function requireEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function requireIncludes(text, needle, file) {
  if (!text.includes(needle)) {
    fail(`${file} must include naming governance marker: ${needle}`);
  }
}

function requireAbsent(file, needle, message) {
  const text = readText(file);
  if (text.includes(needle)) {
    fail(`${file} must not include deprecated token (${message}): ${needle}`);
  }
}

function requireOrderedIncludes(file, needles, message) {
  const text = readText(file);
  let cursor = -1;
  for (const needle of needles) {
    const index = text.indexOf(needle, cursor + 1);
    if (index === -1) {
      fail(`${file} must include ${message}: ${needle}`);
      return;
    }
    cursor = index;
  }
}

function checkAppJsonIdentity() {
  const app = readJson('mobile/app.json').expo;
  requireEqual(app.name, EXPECTED_APP_IDENTITY.name, 'mobile/app.json expo.name');
  requireEqual(app.slug, EXPECTED_APP_IDENTITY.slug, 'mobile/app.json expo.slug');
  requireEqual(app.scheme, EXPECTED_APP_IDENTITY.scheme, 'mobile/app.json expo.scheme');
  requireEqual(
    app.ios?.bundleIdentifier,
    EXPECTED_APP_IDENTITY.iosBundleIdentifier,
    'mobile/app.json expo.ios.bundleIdentifier'
  );
  requireEqual(
    app.android?.package,
    EXPECTED_APP_IDENTITY.androidPackage,
    'mobile/app.json expo.android.package'
  );
}

function checkPackageManifestNames() {
  for (const [file, expectedName] of EXPECTED_PACKAGE_MANIFEST_NAMES) {
    const manifest = readJson(file);
    requireEqual(manifest.name, expectedName, `${file} name`);
  }
}

async function checkAppIdentityFiles() {
  const files = await glob(APP_IDENTITY_FILES, {
    cwd: repoRoot,
    nodir: true,
    ignore: ['**/node_modules/**', 'mobile/ios/**', 'mobile/android/**'],
  });

  for (const file of files) {
    const text = readText(file);
    for (const rule of LEGACY_APP_IDENTITY_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        fail(`${file}:${lineNumberAt(text, match.index ?? 0)} [${rule.id}] ${rule.message}`);
      }
    }
  }
}

async function checkUserFacingCopy() {
  const files = await glob(USER_FACING_SCAN_PATTERNS, {
    cwd: repoRoot,
    nodir: true,
    ignore: USER_FACING_IGNORE_PATTERNS,
  });

  for (const file of files) {
    const text = readText(file);
    for (const rule of LEGACY_VISIBLE_COPY_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        fail(`${file}:${lineNumberAt(text, match.index ?? 0)} [${rule.id}] ${rule.message}`);
      }
    }
  }
}

async function checkOperatorVisibleCopy() {
  const files = await glob(OPERATOR_VISIBLE_SCAN_PATTERNS, {
    cwd: repoRoot,
    nodir: true,
    ignore: OPERATOR_VISIBLE_IGNORE_PATTERNS,
  });

  for (const file of files) {
    const text = readText(file);
    for (const rule of LEGACY_VISIBLE_COPY_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        fail(`${file}:${lineNumberAt(text, match.index ?? 0)} [${rule.id}] ${rule.message}`);
      }
    }
  }
}

async function checkEnvExampleIdentity() {
  const files = await glob(ENV_EXAMPLE_SCAN_PATTERNS, {
    cwd: repoRoot,
    nodir: true,
    dot: true,
    ignore: ENV_EXAMPLE_IGNORE_PATTERNS,
  });

  const envRules = [...LEGACY_VISIBLE_COPY_RULES, ...LEGACY_DEV_CI_FIXTURE_RULES];
  for (const file of files) {
    const text = readText(file);
    for (const rule of envRules) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        fail(`${file}:${lineNumberAt(text, match.index ?? 0)} [${rule.id}] ${rule.message}`);
      }
    }
  }
}

async function checkMarketingCopy() {
  const files = await glob(MARKETING_COPY_SCAN_PATTERNS, {
    cwd: repoRoot,
    nodir: true,
    ignore: ['**/node_modules/**'],
  });

  for (const file of files) {
    const text = readText(file);
    for (const rule of LEGACY_MARKETING_COPY_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        fail(`${file}:${lineNumberAt(text, match.index ?? 0)} [${rule.id}] ${rule.message}`);
      }
    }
  }
}

async function checkCurrentPackageScope() {
  const files = await glob(CURRENT_PACKAGE_SCOPE_SCAN_PATTERNS, {
    cwd: repoRoot,
    nodir: true,
    ignore: CURRENT_PACKAGE_SCOPE_IGNORE_PATTERNS,
  });

  for (const file of files) {
    const text = readText(file);
    for (const rule of LEGACY_PACKAGE_SCOPE_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        fail(`${file}:${lineNumberAt(text, match.index ?? 0)} [${rule.id}] ${rule.message}`);
      }
    }
  }
}

async function checkCurrentGovernanceIdNamespace() {
  const files = await glob(CURRENT_GOVERNANCE_ID_SCAN_PATTERNS, {
    cwd: repoRoot,
    nodir: true,
    ignore: CURRENT_GOVERNANCE_ID_IGNORE_PATTERNS,
  });

  for (const file of files) {
    const text = readText(file);
    LEGACY_GOVERNANCE_ID_RE.lastIndex = 0;
    for (const match of text.matchAll(LEGACY_GOVERNANCE_ID_RE)) {
      fail(
        `${file}:${lineNumberAt(text, match.index ?? 0)} [legacy-governance-id] current docs must use EMO-* IDs; CJ-* is historical-only after the 2026-06-21 mapped migration: ${match[0]}`
      );
    }
    LEGACY_GOVERNANCE_ID_WILDCARD_RE.lastIndex = 0;
    for (const match of text.matchAll(LEGACY_GOVERNANCE_ID_WILDCARD_RE)) {
      fail(
        `${file}:${lineNumberAt(text, match.index ?? 0)} [legacy-governance-id-wildcard] current docs must use EMO-* wildcard references; CJ-* is historical-only after the 2026-06-21 mapped migration: ${match[0]}`
      );
    }
  }
}

async function checkCurrentSourceIdentity() {
  const files = await glob(CURRENT_SOURCE_IDENTITY_SCAN_PATTERNS, {
    cwd: repoRoot,
    nodir: true,
    ignore: CURRENT_SOURCE_IDENTITY_IGNORE_PATTERNS,
  });

  for (const file of files) {
    const text = readText(file);
    for (const rule of LEGACY_SOURCE_IDENTITY_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        fail(`${file}:${lineNumberAt(text, match.index ?? 0)} [${rule.id}] ${rule.message}`);
      }
    }
  }
}

function checkCurrentDocLeadins() {
  for (const file of CURRENT_DOC_LEADIN_FILES) {
    const text = readText(file);
    for (const rule of LEGACY_DOC_LEADIN_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        fail(`${file}:${lineNumberAt(text, match.index ?? 0)} [${rule.id}] ${rule.message}`);
      }
    }
  }
}

async function checkCurrentDevCiFixtureIdentity() {
  const files = await glob(CURRENT_DEV_CI_FIXTURE_SCAN_PATTERNS, {
    cwd: repoRoot,
    nodir: true,
    ignore: ['**/node_modules/**'],
  });

  for (const file of files) {
    const text = readText(file);
    for (const rule of LEGACY_DEV_CI_FIXTURE_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        fail(`${file}:${lineNumberAt(text, match.index ?? 0)} [${rule.id}] ${rule.message}`);
      }
    }
  }
}

async function checkCurrentTelemetryFixtureIdentity() {
  const files = await glob(CURRENT_TELEMETRY_FIXTURE_SCAN_PATTERNS, {
    cwd: repoRoot,
    nodir: true,
    ignore: ['**/node_modules/**'],
  });

  for (const file of files) {
    const text = readText(file);
    for (const rule of LEGACY_TELEMETRY_FIXTURE_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        fail(`${file}:${lineNumberAt(text, match.index ?? 0)} [${rule.id}] ${rule.message}`);
      }
    }
  }
}

function checkNamingPolicyDocs() {
  for (const { file, needles } of REQUIRED_POLICY_NEEDLES) {
    const text = readText(file);
    for (const needle of needles) {
      requireIncludes(text, needle, file);
    }
  }
}

function checkCoreDocsLedgerGeneratorIdentity() {
  const generatorFile = 'scripts/generate-core-docs-audit-ledger.mjs';
  const ledgerFile = 'docs/核心開發文件/文件收斂/03-CJ-核心開發文件逐文件代碼校驗總台賬-2026-04-18.md';
  const generatorText = readText(generatorFile);
  const ledgerText = readText(ledgerFile);
  const expectedTitle = '# Emorapy 核心開發文件逐文件代碼校驗總台賬';
  const provenance = '檔名中的 `03-CJ-` 保留為 2026-04-18 legacy governance batch identifier';

  requireIncludes(generatorText, expectedTitle, generatorFile);
  requireIncludes(generatorText, provenance, generatorFile);
  requireIncludes(ledgerText, expectedTitle, ledgerFile);
  requireIncludes(ledgerText, provenance, ledgerFile);

  if (generatorText.includes("lines.push('# CJ 核心開發文件逐文件代碼校驗總台賬")) {
    fail(`${generatorFile} must not regenerate the active core-docs ledger with a CJ product-title.`);
  }
}

function checkSeedGuardLegacyDevProjectComment() {
  const file = 'backend/src/utils/seed-guard.ts';
  const text = readText(file);
  requireIncludes(
    text,
    'Legacy Supabase Dev project name: "Mother Bear Court Dev"',
    file
  );
  requireIncludes(text, "'lbukyqztkkkztfrfltlh'", file);

  if (text.includes('Mother Bear Court Dev Supabase project ref')) {
    fail(`${file} must classify Mother Bear Court Dev as a legacy Supabase project name.`);
  }
}

function checkAppVisibleCopyLegacyBrandGuard() {
  const file = 'mobile/scripts/check-user-copy-contracts.mjs';
  const text = readText(file);
  const requiredTerms = [
    'Legacy product / release identifiers must not re-enter App visible copy.',
    "'CJ App'",
    "'CJ Platform'",
    "'Mother Bear Court'",
    "'cj-mobile'",
    "'com.cj.motherbearcourt'",
  ];
  for (const term of requiredTerms) {
    requireIncludes(text, term, file);
  }
}

function checkLegacyProductionHostnameCompatContract() {
  const releaseHelperFiles = [
    'scripts/ops-release-status.sh',
    'scripts/ops-release-gate.sh',
    'scripts/ops-release-smoke.sh',
    'scripts/ops-release-gate-evidence.sh',
  ];
  const emorapyDefaultComment =
    'Emorapy canonical production domains; Vercel project domains remain compatibility aliases.';

  for (const file of releaseHelperFiles) {
    requireOrderedIncludes(
      file,
      [
        emorapyDefaultComment,
        'DEFAULT_MAIN_WEB_URL="https://emorapy.com"',
        'DEFAULT_ADMIN_WEB_URL="https://admin.emorapy.com"',
        'EMORAPY_MAIN_WEB_URL',
      ],
      `${file} must use Emorapy canonical production defaults with Emorapy override support`
    );
  }

  requireOrderedIncludes(
    '.github/workflows/production-deploy-and-verify.yml',
    [
      'vars.EMORAPY_MAIN_WEB_URL',
      'vars.PRODUCTION_MAIN_WEB_URL',
      "'https://emorapy.com'",
    ],
    'production workflow release gate main URL must prefer Emorapy variable before the canonical domain default'
  );
  requireIncludes(
    readText('docs/核心開發文件/03-管理端與平台治理/05-運維連接與調用Runbook.md'),
    '`https://emorapy.com` 與 `https://admin.emorapy.com` 是 canonical Production origins',
    'docs/核心開發文件/03-管理端與平台治理/05-運維連接與調用Runbook.md'
  );
  requireIncludes(
    readText('mobile/eas.json'),
    '"EXPO_PUBLIC_API_BASE_URL": "https://api.emorapy.com/api/v1"',
    'mobile/eas.json'
  );
}

function checkReleaseArtifactPrivacyContract() {
  const smokeFile = 'scripts/ops-release-smoke.sh';
  const smokeText = readText(smokeFile);
  requireIncludes(smokeText, 'echo "[release-smoke] admin_email=set"', smokeFile);

  const leakedAdminIdentifierLine = smokeText
    .split('\n')
    .find((line) => line.includes('echo ') && line.includes('ADMIN_EMAIL'));
  if (leakedAdminIdentifierLine) {
    fail(`${smokeFile} must not emit the secret-derived admin identifier into release artifacts.`);
  }

  const evidenceFile = 'scripts/ops-release-gate-evidence.sh';
  requireIncludes(
    readText(evidenceFile),
    'mask_presence "${RELEASE_SMOKE_ADMIN_EMAIL:-${ADMIN_EMAIL:-}}"',
    evidenceFile
  );
}

function checkLegacyGovernanceIdNamespacePolicy() {
  const prdFile = 'docs/核心開發文件/00-跨端產品核心/01-產品PRD總章.md';
  requireOrderedIncludes(
    prdFile,
    [
      '`EMO-*` 是現行 governance ID namespace',
      '`CJ-*` 是歷史 governance ID namespace',
      '不得在 current docs 新增完整 `CJ-*` ID',
    ],
    'PRD ID namespace policy must classify EMO-* as current and CJ-* as historical-only'
  );

  requireOrderedIncludes(
    'docs/核心開發文件/術語表.md',
    [
      '現行 governance ID namespace 為 `EMO-*`',
      '`CJ-*` governance ID namespace 只作歷史追溯',
    ],
    'terminology must classify EMO-* as current governance IDs and CJ-* as historical-only'
  );
}

function checkSentryNativeCrashReleaseIdentity() {
  requireIncludes(
    readText('mobile/app.json'),
    'SENTRY_PROJECT=emorapy-mobile',
    'mobile/app.json'
  );
  requireIncludes(
    readText('mobile/src/platform/telemetry/nativeCrash.ts'),
    'release: `emorapy-mobile@${runtime.appVersion}+${runtime.buildNumber}`',
    'mobile/src/platform/telemetry/nativeCrash.ts'
  );
  requireIncludes(
    readText('mobile/src/platform/telemetry/nativeCrash.test.js'),
    "release: 'emorapy-mobile@1.2.3-test+42-test'",
    'mobile/src/platform/telemetry/nativeCrash.test.js'
  );

  const handoffFile = 'mobile/scripts/check-release-external-evidence-handoff.mjs';
  const signoffFile = 'mobile/scripts/run-release-external-evidence-signoff.mjs';
  requireOrderedIncludes(
    handoffFile,
    [
      'The project slug must resolve to emorapy-mobile.',
      'APP_SENTRY_PROJECT=emorapy-mobile APP_SENTRY_AUTH_TOKEN=<token> npm --prefix mobile run release:external-evidence:validate',
      'APP_SENTRY_PROJECT=emorapy-mobile APP_SENTRY_AUTH_TOKEN=<token> APP_NATIVE_CRASH_SENTRY_EVENT_ID=<event-id> npm --prefix mobile run native-crash:runtime:smoke -- --run',
    ],
    'Sentry native crash handoff must pin the Emorapy mobile project slug'
  );
  requireOrderedIncludes(
    signoffFile,
    [
      'It must resolve to emorapy-mobile.',
      'APP_SENTRY_PROJECT=emorapy-mobile npm --prefix mobile run release:external-evidence:validate -- --report-dir=<report-dir>',
    ],
    'Sentry prerequisite signoff must pin the Emorapy mobile project slug'
  );
}

function checkCurrentOpsEnvAliasContract() {
  // P4 env deprecation (2026-06-21): legacy CJ_COMMIT_SHA / CJ_RELEASE_GATE /
  // CJ_DEV_REDIS_DIR are removed from current source/config. Every reader keeps
  // a platform-injected or git fallback after EMORAPY_*, so the legacy CJ_*
  // fallback is no longer required and must not re-enter current entrypoints.
  requireOrderedIncludes(
    'backend/src/utils/version.ts',
    ['RAILWAY_GIT_COMMIT_SHA', 'EMORAPY_COMMIT_SHA'],
    'backend version commit env priority: Railway runtime > Emorapy alias'
  );
  requireAbsent('backend/src/utils/version.ts', 'CJ_COMMIT_SHA', 'deprecated legacy commit env');
  requireIncludes(readText('frontend/vite.config.ts'), 'process.env.EMORAPY_COMMIT_SHA', 'frontend/vite.config.ts');
  requireAbsent('frontend/vite.config.ts', 'CJ_COMMIT_SHA', 'deprecated legacy commit env');
  requireIncludes(readText('frontend-admin/vite.config.ts'), 'process.env.EMORAPY_COMMIT_SHA', 'frontend-admin/vite.config.ts');
  requireAbsent('frontend-admin/vite.config.ts', 'CJ_COMMIT_SHA', 'deprecated legacy commit env');
  requireIncludes(readText('scripts/start-dev.sh'), "EMORAPY_COMMIT_SHA='$HEAD_SHA'", 'scripts/start-dev.sh');
  requireAbsent('scripts/start-dev.sh', 'CJ_COMMIT_SHA', 'deprecated legacy commit env');
  requireAbsent('scripts/start-dev.sh', 'CJ_DEV_REDIS_DIR', 'deprecated legacy local Redis dir env');
  requireIncludes(readText('scripts/ops-release-gate.sh'), 'export EMORAPY_RELEASE_GATE=1', 'scripts/ops-release-gate.sh');
  requireAbsent('scripts/ops-release-gate.sh', 'CJ_RELEASE_GATE', 'deprecated legacy release gate env');
  requireIncludes(readText('backend/scripts/check-ai-pricing-catalog.ts'), 'env.EMORAPY_RELEASE_GATE', 'backend/scripts/check-ai-pricing-catalog.ts');
  requireAbsent('backend/scripts/check-ai-pricing-catalog.ts', 'CJ_RELEASE_GATE', 'deprecated legacy release gate env');
  requireIncludes(
    readText('.github/workflows/production-deploy-and-verify.yml'),
    'railway variable set "EMORAPY_COMMIT_SHA=${GITHUB_SHA}"',
    '.github/workflows/production-deploy-and-verify.yml'
  );
  requireAbsent(
    '.github/workflows/production-deploy-and-verify.yml',
    'CJ_COMMIT_SHA',
    'deprecated legacy commit env dual-write'
  );
}

function checkWebLocalStorageKeyMigrationContract() {
  const constantsFile = 'frontend/src/utils/constants.ts';
  const i18nFile = 'frontend/src/utils/i18n.ts';
  const storageFile = 'frontend/src/utils/storage.ts';
  const adminI18nFile = 'frontend-admin/src/utils/i18n.ts';

  requireIncludes(readText(constantsFile), "SESSION_STORAGE_KEY = 'emorapy_session_id'", constantsFile);
  requireIncludes(readText(constantsFile), "['cj_session_id', 'mbc_session_id'] as const", constantsFile);
  requireIncludes(readText(i18nFile), "LOCALE_STORAGE_KEY = 'emorapy_locale'", i18nFile);
  requireIncludes(readText(i18nFile), "['cj_locale', 'mbc_locale'] as const", i18nFile);
  requireIncludes(readText(storageFile), 'LEGACY_SESSION_STORAGE_KEYS.forEach', storageFile);
  requireIncludes(readText(adminI18nFile), "STORAGE_KEY = 'emorapy_admin_locale'", adminI18nFile);
  requireIncludes(readText(adminI18nFile), "['cj_locale', 'mbc_locale'] as const", adminI18nFile);
  requireIncludes(readText(adminI18nFile), 'LEGACY_STORAGE_KEYS.forEach', adminI18nFile);

  if (readText('frontend/src/test/setup.ts').includes("setItem('cj_locale'")) {
    fail('frontend/src/test/setup.ts must seed emorapy_locale, not cj_locale.');
  }
  if (readText('scripts/generate-web-a11y-manual-evidence.mjs').includes("'cj_session_id'")) {
    fail('scripts/generate-web-a11y-manual-evidence.mjs must seed emorapy_session_id, not cj_session_id.');
  }
}

function checkAppSecureStoreKeyMigrationContract() {
  const secureStoreFile = 'mobile/src/platform/storage/secureStore.ts';
  const secureStoreText = readText(secureStoreFile);

  const currentKeys = [
    "'emorapy.auth.token'",
    "'emorapy.session.id'",
    "'emorapy.device.meta'",
    "'emorapy.navigation.pendingLandingHref'",
    "'emorapy.locale'",
  ];
  const legacyKeys = [
    "['cj.auth.token'] as const",
    "['cj.session.id'] as const",
    "['cj.device.meta'] as const",
    "['cj.navigation.pendingLandingHref'] as const",
    "['cj.locale'] as const",
  ];

  for (const key of currentKeys) {
    requireIncludes(secureStoreText, key, secureStoreFile);
  }
  for (const key of legacyKeys) {
    requireIncludes(secureStoreText, key, secureStoreFile);
  }
  requireIncludes(secureStoreText, 'getMigratedItem', secureStoreFile);
  requireIncludes(secureStoreText, 'deleteLegacyItems', secureStoreFile);

  if (secureStoreText.includes("const TOKEN_KEY = 'cj.auth.token'")) {
    fail(`${secureStoreFile} must not use cj.auth.token as the current SecureStore key.`);
  }
  if (readText('mobile/src/platform/api/client.test.js').includes("key === 'cj.auth.token'")) {
    fail('mobile/src/platform/api/client.test.js must seed Emorapy current SecureStore keys, not cj.* current keys.');
  }
}

checkAppJsonIdentity();
checkPackageManifestNames();
await checkAppIdentityFiles();
await checkUserFacingCopy();
await checkOperatorVisibleCopy();
await checkEnvExampleIdentity();
await checkMarketingCopy();
await checkCurrentPackageScope();
await checkCurrentGovernanceIdNamespace();
await checkCurrentSourceIdentity();
checkCurrentDocLeadins();
await checkCurrentDevCiFixtureIdentity();
await checkCurrentTelemetryFixtureIdentity();
checkCurrentOpsEnvAliasContract();
checkNamingPolicyDocs();
checkCoreDocsLedgerGeneratorIdentity();
checkSeedGuardLegacyDevProjectComment();
checkAppVisibleCopyLegacyBrandGuard();
checkLegacyProductionHostnameCompatContract();
checkReleaseArtifactPrivacyContract();
checkLegacyGovernanceIdNamespacePolicy();
checkSentryNativeCrashReleaseIdentity();
checkWebLocalStorageKeyMigrationContract();
checkAppSecureStoreKeyMigrationContract();

if (failures.length > 0) {
  console.error('[emorapy-naming-governance] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[emorapy-naming-governance] ok: Emorapy naming policy, App identity, and visible copy guards passed');
