#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const PENDING_DIR = path.join(
  'docs',
  '核心開發文件',
  '07-待處理問題與治理',
  '待處理'
);

const HANDLED_DIR = path.join(
  'docs',
  '核心開發文件',
  '07-待處理問題與治理',
  '已處理'
);

const EVIDENCE_DIR = path.join(
  'docs',
  '核心開發文件',
  '90-證據與盤點',
  '環境與發版驗證'
);

const REQUIRED_FILES = [
  path.join(HANDLED_DIR, 'Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md'),
  path.join(HANDLED_DIR, 'AI請求Ledger與Notification狀態Schema同步待辦-2026-05-04.md'),
  path.join(EVIDENCE_DIR, 'Web-Pending-Tasks-Completion-Audit-2026-05-14.md'),
  path.join(EVIDENCE_DIR, 'Web-Pending-Tasks-Handoff-2026-05-14.json'),
  path.join(EVIDENCE_DIR, 'Web-A11Y-Manual-Evidence-Runbook-2026-05-12.md'),
  path.join(EVIDENCE_DIR, 'Web-A11Y-Manual-Evidence-Template.json'),
  path.join(EVIDENCE_DIR, 'AI-Pricing-Release-Env-Runbook-2026-05-12.md'),
  path.join(EVIDENCE_DIR, 'AI-Pricing-Release-Env-Pass-Template.json'),
  path.join(EVIDENCE_DIR, 'AI-Pricing-Release-Env-Blocked-2026-05-12T14-38-24Z.json'),
];

