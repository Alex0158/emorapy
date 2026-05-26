#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const files = {
  header: read('frontend/src/components/layout/Header.tsx'),
  bottomNav: read('frontend/src/components/layout/BottomNav.tsx'),
  zhTW: read('frontend/src/assets/i18n/zh-TW.ts'),
  enUS: read('frontend/src/assets/i18n/en-US.ts'),
  homeTest: read('frontend/src/pages/Home/index.test.tsx'),
};

const REQUIRED_SNIPPETS = [
  ['Header formal line', files.header, "t('nav.formalHandling')"],
  ['Header chat-first line', files.header, "t('nav.chatToJudgment')"],
  ['Header understand-you line', files.header, "t('nav.understandYou')"],
  ['Header quick-check unauth line', files.header, "t('nav.quickCheck')"],
  ['Header execution routes fold into formal line', files.header, "'/execution': '/case/list'"],
  ['BottomNav formal line', files.bottomNav, "t('nav.formalHandling')"],
  ['BottomNav formal submit line', files.bottomNav, "t('nav.submitFormal')"],
  ['BottomNav chat-first line', files.bottomNav, "t('nav.chatToJudgment')"],
  ['BottomNav understand-you line', files.bottomNav, "t('nav.understandYou')"],
  ['BottomNav quick-check unauth line', files.bottomNav, "t('nav.quickCheck')"],
  ['zh-TW quick check label', files.zhTW, '"nav.quickCheck": "快速判斷"'],
  ['zh-TW formal handling label', files.zhTW, '"nav.formalHandling": "正式處理"'],
  ['zh-TW chat-first label', files.zhTW, '"nav.chatToJudgment": "先聊再判"'],
  ['zh-TW understand-you label', files.zhTW, '"nav.understandYou": "懂你"'],
  ['zh-TW home quick-check CTA', files.zhTW, '"home.cta.button": "開始快速判斷"'],
  ['en-US quick check label', files.enUS, '"nav.quickCheck": "Quick Check"'],
  ['en-US formal handling label', files.enUS, '"nav.formalHandling": "Formal Handling"'],
  ['en-US chat-first label', files.enUS, '"nav.chatToJudgment": "Chat First"'],
  ['en-US understand-you label', files.enUS, '"nav.understandYou": "Understands You"'],
  ['en-US home quick-check CTA', files.enUS, '"home.cta.button": "Start Quick Check"'],
  ['Home tests assert quick-check CTA', files.homeTest, '/開始快速判斷/'],
];

const FORBIDDEN_NAV_SNIPPETS = [
  ['Header old my-cases primary nav', files.header, "t('nav.myCases')"],
  ['Header old execution primary nav', files.header, "t('nav.execution')"],
  ['Header old chat primary nav', files.header, "t('nav.chat')"],
  ['Header old quick experience primary nav', files.header, "t('nav.quickExperience')"],
  ['BottomNav old my-cases primary nav', files.bottomNav, "t('nav.myCases')"],
  ['BottomNav old create-case primary nav', files.bottomNav, "t('nav.createCase')"],
  ['BottomNav old chat primary nav', files.bottomNav, "t('nav.chat')"],
  ['BottomNav old profile primary nav', files.bottomNav, "t('nav.profile')"],
  ['BottomNav old quick experience primary nav', files.bottomNav, "t('nav.quickExperience')"],
];

const failures = [];

for (const [label, content, snippet] of REQUIRED_SNIPPETS) {
  if (!content.includes(snippet)) failures.push(`${label}: missing ${snippet}`);
}

for (const [label, content, snippet] of FORBIDDEN_NAV_SNIPPETS) {
  if (content.includes(snippet)) failures.push(`${label}: forbidden ${snippet}`);
}

if (failures.length > 0) {
  console.error('[web-product-lines-contracts] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[web-product-lines-contracts] ok: Web primary entries use four product-line semantics');
