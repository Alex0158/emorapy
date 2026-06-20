#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mobileRoot = resolve(repoRoot, 'mobile');
const enUSCatalogPath = resolve(mobileRoot, 'src/i18n/catalogs/en-US.ts');

const scannedRoots = ['app', 'src/ui', 'src/features'];
const visibleAttributeNames = [
  'accessibilityHint',
  'accessibilityLabel',
  'buttonLabel',
  'description',
  'detail',
  'emptyDescription',
  'emptyTitle',
  'errorMessage',
  'errorTitle',
  'eyebrow',
  'helperText',
  'label',
  'placeholder',
  'subtitle',
  'title',
];

const bannedVisibleTerms = [
  'after_seq',
  'all-visible',
  'anonymous session',
  'backend',
  'apiBaseUrl',
  'claim-session',
  'device token registration',
  'deep link',
  'judgment id',
  'invite code',
  'pairing',
  'plan id',
  'push token',
  'room id',
  'repair journey',
  'revoke route',
  'SecureStore adapter',
  'stream seq',
  'stream.delta',
  'stream.persisted',
  'stream.completed',
  'stream.failed',
  'stream.cancelled',
  'token/session',
  'user message',
  '尚未存在',
  '不能宣稱',
  'solo_active',
  'invite_pending',
  'invite_accepted',
  'group_active',
  'judgment_requested',
  'judgment_completed',
  'judgment_failed',
  'share_summary_only',
  'share_full_history',
  'share_from_join_time',
  'owner_only',
  'summary_only',
  'processing_failed',
  'attachment',
  'family_origin',
  'life_events',
  'belief_values',
  'cultural_background',
  'education_cognition',
  'personality',
  'relationship_history',
  'API',
  'http://',
  'https://',
  'M0',
  'M1',
  'M2',
  'M3',
  'M4',
  'M5',
  'M6',
  '接入中',
  '測試',
  '判斷代號',
  '方案代號',
  '修復旅程識別碼',
  '房間代號',
  '房間',
  '服務位址',
  'App 主線',
  '結果頁骨架',
  'Alpha',
  // Legacy product / release identifiers must not re-enter App visible copy.
  'CJ APP',
  'CJ App',
  'CJ Platform',
  'CJ 平台',
  'CJ Reminder',
  'CJ 提醒',
  'Mother Bear Court',
  'mother-bear-court',
  'cj-mobile',
  'com.cj.motherbearcourt',
];

const bannedExactVisibleLabels = new Set([
  'APP',
  'AUTH',
  'CASE',
  'CHAT',
  'Email',
  'INTERVIEW',
  'INVITE',
  'MY STORY',
  'NOTICE',
  'PROFILE',
  'Password',
  'QUICK',
  'REPAIR',
  'RESULT',
]);

const rawVisibleFieldNames = '(?:status|priority|phase|mode|code|template_code|id|room_id|case_id|plan_id|track_id|judgment_id|domains_touched)';
const rawFieldAccessPattern = `[A-Za-z_$][\\w$]*(?:(?:\\?|!)?\\.[A-Za-z_$][\\w$]*|\\[[^\\]]+\\])*?(?:\\?|!)?\\.${rawVisibleFieldNames}`;

