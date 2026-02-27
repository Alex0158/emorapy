/**
 * Chat 並發驗證 Gate（可用於 CI）
 *
 * 功能：
 * - 串接 request-judgment 與 invite-accept 兩個 benchmark。
 * - 收斂執行結果為單一 gate report（JSON），供機器判讀。
 * - 任一子項失敗時以非 0 exit code 結束。
 *
 * 使用方式（示例）：
 * AUTH_TOKEN=... OWNER_AUTH_TOKEN=... INVITEE_TOKENS=tok1,tok2 \
 *   npx tsx scripts/benchmark-chat-concurrency-gate.ts
 *
 * 可選環境變數：
 * - GATE_RUN_JUDGMENT (default: true)
 * - GATE_RUN_INVITE_ACCEPT (default: true)
 * - GATE_REPORT_DIR (default: ./tmp/bench-reports)
 * - GATE_REPORT_PATH (default: <GATE_REPORT_DIR>/chat-concurrency-gate-report.json)
 * - 其餘 benchmark 所需變數會直接沿用（如 API_BASE_URL、BURST_SIZE、...）
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

type GateItemResult = {
  name: 'judgment' | 'invite_accept';
  command: string[];
  exitCode: number;
  passed: boolean;
  reportPath: string;
  report?: unknown;
};

function asBool(value: string | undefined, defaultValue: boolean, envName: string): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === '') return defaultValue;
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false;
  console.warn(`⚠️ ${envName}=${value} 非法，回退預設值 ${defaultValue}`);
  return defaultValue;
}

async function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
    });
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
    child.on('error', () => {
      resolve(1);
    });
  });
}

async function readJsonIfExists(filePath: string): Promise<unknown | undefined> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

async function runOne(
  name: 'judgment' | 'invite_accept',
  scriptFile: string,
  reportPath: string,
  baseEnv: NodeJS.ProcessEnv
): Promise<GateItemResult> {
  const command = ['tsx', scriptFile];
  await rm(reportPath, { force: true }).catch(() => undefined);
  const env = {
    ...baseEnv,
    REPORT_PATH: reportPath,
  };

  const exitCode = await runCommand('npx', command, env);
  const report = await readJsonIfExists(reportPath);
  const reportPassed = Boolean(
    report &&
      typeof report === 'object' &&
      (report as Record<string, unknown>).passed === true
  );
  const passed = exitCode === 0 && reportPassed;

  return {
    name,
    command: ['npx', ...command],
    exitCode,
    passed,
    reportPath,
    report,
  };
}

async function main() {
  const runJudgment = asBool(process.env.GATE_RUN_JUDGMENT, true, 'GATE_RUN_JUDGMENT');
  const runInviteAccept = asBool(process.env.GATE_RUN_INVITE_ACCEPT, true, 'GATE_RUN_INVITE_ACCEPT');
  const reportDir = path.resolve(process.env.GATE_REPORT_DIR || './tmp/bench-reports');
  const gateReportPath = path.resolve(
    process.env.GATE_REPORT_PATH || path.join(reportDir, 'chat-concurrency-gate-report.json')
  );

  if (!runJudgment && !runInviteAccept) {
    throw new Error('至少需啟用一項檢查：GATE_RUN_JUDGMENT 或 GATE_RUN_INVITE_ACCEPT');
  }

  await mkdir(reportDir, { recursive: true });

  const checks: GateItemResult[] = [];
  if (runJudgment) {
    checks.push(
      await runOne(
        'judgment',
        'scripts/benchmark-chat-judgment-concurrency.ts',
        path.join(reportDir, 'chat-judgment-concurrency-report.json'),
        process.env
      )
    );
  }
  if (runInviteAccept) {
    checks.push(
      await runOne(
        'invite_accept',
        'scripts/benchmark-chat-invite-accept-concurrency.ts',
        path.join(reportDir, 'chat-invite-accept-concurrency-report.json'),
        process.env
      )
    );
  }

  const passed = checks.every((x) => x.passed);
  const gateReport = {
    gate: 'chat-concurrency-gate',
    passed,
    generatedAt: new Date().toISOString(),
    checks,
  };
  await writeFile(gateReportPath, `${JSON.stringify(gateReport, null, 2)}\n`, 'utf8');

  console.log('\n=== chat concurrency gate summary ===');
  console.log(JSON.stringify(gateReport, null, 2));
  console.log(`gate report written: ${gateReportPath}`);

  if (!passed) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error('chat concurrency gate failed', error);
  process.exit(1);
});
