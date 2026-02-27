/**
 * 產出 chat active 角色唯一性修復建議（SQL）
 *
 * 目的：
 * - 當 precheck 發現重複 active roleA/roleB/aiMediator 時，產出「建議 SQL」供人工審核後執行。
 * - 本腳本不會修改資料庫，只輸出建議修復語句。
 *
 * 使用方式：
 * DATABASE_URL=... npx tsx scripts/plan-fix-chat-active-roles-uniqueness.ts
 *
 * 可選環境變數：
 * - FIX_PLAN_OUTPUT_PATH：輸出 .sql 檔案路徑（預設：./tmp/bench-reports/chat-active-roles-fix-plan.sql）
 * - FIX_PLAN_REPORT_PATH：輸出 JSON 報告（可選）
 */

import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type DuplicateRoleRow = {
  room_id: string;
  role_in_room: 'roleA' | 'roleB' | 'aiMediator';
  ids: string[];
};

const prisma = new PrismaClient();
const sqlOutputPath = path.resolve(
  process.env.FIX_PLAN_OUTPUT_PATH || './tmp/bench-reports/chat-active-roles-fix-plan.sql'
);
const reportOutputPath = process.env.FIX_PLAN_REPORT_PATH
  ? path.resolve(process.env.FIX_PLAN_REPORT_PATH)
  : '';

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function buildFixSql(rows: DuplicateRoleRow[]): string {
  const statements: string[] = [];
  statements.push('-- Chat active 角色唯一性修復建議（人工審核後執行）');
  statements.push('-- 規則：每個 room + role 僅保留最新 joined_at / id 的 1 筆 active，其餘標記 inactive。');
  statements.push('BEGIN;');
  statements.push('');

  for (const row of rows) {
    const roomId = escapeSql(row.room_id);
    const role = escapeSql(row.role_in_room);
    statements.push(`-- room=${row.room_id}, role=${row.role_in_room}, active_count=${row.ids.length}`);
    statements.push(
      `WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY joined_at DESC NULLS LAST, id DESC) AS rn
  FROM chat_participants
  WHERE room_id = '${roomId}'
    AND role_in_room = '${role}'
    AND is_active = true
)
UPDATE chat_participants cp
SET is_active = false,
    left_at = COALESCE(cp.left_at, NOW())
FROM ranked r
WHERE cp.id = r.id
  AND r.rn > 1;`
    );
    statements.push('');
  }

  statements.push('COMMIT;');
  statements.push('');
  return statements.join('\n');
}

async function writeJsonReport(report: unknown) {
  if (!reportOutputPath) return;
  await writeFile(reportOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`fix-plan report written: ${reportOutputPath}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('缺少 DATABASE_URL，無法執行修復建議生成');
  }

  let rows: DuplicateRoleRow[] = [];
  try {
    rows = await prisma.$queryRaw<DuplicateRoleRow[]>`
      SELECT
        room_id,
        role_in_room::text AS role_in_room,
        ARRAY_AGG(id ORDER BY joined_at DESC NULLS LAST, id DESC) AS ids
      FROM chat_participants
      WHERE is_active = true
        AND role_in_room IN ('roleA', 'roleB', 'aiMediator')
      GROUP BY room_id, role_in_room
      HAVING COUNT(*) > 1
      ORDER BY room_id ASC, role_in_room ASC
    `;
  } catch (error) {
    const err = error as { code?: string; meta?: { code?: string; message?: string } };
    const relationMissing = err.code === 'P2010' && err.meta?.code === '42P01' && /chat_participants/i.test(err.meta?.message || '');
    if (relationMissing) {
      throw new Error(
        '資料庫缺少 chat_participants 資料表（chat migration 尚未套用）。請先在目標環境執行 `npx prisma migrate deploy` 後再生成修復方案。'
      );
    }
    throw error;
  }

  const normalized = rows.map((r) => ({
    room_id: r.room_id,
    role_in_room: r.role_in_room,
    ids: Array.isArray(r.ids) ? r.ids : [],
  }));

  const sql = buildFixSql(normalized);
  await mkdir(path.dirname(sqlOutputPath), { recursive: true });
  await writeFile(sqlOutputPath, sql, 'utf8');
  console.log(`fix-plan sql written: ${sqlOutputPath}`);

  const report = {
    check: 'chat-active-roles-uniqueness-fix-plan',
    duplicateGroups: normalized.length,
    generatedAt: new Date().toISOString(),
    outputSqlPath: sqlOutputPath,
    groups: normalized.map((g) => ({
      room_id: g.room_id,
      role_in_room: g.role_in_room,
      active_count: g.ids.length,
      active_ids_desc: g.ids,
      keep_id: g.ids[0] || null,
      deactivate_ids: g.ids.slice(1),
    })),
  };
  await writeJsonReport(report);

  if (normalized.length === 0) {
    console.log('✅ 未發現重複 active 角色，無需修復。');
    return;
  }

  console.log('⚠️ 已產出修復建議 SQL，請先人工審核再執行。');
}

main()
  .catch((error) => {
    console.error('fix-plan generation failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