const directRawExpressionPatterns = [
  {
    name: 'raw chat room status',
    regex: /^\s*roomQuery\.data\??\.status\s*$/,
  },
  {
    name: 'raw room history visibility',
    regex: /^\s*roomQuery\.data\??\.history_visibility_mode\s*$/,
  },
  {
    name: 'raw AI stream status',
    regex: /^\s*aiStreamState\.status\s*$/,
  },
  {
    name: 'raw stream status',
    regex: /^\s*streamStatus\s*$/,
  },
  {
    name: 'raw lifecycle status',
    regex: /^\s*aiStreamLifecycleStatus\s*$/,
  },
  {
    name: 'raw message visibility',
    regex: /^\s*message\.visibility_scope\s*$/,
  },
  {
    name: 'raw repair phase',
    regex: /^\s*repairQuery\.data\??\.current_phase\s*$/,
  },
  {
    name: 'raw notification feed state',
    regex: /^\s*feedState\s*$/,
  },
  {
    name: 'raw route or form id',
    regex: /^\s*(?:roomId|caseId|planId|judgmentId|replanTrackId)\s*$/,
  },
  {
    name: 'raw backend field',
    regex: new RegExp(`^\\s*${rawFieldAccessPattern}\\s*$`),
  },
  {
    name: 'raw backend field fallback',
    regex: new RegExp(`^\\s*${rawFieldAccessPattern}\\s*\\?\\?\\s*${rawFieldAccessPattern}\\s*$`),
  },
  {
    name: 'raw psych domains join',
    regex: /\.domains_touched\b[\s\S]*\.join\s*\(/,
  },
];

function listFiles() {
  const files = [];
  for (const root of scannedRoots) {
    const output = execFileSync('rg', ['--files', root], {
      cwd: mobileRoot,
      encoding: 'utf8',
    });
    files.push(
      ...output
        .split('\n')
        .filter((file) => file.endsWith('.tsx') || isVisibleCopyModule(file))
        .map((file) => resolve(mobileRoot, file))
    );
  }
  return files;
}

function isVisibleCopyModule(file) {
  return /^src\/(?:features|ui)\/.+\/(?:labels|copy)\.ts$/.test(file);
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

function normalizeSnippet(value) {
  return value.replace(/\s+/g, ' ').trim();
}

const bannedPatterns = bannedVisibleTerms.map((term) => ({
  term,
  regex: new RegExp(escapeRegExp(term), 'i'),
}));

const allowedHardcodedVisibleLiteralPatterns = [
  /^name@example\.com$/,
];

function hasHumanLanguageText(value) {
  return /[A-Za-z\p{Script=Han}]/u.test(value);
}

function looksLikeI18nKey(value) {
  return /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/.test(value);
}

function isAllowedHardcodedVisibleLiteral(value, options) {
  const literalText = value.replace(/\$\{[^}]*\}/g, ' ');
  if (!hasHumanLanguageText(literalText)) return true;
  if (options.allowI18nKey && looksLikeI18nKey(literalText)) return true;
  return allowedHardcodedVisibleLiteralPatterns.some((pattern) => pattern.test(literalText));
}

function isLikelySourceSnippet(value) {
  return /[;={}]/.test(value) || /\b(?:const|return|function|useState|useEffect|if|else)\b/.test(value);
}

function reportVisibleText(failures, file, source, index, context, value, options = {}) {
  const snippet = normalizeSnippet(value);
  if (!snippet) return;

  if (options.forbidHardcoded && !isAllowedHardcodedVisibleLiteral(snippet, options)) {
    failures.push({
      file: relative(repoRoot, file),
      line: lineNumber(source, index),
      reason: `hardcoded visible text literal in ${context}; move it to App i18n catalog and call t(key)`,
      snippet,
    });
  }

  if (bannedExactVisibleLabels.has(snippet)) {
    failures.push({
      file: relative(repoRoot, file),
      line: lineNumber(source, index),
      reason: `banned exact visible label "${snippet}" in ${context}`,
      snippet,
    });
  }

  for (const { term, regex } of bannedPatterns) {
    if (regex.test(snippet)) {
      failures.push({
        file: relative(repoRoot, file),
        line: lineNumber(source, index),
        reason: `banned visible term "${term}" in ${context}`,
        snippet,
      });
    }
  }
}

function readBalancedExpression(source, openBraceIndex) {
  let depth = 0;
  let quote = null;
  let escaping = false;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return {
          expression: source.slice(openBraceIndex + 1, index),
          end: index,
        };
      }
    }
  }

  return null;
}

function scanStringLiterals(failures, file, source, expression, expressionStartIndex, context, options = {}) {
  const stringPattern = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  for (const match of expression.matchAll(stringPattern)) {
    reportVisibleText(
      failures,
      file,
      source,
      expressionStartIndex + (match.index ?? 0),
      context,
      match[2] ?? '',
      options
    );
  }
}

