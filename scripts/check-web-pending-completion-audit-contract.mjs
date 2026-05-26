#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const REQUIRED_BLOCKER_IDS = [
  'web_a11y_manual_pass_artifact_missing',
  'ai_pricing_release_pass_artifact_missing',
];

const REQUIRED_CHECKED_FILE_FRAGMENTS = [
  'Web-Pending-Tasks-Completion-Audit-2026-05-14.md',
  'Web-Pending-Tasks-Handoff-2026-05-14.json',
  'Web-A11Y-Manual-Evidence-Template.json',
  'AI-Pricing-Release-Env-Pass-Template.json',
];

function runCommand(args) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function assert(condition, message, issues) {
  if (!condition) {
    issues.push(message);
  }
}

function parseJsonFromStdout(stdout) {
  const start = stdout.indexOf('{');
  if (start < 0) {
    throw new Error('stdout does not contain JSON object');
  }
  return JSON.parse(stdout.slice(start));
}

const issues = [];

const nonStrict = runCommand([
  'scripts/check-web-pending-completion-audit.mjs',
  '--json',
]);

assert(nonStrict.status === 0, 'non-strict audit must exit 0', issues);

let audit = null;
try {
  audit = parseJsonFromStdout(nonStrict.stdout);
} catch (error) {
  issues.push(`non-strict audit JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (audit) {
  assert(audit.check === 'web-pending-completion-audit', 'audit.check mismatch', issues);
  assert(audit.complete === true, 'audit.complete must be true after formal pass artifacts exist', issues);
  assert(audit.pending_task_count === 2, 'pending_task_count must be 2', issues);
  assert(typeof audit.handoff_file === 'string' && audit.handoff_file.endsWith('Web-Pending-Tasks-Handoff-2026-05-14.json'), 'handoff_file must point to Web handoff JSON', issues);

  const blockerIds = new Set(audit.blocker_ids || []);
  assert(blockerIds.size === 0, 'blocker_ids must be empty after completion', issues);

  const checkedFiles = audit.checked_files || [];
  for (const fragment of REQUIRED_CHECKED_FILE_FRAGMENTS) {
    assert(
      checkedFiles.some((file) => typeof file === 'string' && file.includes(fragment)),
      `checked_files missing required file fragment: ${fragment}`,
      issues
    );
  }

  assert(Array.isArray(audit.candidates?.web_a11y_manual), 'web_a11y_manual candidates must be an array', issues);
  assert(Array.isArray(audit.candidates?.ai_pricing_release_env), 'ai_pricing_release_env candidates must be an array', issues);
  assert(audit.candidates.web_a11y_manual.length > 0, 'web_a11y_manual candidate must exist after completion', issues);
  assert(audit.candidates.ai_pricing_release_env.length > 0, 'ai_pricing_release_env candidate must exist after completion', issues);
}

const strict = runCommand([
  'scripts/check-web-pending-completion-audit.mjs',
  '--strict',
]);

assert(strict.status === 0, 'strict audit must exit 0 after blockers are cleared', issues);
for (const blockerId of REQUIRED_BLOCKER_IDS) {
  assert(!strict.stdout.includes(blockerId), `strict stdout must not include cleared blocker id: ${blockerId}`, issues);
}

if (issues.length > 0) {
  console.error('[web-pending-completion-audit-contract] failed');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('[web-pending-completion-audit-contract] ok');
