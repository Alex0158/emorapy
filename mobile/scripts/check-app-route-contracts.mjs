#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mobileRoot = path.join(repoRoot, 'mobile');
const appRoot = path.join(mobileRoot, 'app');

const requiredRouteFiles = [
  '+html.tsx',
  '+not-found.tsx',
  '_layout.tsx',
  'modal.tsx',
  '(public)/_layout.tsx',
  '(public)/index.tsx',
  '(public)/auth/index.tsx',
  '(public)/quick/index.tsx',
  '(public)/quick/collaborative.tsx',
  '(public)/quick/result.tsx',
  '(app)/_layout.tsx',
  '(app)/case/index.tsx',
  '(app)/chat/index.tsx',
  '(app)/chat/invite.tsx',
  '(app)/chat/room.tsx',
  '(app)/notifications/index.tsx',
  '(app)/profile/index.tsx',
  '(app)/profile/interview.tsx',
  '(app)/profile/story.tsx',
  '(app)/repair/index.tsx',
];

const forbiddenRouteFiles = [
  '(tabs)/_layout.tsx',
  '(tabs)/index.tsx',
  '(tabs)/two.tsx',
  'tabs/_layout.tsx',
  'tabs/index.tsx',
  'tabs/two.tsx',
];

const requiredDirectories = [
  '(public)',
  '(public)/auth',
  '(public)/quick',
  '(app)',
  '(app)/case',
  '(app)/chat',
  '(app)/notifications',
  '(app)/profile',
  '(app)/repair',
];

const layoutContracts = [
  {
    file: '_layout.tsx',
    label: 'root stack',
    needles: [
      "initialRouteName: '(public)'",
      '<AppProviders>',
      '<DeepLinkLandingHandler />',
      '<NotificationLandingHandler />',
      '<Stack.Screen name="(public)"',
      '<Stack.Screen name="(app)"',
      '<Stack.Screen name="modal"',
    ],
  },
  {
    file: '(public)/_layout.tsx',
    label: 'public stack',
    needles: [
      '<Stack.Screen name="index"',
      '<Stack.Screen name="quick/index"',
      '<Stack.Screen name="quick/collaborative"',
      '<Stack.Screen name="quick/result"',
      '<Stack.Screen name="auth/index"',
    ],
  },
  {
    file: '(app)/_layout.tsx',
    label: 'authenticated tabs',
    needles: [
      '<Tabs.Screen',
      'name="case/index"',
      'name="chat/index"',
      'name="chat/room"',
      'name="chat/invite"',
      'name="profile/index"',
      'name="profile/interview"',
      'name="profile/story"',
      'name="notifications/index"',
      'name="repair/index"',
      "title: '案件'",
      "title: '對話'",
      "title: '個人'",
      "title: '提醒'",
      "title: '修復'",
    ],
  },
];

const hiddenAuthenticatedRoutes = [
  'chat/room',
  'chat/invite',
  'profile/interview',
  'profile/story',
];

const forbiddenSourcePatterns = [
  { pattern: /\bTab One\b/, reason: 'Expo template Tab One label' },
  { pattern: /\bTab Two\b/, reason: 'Expo template Tab Two label' },
  { pattern: /\bExplore\b/, reason: 'Expo template Explore label' },
  { pattern: /\bHello World\b/, reason: 'template placeholder copy' },
];

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function listRouteFiles(dir = appRoot) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(absolute));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(toPosix(path.relative(appRoot, absolute)));
    }
  }
  return files.sort();
}

function readRoute(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

const failures = [];
const actualFiles = listRouteFiles();
const actualFileSet = new Set(actualFiles);
const requiredFileSet = new Set(requiredRouteFiles);

for (const relativePath of requiredRouteFiles) {
  if (!actualFileSet.has(relativePath)) {
    failures.push(`missing required route file: mobile/app/${relativePath}`);
  }
}

for (const relativePath of forbiddenRouteFiles) {
  if (fs.existsSync(path.join(appRoot, relativePath))) {
    failures.push(`forbidden template route still exists: mobile/app/${relativePath}`);
  }
}

for (const relativePath of actualFiles) {
  if (!requiredFileSet.has(relativePath)) {
    failures.push(`unexpected App route file requires contract update: mobile/app/${relativePath}`);
  }
}

for (const relativePath of requiredDirectories) {
  const absolutePath = path.join(appRoot, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    failures.push(`missing required route directory: mobile/app/${relativePath}`);
  }
}

for (const contract of layoutContracts) {
  if (!actualFileSet.has(contract.file)) continue;
  const source = readRoute(contract.file);
  for (const needle of contract.needles) {
    if (!source.includes(needle)) {
      failures.push(`${contract.label} layout missing ${needle} in mobile/app/${contract.file}`);
    }
  }
}

const appLayout = actualFileSet.has('(app)/_layout.tsx') ? readRoute('(app)/_layout.tsx') : '';
for (const route of hiddenAuthenticatedRoutes) {
  const routeIndex = appLayout.indexOf(`name="${route}"`);
  if (routeIndex < 0) continue;
  const blockEnd = appLayout.indexOf('</Tabs.Screen>', routeIndex);
  const selfClosingEnd = appLayout.indexOf('/>', routeIndex);
  const endIndex =
    blockEnd >= 0 && (selfClosingEnd < 0 || blockEnd < selfClosingEnd)
      ? blockEnd
      : selfClosingEnd >= 0
        ? selfClosingEnd
        : routeIndex;
  const block = appLayout.slice(routeIndex, endIndex);
  if (!block.includes('href: null')) {
    failures.push(`authenticated deep route ${route} must be hidden from the tab bar with href: null`);
  }
}

for (const relativePath of actualFiles) {
  const source = readRoute(relativePath);
  for (const { pattern, reason } of forbiddenSourcePatterns) {
    if (pattern.test(source)) {
      failures.push(`forbidden ${reason} found in mobile/app/${relativePath}`);
    }
  }
}

if (failures.length) {
  console.error('[app-route-contracts] route contract failures:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `[app-route-contracts] ok: ${requiredRouteFiles.length} App route files pinned across public/app/modal topology`
);
