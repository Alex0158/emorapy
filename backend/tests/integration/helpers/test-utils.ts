/**
 * 測試工具函數
 * 
 * 數據庫清理、等待函數、測試數據生成等
 */

import { PrismaClient } from '../../../node_modules/.prisma/client';
import crypto from 'crypto';

// 創建專用於測試的 Prisma 客戶端
const testPrisma = new PrismaClient({
  log: process.env.DEBUG_TESTS ? ['query', 'error', 'warn'] : ['error'],
});

async function waitForPendingJudgmentsToDrain(timeoutMs: number = 3000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const pendingCount = await testPrisma.case.count({
      where: {
        mode: 'quick',
        status: {
          in: ['submitted', 'in_progress'],
        },
      },
    });

    if (pendingCount === 0) {
      return;
    }

    await sleep(100);
  }
}

/**
 * 獲取測試用 Prisma 客戶端
 */
export function getPrismaClient(): PrismaClient {
  return testPrisma;
}

/**
 * 建立只供 DB-backed integration test 使用的 one-time registration proof。
 * 測試仍走正式 register transaction；不建立 debug endpoint，也不保存 plaintext OTP/proof。
 */
export async function createTestRegistrationProof(emailInput: string): Promise<string> {
  const email = emailInput.trim().toLowerCase();
  if (!/^claim-smoke-[a-z0-9_-]+@example\.com$/.test(email)) {
    throw new Error('integration registration proof requires claim-smoke synthetic email');
  }
  const now = new Date();
  const proof = `rp1_${crypto.randomBytes(32).toString('base64url')}`;
  const proofDigest = crypto.createHash('sha256').update(proof).digest('hex');

  await testPrisma.$transaction(async (tx) => {
    await tx.authChallenge.updateMany({
      where: {
        email,
        type: 'register',
        consumed_at: null,
        invalidated_at: null,
      },
      data: { invalidated_at: now },
    });
    await tx.authChallenge.create({
      data: {
        id: `release-fixture-${crypto.randomUUID()}`,
        email,
        type: 'register',
        code_digest: crypto.randomBytes(32).toString('hex'),
        source: 'release_fixture',
        delivery_status: 'release_fixture_ready',
        expires_at: new Date(now.getTime() + 5 * 60 * 1000),
        verified_at: now,
        registration_proof_digest: proofDigest,
        registration_proof_expires_at: new Date(now.getTime() + 10 * 60 * 1000),
      },
    });
  });
  return proof;
}

/**
 * 清理測試數據
 * 
 * 按照外鍵約束順序刪除數據
 */
export async function cleanupTestData(): Promise<void> {
  try {
    // quick-experience flow 會異步生成判決；清理前先等背景任務收斂，避免 FK race。
    await waitForPendingJudgmentsToDrain();

    // 按依賴順序刪除（從最依賴到最不依賴）
    await testPrisma.evidence.deleteMany({});
    await testPrisma.judgment.deleteMany({});
    await testPrisma.reconciliationPlan.deleteMany({});
    await testPrisma.executionRecord.deleteMany({});
    await testPrisma.profileSnapshot.deleteMany({});
    await testPrisma.case.deleteMany({});
    await testPrisma.pairing.deleteMany({});
    await testPrisma.quickSession.deleteMany({});
    await testPrisma.authChallenge.deleteMany({});
    await testPrisma.emailVerification.deleteMany({});
    await testPrisma.user.deleteMany({});
  } catch (error) {
    console.error('清理測試數據失敗:', error);
    throw error;
  }
}

/**
 * 清理特定 Session 的數據
 */
export async function cleanupSessionData(sessionId: string): Promise<void> {
  try {
    // 找到該 session 相關的案件
    const cases = await testPrisma.case.findMany({
      where: { session_id: sessionId },
      select: { id: true },
    });

    const caseIds = cases.map(c => c.id);

    // 刪除相關數據
    if (caseIds.length > 0) {
      await testPrisma.evidence.deleteMany({
        where: { case_id: { in: caseIds } },
      });
      await testPrisma.judgment.deleteMany({
        where: { case_id: { in: caseIds } },
      });
      await testPrisma.profileSnapshot.deleteMany({
        where: { case_id: { in: caseIds } },
      });
      await testPrisma.case.deleteMany({
        where: { id: { in: caseIds } },
      });
    }

    // 刪除該 session 相關的 pairing
    await testPrisma.pairing.deleteMany({
      where: { session_id: sessionId as any },
    });

    // 刪除 session 本身
    await testPrisma.quickSession.deleteMany({
      where: { id: sessionId },
    });
  } catch (error) {
    console.error('清理 Session 數據失敗:', error);
    throw error;
  }
}

/**
 * 等待指定毫秒
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 等待條件滿足
 * 
 * @param condition - 條件函數
 * @param options - 選項
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<void> {
  const { timeout = 10000, interval = 100, message = '條件未在指定時間內滿足' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) return;
    await sleep(interval);
  }

  throw new Error(`${message} (超時: ${timeout}ms)`);
}

/**
 * 等待判決生成完成
 */
