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
      '`Emorapy` is the formal product and App release identity',
      'legacy aliases or current infrastructure identifiers only',
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
    file: 'docs/核心開發文件/術語表.md',
    needles: [
      '| Emorapy | 產品正式對外名稱',
      '| CJ | 歷史項目別名與 legacy internal identifier',
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
      'P5 current source design-token comment cleanup',
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

function checkNamingPolicyDocs() {
  for (const { file, needles } of REQUIRED_POLICY_NEEDLES) {
    const text = readText(file);
    for (const needle of needles) {
      requireIncludes(text, needle, file);
    }
  }
}

checkAppJsonIdentity();
checkPackageManifestNames();
await checkAppIdentityFiles();
await checkUserFacingCopy();
await checkOperatorVisibleCopy();
await checkCurrentPackageScope();
await checkCurrentSourceIdentity();
checkCurrentDocLeadins();
checkNamingPolicyDocs();

if (failures.length > 0) {
  console.error('[emorapy-naming-governance] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[emorapy-naming-governance] ok: Emorapy naming policy, App identity, and visible copy guards passed');
