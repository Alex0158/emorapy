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

    child.on('close', (code) => {
      resolve(code ?? 1);
    });
    child.on('error', () => {
      resolve(1);
    });
  });
}

describe('benchmark-chat-invite-accept-concurrency script', () => {
  it('DRY_RUN=true 且缺少 INVITEE_TOKENS 時仍應成功並產出報告', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'invite-accept-dry-run.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-invite-accept-concurrency.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      INVITEE_TOKENS: '',
      OWNER_AUTH_TOKEN: '',
      BURST_SIZE: 'oops',
      EXPIRES_IN_HOURS: 'oops',
      REQUEST_TIMEOUT_MS: 'oops',
      REPORT_PATH: reportPath,
      API_BASE_URL: 'http://localhost:3001/api/v1',
    });

    expect(exitCode).toBe(0);

    const reportRaw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(reportRaw) as {
      passed: boolean;
      dryRun: boolean;
      config?: {
        burstSize?: number;
        inviteeTokenCount?: number;
        distinctInviteeTokenCount?: number;
        tokenDiversityLimited?: boolean;
        expiresInHours?: number;
        requestTimeoutMs?: number;
      };
    };
    expect(report.passed).toBe(true);
    expect(report.dryRun).toBe(true);
    expect(report.config?.burstSize).toBe(2);
    expect(report.config?.inviteeTokenCount).toBe(0);
    expect(report.config?.distinctInviteeTokenCount).toBe(0);
    expect(report.config?.tokenDiversityLimited).toBe(true);
    expect(report.config?.expiresInHours).toBe(24);
    expect(report.config?.requestTimeoutMs).toBe(15000);
  });

  it('DRY_RUN=false 且缺少 INVITEE_TOKENS 時應失敗', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'invite-accept-no-token.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-invite-accept-concurrency.ts'], {
      ...process.env,
      DRY_RUN: 'false',
      INVITEE_TOKENS: '',
      OWNER_AUTH_TOKEN: '',
      REPORT_PATH: reportPath,
      API_BASE_URL: 'http://localhost:3001/api/v1',
    });

    expect(exitCode).toBe(1);
  });

  it('DRY_RUN=true 且數字 env 為空字串時應回退預設值', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'invite-accept-empty-string.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-invite-accept-concurrency.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      INVITEE_TOKENS: 'tokA,tokB,tokC,tokD,tokE',
      BURST_SIZE: '',
      EXPIRES_IN_HOURS: '',
      REQUEST_TIMEOUT_MS: '',
      OWNER_AUTH_TOKEN: '',
      REPORT_PATH: reportPath,
      API_BASE_URL: 'http://localhost:3001/api/v1',
    });

    expect(exitCode).toBe(0);

    const reportRaw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(reportRaw) as {
      config?: {
        burstSize?: number;
        inviteeTokenCount?: number;
        expiresInHours?: number;
        requestTimeoutMs?: number;
      };
    };
    expect(report.config?.inviteeTokenCount).toBe(5);
    expect(report.config?.burstSize).toBe(5);
    expect(report.config?.expiresInHours).toBe(24);
    expect(report.config?.requestTimeoutMs).toBe(15000);
  });

  it('DRY_RUN=true 且 BURST_SIZE 空字串時，fallback 仍應套用上限', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'invite-accept-fallback-max-clamp.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const manyTokens = Array.from({ length: 300 }, (_, i) => `tok-${i + 1}`).join(',');
    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-invite-accept-concurrency.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      INVITEE_TOKENS: manyTokens,
      BURST_SIZE: '',
      EXPIRES_IN_HOURS: '',
      REQUEST_TIMEOUT_MS: '',
      OWNER_AUTH_TOKEN: '',
      REPORT_PATH: reportPath,
      API_BASE_URL: 'http://localhost:3001/api/v1',
    });

    expect(exitCode).toBe(0);
    const reportRaw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(reportRaw) as {
      config?: {
        burstSize?: number;
        inviteeTokenCount?: number;
      };
    };
    expect(report.config?.inviteeTokenCount).toBe(300);
    expect(report.config?.burstSize).toBe(200);
  });

  it('DRY_RUN=true 且數字 env 過大時應套用上限', async () => {
    const reportDir = path.resolve(__dirname, '../../../tmp/test-reports');
    const reportPath = path.join(reportDir, 'invite-accept-max-clamp.json');

    await mkdir(reportDir, { recursive: true });
    await rm(reportPath, { force: true });

    const exitCode = await runCommand('npx', ['tsx', 'scripts/benchmark-chat-invite-accept-concurrency.ts'], {
      ...process.env,
      DRY_RUN: 'true',
      INVITEE_TOKENS: 'tokA,tokB,tokC,tokD,tokE',
      BURST_SIZE: '999999',
      EXPIRES_IN_HOURS: '999999',
      REQUEST_TIMEOUT_MS: '999999',
      OWNER_AUTH_TOKEN: '',
      REPORT_PATH: reportPath,
      API_BASE_URL: 'http://localhost:3001/api/v1',
    });

    expect(exitCode).toBe(0);

    const reportRaw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(reportRaw) as {
      config?: {
        burstSize?: number;
        expiresInHours?: number;
        requestTimeoutMs?: number;
      };
    };
    expect(report.config?.burstSize).toBe(200);
    expect(report.config?.expiresInHours).toBe(168);
    expect(report.config?.requestTimeoutMs).toBe(120000);
  });
});