export async function waitForJudgment(
  caseId: string,
  options: { timeout?: number; interval?: number } = {}
): Promise<boolean> {
  const { timeout = 30000, interval = 500 } = options;

  try {
    await waitFor(
      async () => {
        const caseData = await testPrisma.case.findUnique({
          where: { id: caseId },
          include: { judgment: true },
        });
        return caseData?.judgment !== null;
      },
      { timeout, interval, message: '判決未在指定時間內生成' }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 驗證案件狀態
 */
export async function verifyCaseStatus(
  caseId: string,
  expectedStatus: string
): Promise<boolean> {
  const caseData = await testPrisma.case.findUnique({
    where: { id: caseId },
  });
  return caseData?.status === expectedStatus;
}

/**
 * 獲取案件完整數據（含關聯）
 */
export async function getCaseWithRelations(caseId: string) {
  return testPrisma.case.findUnique({
    where: { id: caseId },
    include: {
      judgment: true,
      evidences: true,
      pairing: true,
    },
  });
}

/**
 * 創建模擬文件 Buffer
 */
export function createMockFile(
  content: string,
  type: 'image' | 'text' = 'text'
): Buffer {
  if (type === 'image') {
    // 創建一個簡單的 PNG 標頭（1x1 像素透明圖片）
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82, // IEND chunk
    ]);
    return Buffer.concat([pngHeader, Buffer.from(content)]);
  }
  return Buffer.from(content);
}

/**
 * 創建多個模擬文件
 */
export function createMockFiles(
  count: number,
  type: 'image' | 'text' = 'image'
): { files: Buffer[]; filenames: string[] } {
  const files: Buffer[] = [];
  const filenames: string[] = [];

  for (let i = 0; i < count; i++) {
    const ext = type === 'image' ? 'png' : 'txt';
    files.push(createMockFile(`test-content-${i}`, type));
    filenames.push(`test-file-${i}.${ext}`);
  }

  return { files, filenames };
}

/**
 * 生成隨機字符串
 */
export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成測試用陳述
 */
export function generateTestStatement(role: 'plaintiff' | 'defendant', length: number = 50): string {
  const templates = {
    plaintiff: [
      '他/她總是不考慮我的感受',
      '我已經忍受很久了',
      '每次我提出這個問題都被忽視',
      '這件事讓我感到很受傷',
    ],
    defendant: [
      '我沒有想到會造成這樣的影響',
      '我覺得這是一個誤會',
      '我已經在努力改善了',
      '我不同意這樣的說法',
    ],
  };

  const template = templates[role][Math.floor(Math.random() * templates[role].length)];
  const filler = '。這是一段測試用的陳述內容。';
  
  let statement = template;
  while (statement.length < length) {
    statement += filler;
  }
  
  return statement.substring(0, length);
}

/**
 * 直接在數據庫中創建 Session
 * 注意：QuickSession 的主鍵是 `id`，其值就是 session_id
 */
export async function createTestSession(
  options: { expiresInMs?: number; sessionId?: string } = {}
): Promise<{ session_id: string; expires_at: Date }> {
  const { expiresInMs = 30 * 60 * 1000, sessionId } = options;
  const session_id = sessionId || `test-session-${Date.now()}-${randomString(8)}`;
  const expires_at = new Date(Date.now() + expiresInMs);

  await testPrisma.quickSession.create({
    data: {
      id: session_id,  // id 就是 session_id
      expires_at,
    },
  });

  return { session_id, expires_at };
}

/**
 * 直接在數據庫中創建過期 Session
 * 注意：QuickSession 的主鍵是 `id`，其值就是 session_id
 */
export async function createExpiredTestSession(): Promise<{ session_id: string; expires_at: Date }> {
  const session_id = `expired-session-${Date.now()}-${randomString(8)}`;
  const expires_at = new Date(Date.now() - 60000); // 1 分鐘前過期

  await testPrisma.quickSession.create({
    data: {
      id: session_id,  // id 就是 session_id
      expires_at,
    },
  });

  return { session_id, expires_at };
}

/**
 * 連接數據庫
 * 帶有超時控制以避免長時間等待
 */
export async function connectDatabase(timeoutMs: number = 10000): Promise<void> {
  try {
    const timer = setTimeout(() => {
      throw new Error(`數據庫連接超時 (${timeoutMs}ms)`);
    }, timeoutMs);

    await testPrisma.$connect();
    clearTimeout(timer);
  } catch (error) {
    // 確保計時器被清理
    // @ts-ignore
    if (typeof timer !== 'undefined') clearTimeout(timer);
    console.error('數據庫連接失敗:', error);
    throw error;
  }
}

/**
 * 斷開數據庫連接
 */
export async function disconnectDatabase(): Promise<void> {
  await testPrisma.$disconnect();
}

/**
 * 測試環境初始化
 */
export async function initTestEnvironment(): Promise<void> {
  await connectDatabase();
  await cleanupTestData();
}

/**
 * 測試環境清理
 */
export async function teardownTestEnvironment(): Promise<void> {
  await cleanupTestData();
  await disconnectDatabase();
}

/**
 * 包裝測試函數，自動處理數據庫清理
 */
export function withCleanup<T>(
  testFn: () => Promise<T>
): () => Promise<T> {
  return async () => {
    try {
      await cleanupTestData();
      return await testFn();
    } finally {
      await cleanupTestData();
    }
  };
}