function scanDirectStringExpression(failures, file, source, expression, expressionStartIndex, context) {
  const trimmed = expression.trim();
  const match = trimmed.match(/^(['"`])((?:\\.|(?!\1)[\s\S])*?)\1$/);
  if (!match) return;

  reportVisibleText(
    failures,
    file,
    source,
    expressionStartIndex + expression.indexOf(trimmed),
    context,
    match[2] ?? '',
    { forbidHardcoded: true, allowI18nKey: true }
  );
}

function scanDirectRawExpression(failures, file, source, index, context, expression) {
  const normalized = expression.replace(/\s+/g, ' ').trim();
  if (!normalized) return;

  const failure = directRawExpressionPatterns.find((entry) => entry.regex.test(normalized));
  if (!failure) return;

  failures.push({
    file: relative(repoRoot, file),
    line: lineNumber(source, index),
    reason: `${failure.name} is passed directly to ${context}`,
    snippet: normalized,
  });
}

function scanVisibleStateTemplateCalls(failures, file, source) {
  const stateMessagePattern = /\bset[A-Z][A-Za-z]*(?:Feedback|Notice|Status|Error|Message|Text)\s*\(\s*`([\s\S]*?)`\s*\)/g;
  const rawBackendTemplateExpressionPattern = new RegExp(`\\$\\{[^}]*\\.${rawVisibleFieldNames}\\b[^}]*\\}`);

  for (const match of source.matchAll(stateMessagePattern)) {
    const template = match[1] ?? '';
    const index = match.index ?? 0;

    reportVisibleText(
      failures,
      file,
      source,
      index,
      'visible state template',
      template.replace(/\$\{[^}]*\}/g, ' '),
      { forbidHardcoded: true }
    );

    const rawExpression = template.match(rawBackendTemplateExpressionPattern);
    if (rawExpression) {
      failures.push({
        file: relative(repoRoot, file),
        line: lineNumber(source, index),
        reason: 'raw backend field in visible state template',
        snippet: normalizeSnippet(rawExpression[0] ?? template),
      });
    }
  }
}

function scanFile(file) {
  const failures = [];
  const source = readFileSync(file, 'utf8');
  const attributeAlternation = visibleAttributeNames.join('|');
  const relativeFile = relative(mobileRoot, file).replace(/\\/g, '/');

  if (isVisibleCopyModule(relativeFile)) {
    scanStringLiterals(failures, file, source, source, 0, 'visible copy module');
  }

  const jsxTextPattern = />((?:[^<>{}]|\{\/\*[\s\S]*?\*\/\})+)</g;
  for (const match of source.matchAll(jsxTextPattern)) {
    const value = (match[1] ?? '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    if (isLikelySourceSnippet(value)) continue;
    reportVisibleText(
      failures,
      file,
      source,
      match.index ?? 0,
      'JSX text',
      value,
      { forbidHardcoded: true }
    );
  }

  const quotedAttributePattern = new RegExp(
    `\\b(${attributeAlternation})\\s*=\\s*(["'])([\\s\\S]*?)\\2`,
    'g'
  );
  for (const match of source.matchAll(quotedAttributePattern)) {
    reportVisibleText(
      failures,
      file,
      source,
      match.index ?? 0,
      `${match[1]} attribute`,
      match[3] ?? '',
      { forbidHardcoded: true }
    );
  }

  const expressionAttributePattern = new RegExp(`\\b(${attributeAlternation})\\s*=\\s*\\{`, 'g');
  for (const match of source.matchAll(expressionAttributePattern)) {
    const openBraceIndex = source.indexOf('{', match.index ?? 0);
    const result = readBalancedExpression(source, openBraceIndex);
    if (!result) continue;

    const attrName = match[1] ?? 'visible';
    scanDirectStringExpression(
      failures,
      file,
      source,
      result.expression,
      openBraceIndex + 1,
      `${attrName} attribute expression`
    );
    scanDirectRawExpression(
      failures,
      file,
      source,
      openBraceIndex,
      `${attrName} attribute`,
      result.expression
    );
  }

  const jsxExpressionTextPattern = />\s*\{\s*([^{};\n]+?)\s*\}\s*</g;
  for (const match of source.matchAll(jsxExpressionTextPattern)) {
    scanDirectRawExpression(
      failures,
      file,
      source,
      match.index ?? 0,
      'JSX text',
      match[1] ?? ''
    );
  }

  const jsxMixedExpressionTextPattern = />[^<>\n]*\{\s*([^{};\n]+?)\s*\}[^<>\n]*</g;
  for (const match of source.matchAll(jsxMixedExpressionTextPattern)) {
    scanDirectRawExpression(
      failures,
      file,
      source,
      match.index ?? 0,
      'mixed JSX text',
      match[1] ?? ''
    );
  }

  scanVisibleStateTemplateCalls(failures, file, source);

  return failures;
}

function scanEnUSCatalogForCJK() {
  const failures = [];
  const source = readFileSync(enUSCatalogPath, 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    if (/[\p{Script=Han}]/u.test(line)) {
      failures.push({
        file: relative(repoRoot, enUSCatalogPath),
        line: index + 1,
        reason: 'en-US catalog contains CJK copy; translate the visible value to English',
        snippet: line.trim(),
      });
    }
  });
  return failures;
}

const failures = [
  ...listFiles().flatMap(scanFile),
  ...scanEnUSCatalogForCJK(),
];

if (failures.length) {
  console.error('[copy-check] user-visible copy contract failures:');
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} ${failure.reason}: ${failure.snippet}`);
  }
  process.exit(1);
}

console.log('[copy-check] ok: user-visible App copy avoids hardcoded literals, engineering terms, and backend status terms');
