#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const EVIDENCE_DIR = path.join(
  'docs',
  '核心開發文件',
  '90-證據與盤點',
  '環境與發版驗證'
);

const REQUIRED_KEYBOARD_FLOWS = new Set([
  'quick_experience',
  'case_list',
  'case_detail',
  'notifications',
  'chat_room',
  'auth',
  'admin_login',
  'admin_ops_jobs',
]);

const REQUIRED_INTERACTION_SURFACES = new Set([
  'modal_dialog',
  'dropdown_menu',
  'toast_status',
  'upload_flow',
  'form_validation_errors',
  'async_loading_status',
  'error_recovery_state',
  'remaining_route_state_matrix',
]);

const ALLOWED_STATUSES = new Set(['passed', 'failed', 'blocked', 'template']);
const ALLOWED_RUN_STATUSES = new Set(['passed', 'failed', 'blocked']);
const ALLOWED_SCREEN_READER_TOOLS = new Set([
  'VoiceOver',
  'NVDA',
  'JAWS',
  'Narrator',
  'TalkBack',
]);
const REQUIRED_NON_CLAIMS = [
  'no_wcag_2_2_aa_claim',
  'no_full_screen_reader_claim',
  'no_full_state_matrix_claim',
];

function parseArgs(argv) {
  const args = {
    files: [],
    dir: '',
    strict: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--file') {
      args.files.push(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (token === '--dir') {
      args.dir = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--strict') {
      args.strict = true;
      continue;
    }
  }

  args.files = args.files.filter(Boolean);
  return args;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function listEvidenceFiles(repoRoot, args) {
  if (args.files.length > 0) {
    return args.files.map((file) => path.resolve(repoRoot, file));
  }

  const evidenceDir = path.resolve(repoRoot, args.dir || EVIDENCE_DIR);
  const entries = await fs.readdir(evidenceDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^Web-A11Y-Manual-.*\.json$/.test(name))
    .filter((name) => !/Template/i.test(name))
    .filter((name) => !/Preflight|Blocked/i.test(name))
    .sort()
    .map((name) => path.join(evidenceDir, name));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function validateStatus(value, allowed, field, issues) {
  if (!nonEmptyString(value) || !allowed.has(value)) {
    issues.push(`${field} must be one of: ${Array.from(allowed).join(', ')}`);
  }
}

function validateRequiredStrings(target, fields, prefix, issues) {
  for (const field of fields) {
    if (!nonEmptyString(target?.[field])) {
      issues.push(`${prefix}.${field} is required`);
    }
  }
}

function validateArtifacts(repoRoot, data, issues, options) {
  if (!Array.isArray(data.artifacts)) {
    issues.push('artifacts must be an array');
    return;
  }

  if (options.strict && data.artifacts.length === 0) {
    issues.push('artifacts must include at least one artifact in strict mode');
  }

  for (const [index, artifact] of data.artifacts.entries()) {
    if (!isObject(artifact)) {
      issues.push(`artifacts[${index}] must be an object`);
      continue;
    }
    validateRequiredStrings(artifact, ['type', 'path', 'description'], `artifacts[${index}]`, issues);
    if (options.strict && nonEmptyString(artifact.path)) {
      const artifactPath = path.isAbsolute(artifact.path)
        ? artifact.path
        : path.resolve(repoRoot, artifact.path);
      if (!options.pendingArtifactPaths?.has(artifact.path)) {
        options.artifactChecks.push(
          fileExists(artifactPath).then((exists) => {
            if (!exists) {
              issues.push(`artifacts[${index}].path does not exist: ${artifact.path}`);
            }
          })
        );
      }
    }
  }
}

function validateKeyboard(data, issues, options) {
  const keyboard = data.scope?.keyboard_only;
  if (!isObject(keyboard)) {
    issues.push('scope.keyboard_only is required');
    return;
  }
  if (!Array.isArray(keyboard.flows)) {
    issues.push('scope.keyboard_only.flows must be an array');
    return;
  }

  const seenFlowIds = new Set();
  for (const [index, flow] of keyboard.flows.entries()) {
    if (!isObject(flow)) {
      issues.push(`scope.keyboard_only.flows[${index}] must be an object`);
      continue;
    }
    validateRequiredStrings(
      flow,
      ['id', 'name', 'status', 'focus_order', 'steps', 'issues'],
      `scope.keyboard_only.flows[${index}]`,
      issues
    );
    validateStatus(flow.status, ALLOWED_RUN_STATUSES, `scope.keyboard_only.flows[${index}].status`, issues);
    if (nonEmptyString(flow.id)) {
      seenFlowIds.add(flow.id);
    }
    if (options.strict && flow.status !== 'passed') {
      issues.push(`scope.keyboard_only.flows[${index}] must be passed in strict mode`);
    }
  }

  if (options.strict) {
    for (const flowId of REQUIRED_KEYBOARD_FLOWS) {
      if (!seenFlowIds.has(flowId)) {
        issues.push(`scope.keyboard_only.flows missing required flow: ${flowId}`);
      }
    }
  }
}

function validateScreenReader(data, issues, options) {
  const screenReader = data.scope?.screen_reader;
  if (!isObject(screenReader)) {
    issues.push('scope.screen_reader is required');
    return;
  }
  if (!Array.isArray(screenReader.runs)) {
    issues.push('scope.screen_reader.runs must be an array');
    return;
  }

  let hasPassedRun = false;
  for (const [index, run] of screenReader.runs.entries()) {
    if (!isObject(run)) {
      issues.push(`scope.screen_reader.runs[${index}] must be an object`);
      continue;
    }
    validateRequiredStrings(
      run,
      ['tool', 'browser', 'os', 'status', 'observations', 'issues'],
      `scope.screen_reader.runs[${index}]`,
      issues
    );
    validateStatus(run.status, ALLOWED_RUN_STATUSES, `scope.screen_reader.runs[${index}].status`, issues);
    if (nonEmptyString(run.tool) && !ALLOWED_SCREEN_READER_TOOLS.has(run.tool)) {
      issues.push(
        `scope.screen_reader.runs[${index}].tool must be one of: ${Array.from(
          ALLOWED_SCREEN_READER_TOOLS
        ).join(', ')}`
      );
    }
    if (!Array.isArray(run.flows) || run.flows.length === 0) {
      issues.push(`scope.screen_reader.runs[${index}].flows must be a non-empty array`);
    }
    if (run.status === 'passed') {
      hasPassedRun = true;
    }
    if (options.strict && run.status !== 'passed') {
      issues.push(`scope.screen_reader.runs[${index}] must be passed in strict mode`);
    }
  }

  if (options.strict && !hasPassedRun) {
    issues.push('scope.screen_reader.runs must include at least one passed run in strict mode');
  }
}

function validateInteractiveSurfaces(data, issues, options) {
  const surfaces = data.scope?.interactive_surfaces;
  if (!isObject(surfaces)) {
    issues.push('scope.interactive_surfaces is required');
    return;
  }
  if (!Array.isArray(surfaces.surfaces)) {
    issues.push('scope.interactive_surfaces.surfaces must be an array');
    return;
  }

  const seenSurfaceIds = new Set();
  for (const [index, surface] of surfaces.surfaces.entries()) {
    if (!isObject(surface)) {
      issues.push(`scope.interactive_surfaces.surfaces[${index}] must be an object`);
      continue;
    }
    validateRequiredStrings(
      surface,
      ['id', 'name', 'status', 'coverage', 'keyboard_behavior', 'screen_reader_behavior', 'issues'],
      `scope.interactive_surfaces.surfaces[${index}]`,
      issues
    );
    validateStatus(surface.status, ALLOWED_RUN_STATUSES, `scope.interactive_surfaces.surfaces[${index}].status`, issues);
    if (nonEmptyString(surface.id)) {
      seenSurfaceIds.add(surface.id);
    }
    if (options.strict && surface.status !== 'passed') {
      issues.push(`scope.interactive_surfaces.surfaces[${index}] must be passed in strict mode`);
    }
  }

  if (options.strict) {
    for (const surfaceId of REQUIRED_INTERACTION_SURFACES) {
      if (!seenSurfaceIds.has(surfaceId)) {
        issues.push(`scope.interactive_surfaces.surfaces missing required surface: ${surfaceId}`);
      }
    }
  }
}

function validateNonClaims(data, issues) {
  if (!Array.isArray(data.non_claims)) {
    issues.push('non_claims must be an array');
    return;
  }
  for (const claim of REQUIRED_NON_CLAIMS) {
    if (!data.non_claims.includes(claim)) {
      issues.push(`non_claims missing required boundary: ${claim}`);
    }
  }
}

async function validateEvidenceFile(repoRoot, file, options) {
  const issues = [];
  const artifactChecks = [];
  const data = JSON.parse(await fs.readFile(file, 'utf8'));

  if (!isObject(data)) {
    return ['root must be an object'];
  }

  validateRequiredStrings(data, ['evidence', 'status', 'generated_at', 'operator'], 'root', issues);
  if (data.evidence !== 'web-a11y-manual-evidence') {
    issues.push('root.evidence must be web-a11y-manual-evidence');
  }
  validateStatus(data.status, ALLOWED_STATUSES, 'root.status', issues);
  if (options.strict && data.status !== 'passed') {
    issues.push('root.status must be passed in strict mode');
  }
  if (nonEmptyString(data.generated_at) && Number.isNaN(Date.parse(data.generated_at))) {
    issues.push('root.generated_at must be an ISO-compatible timestamp');
  }
  if (!isObject(data.environment)) {
    issues.push('environment is required');
  } else {
    validateRequiredStrings(data.environment, ['web_url', 'admin_url', 'browser', 'os'], 'environment', issues);
  }
  if (!isObject(data.scope)) {
    issues.push('scope is required');
  } else {
    validateKeyboard(data, issues, options);
    validateScreenReader(data, issues, options);
    validateInteractiveSurfaces(data, issues, options);
  }
  validateNonClaims(data, issues);
  validateArtifacts(repoRoot, data, issues, {
    ...options,
    artifactChecks,
  });
  await Promise.all(artifactChecks);

  return issues;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
  const files = await listEvidenceFiles(repoRoot, args);

  if (files.length === 0) {
    throw new Error(
      `No Web-A11Y-Manual-*.json evidence files found. Use --file to validate a specific file.`
    );
  }

  let hasIssues = false;
  for (const file of files) {
    const relativeFile = path.relative(repoRoot, file);
    const issues = await validateEvidenceFile(repoRoot, file, args);
    if (issues.length > 0) {
      hasIssues = true;
    }
    process.stdout.write(
      [
        `[web-a11y-manual-evidence] file=${relativeFile}`,
        `[web-a11y-manual-evidence] mode=${args.strict ? 'strict' : 'schema'}`,
        `[web-a11y-manual-evidence] status=${issues.length === 0 ? 'passed' : 'failed'}`,
        `[web-a11y-manual-evidence] issues=${issues.length === 0 ? 'none' : issues.join('; ')}`,
      ].join('\n') + '\n'
    );
  }

  if (hasIssues) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    `[web-a11y-manual-evidence] failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
