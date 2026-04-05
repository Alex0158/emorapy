/**
 * 煙霧測試 (Smoke Test)
 * 
 * 驗證基本的測試環境設置是否正常
 * 這些測試不需要數據庫連接，可以快速驗證測試框架是否正常工作
 */

import { jest, describe, it, expect } from '@jest/globals';
import request from 'supertest';

// Mock AI 服務（必須在 import app 之前）
jest.mock('../../src/services/ai.service', () => {
  return {
    AIService: jest.fn().mockImplementation(() => ({
      detectCaseType: jest.fn(),
      generateJudgment: jest.fn(),
      generateReconciliationPlans: jest.fn(),
      generateText: jest.fn(),
      generateSummary: jest.fn(),
      resetDailyCallCount: jest.fn(),
    })),
    aiService: {
      detectCaseType: jest.fn(),
      generateJudgment: jest.fn(),
      generateReconciliationPlans: jest.fn(),
      generateText: jest.fn(),
      generateSummary: jest.fn(),
      resetDailyCallCount: jest.fn(),
    },
  };
});

// Mock Prisma 客戶端以避免數據庫連接
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaClient: any = {
  $connect: jest.fn().mockResolvedValue(undefined as never),
  $disconnect: jest.fn().mockResolvedValue(undefined as never),
  $queryRaw: jest.fn().mockResolvedValue([] as never),
  quickSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
  pairing: {
    create: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
  case: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  judgment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  evidence: {
    create: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  reconciliationPlan: {
    deleteMany: jest.fn(),
  },
  executionRecord: {
    deleteMany: jest.fn(),
  },
  emailVerification: {
    deleteMany: jest.fn(),
  },
  user: {
    deleteMany: jest.fn(),
  },
  contentItem: {
    findMany: jest.fn().mockResolvedValue([] as never),
    findUnique: jest.fn(),
  },
  caseContentLink: {
    findMany: jest.fn().mockResolvedValue([] as never),
    upsert: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((fn: unknown) => (fn as (prisma: any) => Promise<any>)(mockPrismaClient)),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
  Prisma: { PrismaClientKnownRequestError: class extends Error { code: string; meta?: unknown; constructor(m: string, o: { code: string; meta?: unknown }) { super(m); this.code = o.code; this.meta = o.meta; } } },
  NotificationChannel: { email: 'email', push: 'push' },
  NotificationStatus: { pending: 'pending', sent: 'sent', failed: 'failed' },
  PsychDomain: {
    attachment: 'attachment',
    family_origin: 'family_origin',
    life_events: 'life_events',
    belief_values: 'belief_values',
    cultural_background: 'cultural_background',
    education_cognition: 'education_cognition',
    personality: 'personality',
    relationship_history: 'relationship_history',
  },
  InsightType: {
    trait: 'trait',
    pattern: 'pattern',
    belief: 'belief',
    trigger: 'trigger',
    strength: 'strength',
    risk: 'risk',
    cultural: 'cultural',
    developmental: 'developmental',
  },
}));

import app from '../../src/app';

describe('煙霧測試 (Smoke Test)', () => {
  describe('基礎健康檢查', () => {
    it('健康檢查接口應返回成功狀態', async () => {
      const response = await request(app).get('/health');
      
      // 健康檢查應該返回 200 或 503（如果數據庫不可用）
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });

    it('GET /health/live 應返回 200 alive（K8s 存活探針端點可達）', async () => {
      const response = await request(app).get('/health/live');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
    });

    it('GET /health/ready 應返回 200 或 503（K8s 就緒探針端點可達）', async () => {
      const response = await request(app).get('/health/ready');
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });

    it('不存在的接口應返回404', async () => {
      const response = await request(app).get('/api/v1/non-existent-endpoint');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('API 格式驗證', () => {
    it('API 應返回標準的響應格式', async () => {
      const response = await request(app).get('/health');
      
      // 響應應該是 JSON 格式
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('CORS 應該正確配置', async () => {
      const response = await request(app)
        .options('/api/v1/sessions/quick')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');
      
      // 應該允許 CORS 或返回其他預期結果
      // 這裡我們只檢查不是服務器錯誤
      expect(response.status).toBeLessThan(500);
    });

    it('不在白名單的 Origin 應返回 403 且錯誤碼可識別', async () => {
      const response = await request(app)
        .get('/api/v1/admin/jobs')
        .set('Origin', 'https://evil.example.com');
      expect(response.status).toBe(403);
      expect(response.body?.error?.code).toBe('CORS_ORIGIN_DENIED');
    });

    it('health 路徑即使帶有非白名單 Origin 也應放行（供監控與平台健康檢查）', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://evil.example.com');
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });

    it('公開狀態端點 /api/v1/version 即使帶有非白名單 Origin 也應放行', async () => {
      const response = await request(app)
        .get('/api/v1/version')
        .set('Origin', 'https://evil.example.com');
      expect(response.status).toBe(200);
      expect(response.body?.data?.version || response.body?.version).toBeTruthy();
    });

    it('/metrics 不應先被全局 CORS 拒絕，應交由 metrics 自身保護邏輯處理', async () => {
      const response = await request(app)
        .get('/metrics')
        .set('Origin', 'https://evil.example.com');
      expect(response.body?.error?.code).not.toBe('CORS_ORIGIN_DENIED');
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('F01 升格相關端點可達性', () => {
    it('POST /api/v1/auth/claim-session 無 token 時應返回 401（F01 升格前置：端點可達）', async () => {
      const response = await request(app)
        .post('/api/v1/auth/claim-session')
        .set('Content-Type', 'application/json')
        .send({ session_id: 'guest_1234567890' });
      expect(response.status).toBe(401);
    });

    it('POST /api/v1/sessions/quick 應返回 201 且含 session_id（F01 session 創建端點可達）', async () => {
      mockPrismaClient.quickSession.create.mockResolvedValueOnce({
        id: 'guest_test123',
        expires_at: new Date(Date.now() + 86400000),
      });
      const response = await request(app)
        .post('/api/v1/sessions/quick')
        .set('Content-Type', 'application/json');
      expect([200, 201]).toContain(response.status);
      expect(response.body?.data?.session_id).toBeTruthy();
    });

    it('POST /api/v1/sessions/refresh 無 session 時應返回 200 且含 session_id（F01 session refresh 端點可達）', async () => {
      mockPrismaClient.quickSession.create.mockResolvedValue({
        id: 'guest_refresh123',
        expires_at: new Date(Date.now() + 86400000),
      });
      const response = await request(app)
        .post('/api/v1/sessions/refresh')
        .set('Content-Type', 'application/json');
      expect([200, 201]).toContain(response.status);
      expect(response.body?.data?.session_id).toBeTruthy();
    });

    it('GET /api/v1/content-items 應返回 200 且含 items（F01 content tips 端點可達）', async () => {
      mockPrismaClient.contentItem.findMany.mockResolvedValue([]);
      const response = await request(app).get('/api/v1/content-items');
      expect(response.status).toBe(200);
      expect(response.body?.data?.items).toBeDefined();
      expect(Array.isArray(response.body?.data?.items)).toBe(true);
    });

    it('GET /api/v1/content-items/recommendations/:caseId 無效 UUID 時應返回驗證錯誤（F01/F05 推薦端點可達與驗證）', async () => {
      const response = await request(app).get(
        '/api/v1/content-items/recommendations/invalid-uuid'
      );
      expect([400, 422]).toContain(response.status);
    });
  });

  describe('F09 認證端點可達性', () => {
    it('POST /api/v1/auth/send-verification-code 無效 email 時應返回驗證錯誤（F09 端點可達）', async () => {
      const response = await request(app)
        .post('/api/v1/auth/send-verification-code')
        .set('Content-Type', 'application/json')
        .send({ email: 'invalid', type: 'register' });
      expect([400, 422]).toContain(response.status);
    });

    it('POST /api/v1/auth/login 缺少必填字段時應返回驗證錯誤（F09 端點可達）', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send({});
      expect([400, 422]).toContain(response.status);
    });

    it('POST /api/v1/auth/register 缺少必填字段時應返回驗證錯誤（F09 端點可達）', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send({});
      expect([400, 422]).toContain(response.status);
    });

    it('POST /api/v1/auth/reset-password 缺少必填字段時應返回驗證錯誤（F09 忘記密碼端點可達）', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .set('Content-Type', 'application/json')
        .send({});
      expect([400, 422]).toContain(response.status);
    });

    it('POST /api/v1/auth/verify-email 缺少必填字段時應返回驗證錯誤（F09 驗證端點可達）', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Content-Type', 'application/json')
        .send({});
      expect([400, 422]).toContain(response.status);
    });

    it('POST /api/v1/auth/reset-password-confirm 缺少必填字段時應返回驗證錯誤（F09 確認重置端點可達）', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password-confirm')
        .set('Content-Type', 'application/json')
        .send({});
      expect([400, 422]).toContain(response.status);
    });

    it('GET /api/v1/user/profile 無 token 時應返回 401（F09 個人資料端點可達）', async () => {
      const response = await request(app).get('/api/v1/user/profile');
      expect(response.status).toBe(401);
    });
  });

  describe('F08 配對端點可達性', () => {
    it('GET /api/v1/pairing/status 無 token 時應返回 401（F08 配對端點可達）', async () => {
      const response = await request(app).get('/api/v1/pairing/status');
      expect(response.status).toBe(401);
    });
  });

  describe('F03 案件端點可達性', () => {
    it('GET /api/v1/cases 無 token 時應返回 401（F03 案件列表端點可達）', async () => {
      const response = await request(app).get('/api/v1/cases');
      expect(response.status).toBe(401);
    });
  });

  describe('F09 通知與個人資料端點可達性', () => {
    it('GET /api/v1/notifications 無 token 時應返回 401（F09 通知端點可達）', async () => {
      const response = await request(app).get('/api/v1/notifications');
      expect(response.status).toBe(401);
    });

    it('GET /api/v1/profile/me 無 token 時應返回 401（F08/F09 個人資料端點可達）', async () => {
      const response = await request(app).get('/api/v1/profile/me');
      expect(response.status).toBe(401);
    });
  });

  describe('F05 執行端點可達性', () => {
    it('GET /api/v1/execution/dashboard 無 token 時應返回 401（F05 執行看板端點可達）', async () => {
      const response = await request(app).get('/api/v1/execution/dashboard');
      expect(response.status).toBe(401);
    });

    it('GET /api/v1/execution/status 無 token 時應返回 401（F05 執行狀態端點可達）', async () => {
      const response = await request(app).get('/api/v1/execution/status');
      expect(response.status).toBe(401);
    });
  });

  describe('F06 心理畫像端點可達性', () => {
    it('GET /api/v1/psych-profile 無 token 時應返回 401（F06 心理畫像端點可達）', async () => {
      const response = await request(app).get('/api/v1/psych-profile');
      expect(response.status).toBe(401);
    });
  });

  describe('F06 訪談端點可達性', () => {
    it('POST /api/v1/interview/start 無 token 時應返回 401（F06 訪談啟動端點可達）', async () => {
      const response = await request(app)
        .post('/api/v1/interview/start')
        .set('Content-Type', 'application/json')
        .send({});
      expect(response.status).toBe(401);
    });

    it('GET /api/v1/interview/resume 無 token 時應返回 401（F06 訪談恢復端點可達）', async () => {
      const response = await request(app).get('/api/v1/interview/resume');
      expect(response.status).toBe(401);
    });
  });

  describe('F04 判決端點可達性', () => {
    it('POST /api/v1/judgments/:id/accept 無 token 時應返回 401（F04 接受判決端點可達）', async () => {
      const response = await request(app)
        .post('/api/v1/judgments/550e8400-e29b-41d4-a716-446655440000/accept')
        .set('Content-Type', 'application/json')
        .send({ accepted: true });
      expect(response.status).toBe(401);
    });
  });

  describe('F05 和好方案端點可達性', () => {
    it('GET /api/v1/judgments/:id/reconciliation-plans 無 token 時應返回 401（F05 和好方案列表端點可達）', async () => {
      const response = await request(app).get(
        '/api/v1/judgments/550e8400-e29b-41d4-a716-446655440000/reconciliation-plans'
      );
      expect(response.status).toBe(401);
    });

    it('GET /api/v1/reconciliation-plans/:id 無 token 時應返回 401（F05 和好方案詳情端點可達）', async () => {
      const response = await request(app).get(
        '/api/v1/reconciliation-plans/550e8400-e29b-41d4-a716-446655440000'
      );
      expect(response.status).toBe(401);
    });
  });

  describe('請求驗證', () => {
    it('無效的 JSON 請求體應被處理', async () => {
      const response = await request(app)
        .post('/api/v1/cases/quick')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      
      // 應該返回 400 錯誤
      expect(response.status).toBe(400);
    });

    it('缺少必填字段時應返回驗證錯誤', async () => {
      const response = await request(app)
        .post('/api/v1/cases/quick')
        .send({});
      
      // 應該返回 400 或 422 錯誤
      expect([400, 422]).toContain(response.status);
    });

    it('POST /api/v1/cases/quick plaintiff_statement 不足 30 字時應返回驗證錯誤（F01 邊界）', async () => {
      const response = await request(app)
        .post('/api/v1/cases/quick')
        .set('Content-Type', 'application/json')
        .send({ plaintiff_statement: '不足三十字' });
      expect([400, 422]).toContain(response.status);
    });
  });

  describe('測試輔助工具', () => {
    it('API 客戶端應該能正確創建', async () => {
      const { createApiClient } = await import('./helpers/api-client');
      const client = createApiClient(app);
      
      expect(client).toBeDefined();
      expect(typeof client.createSession).toBe('function');
      expect(typeof client.createQuickCase).toBe('function');
      expect(typeof client.getJudgmentByCaseId).toBe('function');
    });

    it('Mock AI 服務應該正確設置', () => {
      const { aiService } = require('../../src/services/ai.service');
      
      expect(aiService).toBeDefined();
      expect(typeof aiService.detectCaseType).toBe('function');
      expect(typeof aiService.generateJudgment).toBe('function');
    });

    it('測試 fixtures 應該可用', async () => {
      const { validCaseRequests, httpStatus } = await import('./fixtures/quick-experience.fixtures');
      
      expect(validCaseRequests.coupleDispute).toBeDefined();
      expect(validCaseRequests.coupleDispute.plaintiff_statement).toBeTruthy();
      expect(httpStatus.OK).toBe(200);
    });
  });
});
