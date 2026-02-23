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
