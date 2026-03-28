import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');

const criticalE2eFiles = [
  'frontend/e2e/chat/chat-failure-matrix.e2e.ts',
  'frontend/e2e/chat/judgment-handoff.e2e.ts',
  'frontend/e2e/chat/quick-experience-claim-session.e2e.ts',
  'frontend/e2e/chat/quick-experience-flow.e2e.ts',
  'frontend/e2e/chat/execution-flow.e2e.ts',
  'frontend/e2e/chat/interview-recovery-flow.e2e.ts',
];

const skipPattern = /\b(?:test|it|describe)\.skip\s*\(/g;

function lineColFromIndex(content, index) {
  const prefix = content.slice(0, index);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    col: lines[lines.length - 1].length + 1,
  };
}

async function checkFile(relativePath) {
  const absPath = path.join(repoRoot, relativePath);
  const content = await fs.readFile(absPath, 'utf8');
  const violations = [];

  skipPattern.lastIndex = 0;
  let match = skipPattern.exec(content);
  while (match) {
    const loc = lineColFromIndex(content, match.index);
    violations.push({
      file: relativePath,
      line: loc.line,
      col: loc.col,
      snippet: match[0],
    });
    match = skipPattern.exec(content);
  }

  return violations;
}

async function main() {
  const allViolations = [];

  for (const relativePath of criticalE2eFiles) {
    try {
      const violations = await checkFile(relativePath);
      allViolations.push(...violations);
    } catch (error) {
      console.error(
        `[critical-e2e-skip-guard] failed to read ${relativePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      process.exit(1);
    }
  }

  if (allViolations.length > 0) {
    console.error('[critical-e2e-skip-guard] found forbidden .skip usages in critical E2E files:');
    for (const violation of allViolations) {
      console.error(
        `- ${violation.file}:${violation.line}:${violation.col} (${violation.snippet})`
      );
    }
    process.exit(1);
  }

  console.log(
    `[critical-e2e-skip-guard] ok: checked ${criticalE2eFiles.length} files, no .skip found`
  );
}

main().catch((error) => {
  console.error(
    `[critical-e2e-skip-guard] failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
