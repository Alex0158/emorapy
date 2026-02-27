import { describe, it, expect } from '@jest/globals';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: path.resolve(__dirname, '../../../'),
      env,
      stdio: 'pipe',
    });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

describe('benchmark-chat-concurrency-gate script', () => {
  it('空字串 gate bool 應回退預設值（兩項檢查皆執行）', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'gate-empty-bool.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-concurrency-gate.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      GATE_RUN_JUDGMENT: '',
      GATE_RUN_INVITE_ACCEPT: '',
      GATE_REPORT_PATH: reportPath,
      GATE_REPORT_DIR: reportDir,
    });

    expect(exitCode).toBe(0);
    const reportRaw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(reportRaw) as {
      passed: boolean;
      checks: Array<{ name: string }>;
    };
    expect(report.passed).toBe(true);
    expect(report.checks).toHaveLength(2);
    expect(report.checks.map((x) => x.name).sort()).toEqual(['invite_accept', 'judgment']);
  });

  it('明確關閉兩項 gate 時應失敗', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'gate-disabled.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-concurrency-gate.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      GATE_RUN_JUDGMENT: 'false',
      GATE_RUN_INVITE_ACCEPT: 'false',
      GATE_REPORT_PATH: reportPath,
      GATE_REPORT_DIR: reportDir,
    });

    expect(exitCode).toBe(1);
  });

  it('未知 gate bool 值應回退預設值（避免 typo 關閉檢查）', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'gate-unknown-bool.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-concurrency-gate.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      GATE_RUN_JUDGMENT: 'maybe',
      GATE_RUN_INVITE_ACCEPT: 'whatever',
      GATE_REPORT_PATH: reportPath,
      GATE_REPORT_DIR: reportDir,
    });

    expect(exitCode).toBe(0);
    const reportRaw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(reportRaw) as {
      passed: boolean;
      checks: Array<{ name: string }>;
    };
    expect(report.passed).toBe(true);
    expect(report.checks).toHaveLength(2);
    expect(report.checks.map((x) => x.name).sort()).toEqual(['invite_accept', 'judgment']);
  });
});
