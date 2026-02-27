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

describe('benchmark-chat-judgment-concurrency script', () => {
  it('DRY_RUN=true 且數字 env 非法時應回退到預設值', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'judgment-dry-run-invalid-number.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-judgment-concurrency.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      BURST_SIZE: 'oops',
      STATUS_POLL_TIMES: 'oops',
      STATUS_POLL_INTERVAL_MS: 'oops',
      REQUEST_TIMEOUT_MS: 'oops',
      REPORT_PATH: reportPath,
      API_BASE_URL: 'http://localhost:3001/api/v1',
    });

    expect(exitCode).toBe(0);
    const reportRaw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(reportRaw) as {
      passed: boolean;
      dryRun: boolean;
      config: {
        burstSize: number;
        statusPollTimes: number;
        statusPollIntervalMs: number;
        requestTimeoutMs: number;
      };
    };

    expect(report.passed).toBe(true);
    expect(report.dryRun).toBe(true);
    expect(report.config.burstSize).toBe(20);
    expect(report.config.statusPollTimes).toBe(15);
    expect(report.config.statusPollIntervalMs).toBe(1000);
    expect(report.config.requestTimeoutMs).toBe(15000);
  });

  it('DRY_RUN=true 且數字 env 過小時應套用下限', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'judgment-dry-run-min-clamp.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-judgment-concurrency.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      BURST_SIZE: '0',
      STATUS_POLL_TIMES: '0',
      STATUS_POLL_INTERVAL_MS: '1',
      REQUEST_TIMEOUT_MS: '1',
      REPORT_PATH: reportPath,
      API_BASE_URL: 'http://localhost:3001/api/v1',
    });

    expect(exitCode).toBe(0);
    const reportRaw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(reportRaw) as {
      config: {
        burstSize: number;
        statusPollTimes: number;
        statusPollIntervalMs: number;
        requestTimeoutMs: number;
      };
    };

    expect(report.config.burstSize).toBe(2);
    expect(report.config.statusPollTimes).toBe(1);
    expect(report.config.statusPollIntervalMs).toBe(200);
    expect(report.config.requestTimeoutMs).toBe(1000);
  });

  it('DRY_RUN=true 且數字 env 為空字串時應回退預設值', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'judgment-dry-run-empty-string.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-judgment-concurrency.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      BURST_SIZE: '',
      STATUS_POLL_TIMES: '',
      STATUS_POLL_INTERVAL_MS: '',
      REQUEST_TIMEOUT_MS: '',
      REPORT_PATH: reportPath,
      API_BASE_URL: 'http://localhost:3001/api/v1',
    });

    expect(exitCode).toBe(0);
    const reportRaw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(reportRaw) as {
      config: {
        burstSize: number;
        statusPollTimes: number;
        statusPollIntervalMs: number;
        requestTimeoutMs: number;
      };
    };

    expect(report.config.burstSize).toBe(20);
    expect(report.config.statusPollTimes).toBe(15);
    expect(report.config.statusPollIntervalMs).toBe(1000);
    expect(report.config.requestTimeoutMs).toBe(15000);
  });

  it('DRY_RUN=true 且數字 env 過大時應套用上限', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'judgment-dry-run-max-clamp.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-judgment-concurrency.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      BURST_SIZE: '999999',
      STATUS_POLL_TIMES: '999999',
      STATUS_POLL_INTERVAL_MS: '999999',
      REQUEST_TIMEOUT_MS: '999999',
      REPORT_PATH: reportPath,
      API_BASE_URL: 'http://localhost:3001/api/v1',
    });

    expect(exitCode).toBe(0);
    const reportRaw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(reportRaw) as {
      config: {
        burstSize: number;
        statusPollTimes: number;
        statusPollIntervalMs: number;
        requestTimeoutMs: number;
      };
    };

    expect(report.config.burstSize).toBe(200);
    expect(report.config.statusPollTimes).toBe(120);
    expect(report.config.statusPollIntervalMs).toBe(60000);
    expect(report.config.requestTimeoutMs).toBe(120000);
  });

  it('DRY_RUN=false 且缺少 AUTH_TOKEN/SESSION_ID 時應快速失敗', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'judgment-no-auth-fail.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-judgment-concurrency.ts'], {
      ...process.env,
      DRY_RUN: 'false',
      AUTH_TOKEN: '',
      SESSION_ID: '',
      REPORT_PATH: reportPath,
      API_BASE_URL: 'http://localhost:3001/api/v1',
    });

    expect(exitCode).toBe(1);
  });
});
