import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const args = { date: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--date') {
      args.date = argv[i + 1] || '';
      i += 1;
    }
  }
  return args;
}

function runStep(step, command, args) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`[manual-gate] step=${step}\n`);
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`step ${step} failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sharedDateArgs = args.date ? ['--date', args.date] : [];

  await runStep('check', 'node', [
    'scripts/check-manual-regression-status.mjs',
    ...sharedDateArgs,
  ]);
  await runStep('check-strict', 'node', [
    'scripts/check-manual-regression-status.mjs',
    '--require-evidence',
    ...sharedDateArgs,
  ]);
  await runStep('summarize', 'node', [
    'scripts/summarize-manual-regression.mjs',
    ...sharedDateArgs,
  ]);

  process.stdout.write('[manual-gate] done\n');
}

main().catch((error) => {
  console.error(`[manual-gate] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
