#!/usr/bin/env node

import { glob } from 'glob';
import { readFile } from 'node:fs/promises';

const SCAN_PATTERNS = [
  'backend/src/**/*.{ts,tsx}',
  'frontend/src/**/*.{ts,tsx}',
  'frontend-admin/src/**/*.{ts,tsx}',
];

const IGNORE_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  'backend/src/services/clinical-quality.service.ts',
];

const FORBIDDEN_PATTERNS = [
  {
    id: 'zh-ai-psychologist',
    pattern: /AI\s*心理師|心理師分析|心理師的反饋/g,
    message: 'User-facing AI positioning must use AI 關係梳理助手 / AI 梳理, not AI 心理師.',
  },
  {
    id: 'en-ai-therapist',
    pattern: /AI\s+(?:Therapist|Psychologist|Counselor|Counsellor)|Therapist's Feedback|psychologist is analyzing/gi,
    message: 'User-facing English AI positioning must use AI relationship guide, not therapist/psychologist.',
  },
  {
    id: 'prompt-self-licensed-role',
    pattern: /你是(?:一位)?(?:資深的?)?(?:臨床心理師|心理評估專家|心理評估助手|伴侶關係治療師|資深伴侶治療師|真正的治療師|關係諮詢師|伴侶諮詢師)|你是一位(?:溫暖而專業的)?關係諮詢師/g,
    message: 'AI prompts must not assign licensed/professional therapist identity to the model.',
  },
  {
    id: 'zh-deep-dissection',
    pattern: /深度剖析/g,
    message: 'Use 整理觀點 / 情緒脈絡 instead of 深度剖析 in Web-facing copy.',
  },
];

const ALLOWED_CONTEXTS = [
  /不是持牌治療師/,
  /不自稱(?:臨床心理師|治療師)/,
  /尋求(?:持牌|專業).*?(?:心理師|治療師|支持)/,
  /專業的個別治療師陪你探索/,
  /不像治療師的處方/,
  /不得把 Emorapy 描述為治療師/,
  /不替代專業心理諮詢/,
  /licensed therapist for professional support/i,
];

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function contextAround(text, index, length) {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + length + 80);
  return text.slice(start, end);
}

const files = await glob(SCAN_PATTERNS, {
  ignore: IGNORE_PATTERNS,
  nodir: true,
});

const failures = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  for (const rule of FORBIDDEN_PATTERNS) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      const index = match.index ?? 0;
      const context = contextAround(content, index, match[0].length);
      if (ALLOWED_CONTEXTS.some((allowed) => allowed.test(context))) continue;
      failures.push({
        file,
        line: lineNumberAt(content, index),
        rule: rule.id,
        text: match[0],
        message: rule.message,
      });
    }
  }
}

if (failures.length > 0) {
  console.error('[ai-positioning-contracts] failed');
  for (const failure of failures) {
    console.error(`${failure.file}:${failure.line} [${failure.rule}] ${failure.message} (${failure.text})`);
  }
  process.exit(1);
}

console.log(`[ai-positioning-contracts] ok: scanned ${files.length} files`);
