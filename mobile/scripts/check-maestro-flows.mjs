import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appJsonPath = path.join(mobileRoot, 'app.json');
const flowDir = path.join(mobileRoot, 'maestro');

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const iosBundleId = appJson.expo?.ios?.bundleIdentifier;
const androidPackage = appJson.expo?.android?.package;

if (!iosBundleId || !androidPackage || iosBundleId !== androidPackage) {
  console.error('[maestro-check] iOS bundle id and Android package must both be set and aligned.');
  process.exit(1);
}

const requiredFlows = new Map([
  ['00-public-navigation-smoke.yaml', [
    'public.home.screen',
    'public.home.quick',
    'quick.screen',
    'quick.home',
    'public.home.auth',
    'auth.screen',
    'auth.home',
  ]],
  ['10-quick-auth-form-smoke.yaml', [
    'public.home.screen',
    'public.home.quick',
    'quick.screen',
    'quick.plaintiff.input',
    'quick.defendant.input',
    'quick.submit',
    'public.home.auth',
    'auth.screen',
    'auth.mode.register',
    'auth.nickname.input',
    'auth.email.input',
    'auth.password.input',
    'auth.submit',
  ]],
  ['20-chat-entry-auth-gate-smoke.yaml', [
    'public.home.screen',
    'public.home.chat',
    'chat.home.screen',
    'chat.home.invite-code.input',
    'chat.home.accept-invite',
    'chat.home.open-invite',
    'chat.invite.screen',
    'chat.invite.code.input',
    'chat.invite.back',
    'chat.home.create-room',
    'chat.home.case',
    'chat.home.profile',
    'auth.screen',
    'auth.email.input',
  ]],
  ['30-notification-landing-auth-gate-smoke.yaml', [
    'auth.screen',
    'auth.email.input',
  ]],
  ['40-profile-interview-auth-gate-smoke.yaml', [
    'auth.screen',
    'auth.email.input',
  ]],
  ['50-case-repair-auth-gate-smoke.yaml', [
    'public.home.screen',
    'public.home.app',
    'case.auth-gate.screen',
    'case.auth-gate.quick',
    'quick.screen',
    'auth.screen',
    'auth.email.input',
  ]],
  ['60-deep-link-auth-resume-smoke.yaml', [
    'auth.screen',
    'auth.email.input',
    'quick.screen',
  ]],
]);

const missing = [];
const requiredSelectorIds = new Set([...requiredFlows.values()].flat());

function collectSourceFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) return [];
    return [entryPath];
  });
}

const sourceText = [
  ...collectSourceFiles(path.join(mobileRoot, 'app')),
  ...collectSourceFiles(path.join(mobileRoot, 'src')),
].map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');

for (const [fileName, requiredIds] of requiredFlows) {
  const filePath = path.join(flowDir, fileName);
  if (!fs.existsSync(filePath)) {
    missing.push(`${fileName}: file missing`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(`appId: ${iosBundleId}`)) {
    missing.push(`${fileName}: appId must match ${iosBundleId}`);
  }
  if (!/^name:\s+.+$/m.test(content)) {
    missing.push(`${fileName}: name missing`);
  }
  if (!content.includes('\n---\n')) {
    missing.push(`${fileName}: Maestro document separator missing`);
  }

  for (const id of requiredIds) {
    const idPattern = new RegExp(`id:\\s+${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    if (!idPattern.test(content)) {
      missing.push(`${fileName}: missing selector id ${id}`);
    }
  }
}

for (const id of requiredSelectorIds) {
  if (!sourceText.includes(`testID="${id}"`) && !sourceText.includes(`testID='${id}'`)) {
    missing.push(`source: missing testID ${id}`);
  }
}

if (missing.length > 0) {
  console.error(`[maestro-check] failed with ${missing.length} issue(s):`);
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log(`[maestro-check] ok: ${requiredFlows.size} flow files and ${requiredSelectorIds.size} selector ids checked for appId ${iosBundleId}`);