const HANDOFF_FILE = path.join(EVIDENCE_DIR, 'Web-Pending-Tasks-Handoff-2026-05-14.json');
const REQUIRED_BLOCKER_IDS = new Set([
  'web_a11y_manual_pass_artifact_missing',
  'ai_pricing_release_pass_artifact_missing',
]);

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    strict: argv.includes('--strict'),
  };
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function listFiles(repoRoot, dir) {
  const absoluteDir = path.resolve(repoRoot, dir);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function isA11YManualPassCandidate(filePath) {
  const name = path.basename(filePath);
  return (
    /^Web-A11Y-Manual-.*\.json$/.test(name) &&
    !/Template|Preflight|Blocked/i.test(name)
  );
}

function isAIPricingPassCandidate(filePath) {
  const name = path.basename(filePath);
  return (
    /^AI-Pricing-Release-Env-.*\.json$/.test(name) &&
    !/Blocked|Runbook|Template|Preflight/i.test(name)
  );
}

function getStatus(value) {
  if (!value || typeof value !== 'object') {
    return '';
  }
  return typeof value.status === 'string' ? value.status : '';
}

function isPassedStatus(value) {
  return getStatus(value) === 'passed';
}

function validateA11YPassArtifact(data) {
  const issues = [];
  if (!isPassedStatus(data)) {
    issues.push('status must be passed');
  }
  if (!data.scope?.keyboard_only?.flows?.length) {
    issues.push('scope.keyboard_only.flows is required');
  }
  if (!data.scope?.screen_reader?.runs?.some((run) => run?.status === 'passed')) {
    issues.push('at least one passed screen reader run is required');
  }
  if (!data.scope?.interactive_surfaces?.surfaces?.length) {
    issues.push('scope.interactive_surfaces.surfaces is required');
  }
  return issues;
}

function validateAIPricingPassArtifact(data) {
  const issues = [];
  if (!isPassedStatus(data)) {
    issues.push('status must be passed');
  }
  const targetClassification =
    data.target?.classification || data.target_classification || '';
  if (!['release', 'production'].includes(targetClassification)) {
    issues.push('target classification must be release or production');
  }
  const pricingStatus =
    data.pricing_gate?.status ||
    data.ai_pricing_check?.status ||
    data.aiPricingCheck?.status ||
    '';
  if (pricingStatus !== 'passed') {
    issues.push('pricing gate status must be passed');
  }
  const releaseDbStatus =
    data.release_db_evidence?.status ||
    data.releaseDbEvidence?.status ||
    data.release_db_parity?.status ||
    '';
  if (releaseDbStatus !== 'passed') {
    issues.push('release DB evidence status must be passed');
  }
  return issues;
}

function validateHandoff(data) {
  const issues = [];
  const isComplete = data.status === 'complete' && data.complete === true;
  const isBlocked = data.status === 'blocked' && data.complete === false;
  if (!isComplete && !isBlocked) {
    issues.push('status/complete must be blocked/false or complete/true');
  }
  if (!Array.isArray(data.blockers)) {
    issues.push('blockers must be an array');
    return issues;
  }

  if (isComplete) {
    if (data.blockers.length !== 0) {
      issues.push('blockers must be empty when complete=true');
    }
    if (!Array.isArray(data.completion_artifacts) || data.completion_artifacts.length === 0) {
      issues.push('completion_artifacts must be a non-empty array when complete=true');
    }
    return issues;
  }

  const blockerIds = new Set();
  for (const [index, blocker] of data.blockers.entries()) {
    if (!blocker || typeof blocker !== 'object') {
      issues.push(`blockers[${index}] must be an object`);
      continue;
    }
    if (typeof blocker.id === 'string') {
      blockerIds.add(blocker.id);
    } else {
      issues.push(`blockers[${index}].id is required`);
    }
    for (const field of ['owner', 'linked_todo', 'required_artifact', 'required_gate']) {
      if (typeof blocker[field] !== 'string' || blocker[field].trim().length === 0) {
        issues.push(`blockers[${index}].${field} is required`);
      }
    }
    if (!Array.isArray(blocker.next_actions) || blocker.next_actions.length === 0) {
      issues.push(`blockers[${index}].next_actions must be a non-empty array`);
    }
  }

  for (const blockerId of REQUIRED_BLOCKER_IDS) {
    if (!blockerIds.has(blockerId)) {
      issues.push(`blockers missing required blocker id: ${blockerId}`);
    }
  }
  return issues;
}

async function collectAudit(repoRoot) {
  const blockers = [];
  const warnings = [];
  const evidenceFiles = await listFiles(repoRoot, EVIDENCE_DIR);

  for (const requiredFile of REQUIRED_FILES) {
    if (!(await fileExists(path.resolve(repoRoot, requiredFile)))) {
      blockers.push({
        id: 'missing_required_file',
        file: requiredFile,
        message: `Required Web pending audit file is missing: ${requiredFile}`,
      });
    }
  }

  if (await fileExists(path.resolve(repoRoot, HANDOFF_FILE))) {
    try {
      const handoffIssues = validateHandoff(await readJson(path.resolve(repoRoot, HANDOFF_FILE)));
      if (handoffIssues.length > 0) {
        blockers.push({
          id: 'web_pending_handoff_invalid',
          file: HANDOFF_FILE,
          issues: handoffIssues,
        });
      }
    } catch (error) {
      blockers.push({
        id: 'web_pending_handoff_unreadable',
        file: HANDOFF_FILE,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const a11yCandidates = evidenceFiles.filter(isA11YManualPassCandidate);
  const aiPricingCandidates = evidenceFiles.filter(isAIPricingPassCandidate);

  if (a11yCandidates.length === 0) {
    blockers.push({
      id: 'web_a11y_manual_pass_artifact_missing',
      message: 'No formal Web-A11Y-Manual-*.json pass artifact found.',
      next_command: 'npm run web:a11y:manual-evidence:check',
    });
  } else {
    for (const candidate of a11yCandidates) {
      try {
        const issues = validateA11YPassArtifact(await readJson(path.resolve(repoRoot, candidate)));
        if (issues.length > 0) {
          blockers.push({
            id: 'web_a11y_manual_pass_artifact_invalid',
            file: candidate,
            issues,
          });
        }
      } catch (error) {
        blockers.push({
          id: 'web_a11y_manual_pass_artifact_unreadable',
          file: candidate,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (aiPricingCandidates.length === 0) {
    blockers.push({
      id: 'ai_pricing_release_pass_artifact_missing',
      message: 'No formal AI-Pricing-Release-Env-*.json release pass artifact found.',
      next_command: 'npm --prefix backend run ops:ai-pricing:check',
    });
  } else {
    for (const candidate of aiPricingCandidates) {
      try {
        const issues = validateAIPricingPassArtifact(await readJson(path.resolve(repoRoot, candidate)));
        if (issues.length > 0) {
          blockers.push({
            id: 'ai_pricing_release_pass_artifact_invalid',
            file: candidate,
            issues,
          });
        }
      } catch (error) {
        blockers.push({
          id: 'ai_pricing_release_pass_artifact_unreadable',
          file: candidate,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (a11yCandidates.length > 0) {
    warnings.push({
      id: 'web_a11y_strict_gate_required',
      message: 'Run npm run web:a11y:manual-evidence:check before treating any A11Y artifact as final.',
    });
  }

  return {
    check: 'web-pending-completion-audit',
    complete: blockers.length === 0,
    pending_task_count: 2,
    handoff_file: HANDOFF_FILE,
    checked_files: REQUIRED_FILES,
    candidates: {
      web_a11y_manual: a11yCandidates,
      ai_pricing_release_env: aiPricingCandidates,
    },
    blocker_ids: blockers.map((blocker) => blocker.id),
    blockers,
    warnings,
  };
}

function printHuman(result) {
  console.log(`[web-pending-completion-audit] complete=${result.complete}`);
  console.log(`[web-pending-completion-audit] pending_task_count=${result.pending_task_count}`);
  console.log(`[web-pending-completion-audit] blockers=${result.blockers.length}`);
  for (const blocker of result.blockers) {
    console.log(`[web-pending-completion-audit] blocker=${blocker.id}`);
    if (blocker.file) {
      console.log(`  file=${blocker.file}`);
    }
    if (blocker.message) {
      console.log(`  message=${blocker.message}`);
    }
    if (blocker.next_command) {
      console.log(`  next_command=${blocker.next_command}`);
    }
    if (blocker.issues?.length) {
      console.log(`  issues=${blocker.issues.join('; ')}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const result = await collectAudit(repoRoot);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }

  if (args.strict && !result.complete) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[web-pending-completion-audit] failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
