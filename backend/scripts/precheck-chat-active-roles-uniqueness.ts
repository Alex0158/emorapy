/**
 * Chat active 角色唯一索引上線前預檢
 *
 * 目的：
 * - 檢查歷史資料是否違反以下約束（room_id + role_in_room + is_active=true）：
 *   - roleA 僅允許 1 筆
 *   - roleB 僅允許 1 筆
 *   - aiMediator 僅允許 1 筆
 *
 * 使用方式：
 * DATABASE_URL=... npx tsx scripts/precheck-chat-active-roles-uniqueness.ts
 *
 * 可選環境變數：
 * - PRECHECK_REPORT_PATH：輸出 JSON 報告檔（可選）
 */

import { PrismaClient } from '@prisma/client';
import { writeFile } from 'node:fs/promises';

type DupRow = {
  room_id: string;
  role_in_room: string;
  active_count: number;
};

const prisma = new PrismaClient();
const reportPath = process.env.PRECHECK_REPORT_PATH || '';

async function writeReport(report: unknown) {
  if (!reportPath) return;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`precheck report written: ${reportPath}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('缺少 DATABASE_URL，無法執行資料庫預檢');
  }

  let rows: DupRow[] = [];
  try {
    rows = await prisma.$queryRaw<DupRow[]>`
      SELECT
        room_id,
        role_in_room::text AS role_in_room,
        COUNT(*)::int AS active_count
      FROM chat_participants
      WHERE is_active = true
        AND role_in_room IN ('roleA', 'roleB', 'aiMediator')
      GROUP BY room_id, role_in_room
      HAVING COUNT(*) > 1
      ORDER BY active_count DESC, room_id ASC
    `;
  } catch (error) {
    const err = error as { code?: string; meta?: { code?: string; message?: string } };
    const relationMissing = err.code === 'P2010' && err.meta?.code === '42P01' && /chat_participants/i.test(err.meta?.message || '');
    if (relationMissing) {
      throw new Error(
        '資料庫缺少 chat_participants 資料表（chat migration 尚未套用）。請先在目標環境執行 `npx prisma migrate deploy` 後再重跑預檢。'
      );
    }
    throw error;
  }

  const grouped = {
    roleA: rows.filter((r) => r.role_in_room === 'roleA'),
    roleB: rows.filter((r) => r.role_in_room === 'roleB'),
    aiMediator: rows.filter((r) => r.role_in_room === 'aiMediator'),
  };

  const totalViolations = rows.length;
  const passed = totalViolations === 0;

  const report = {
    check: 'chat-active-roles-uniqueness',
    passed,
    totalViolations,
    grouped,
    generatedAt: new Date().toISOString(),
  };

  console.log('=== precheck chat active roles uniqueness ===');
  console.log(JSON.stringify(report, null, 2));
  await writeReport(report);

  if (!passed) {
    console.error('❌ 發現違反 active 角色唯一性的歷史資料，請先清理再執行 migration。');
    process.exit(2);
  }

  console.log('✅ 預檢通過：未發現違反 active 角色唯一性的資料。');
}

main()
  .catch((error) => {
    console.error('precheck failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
