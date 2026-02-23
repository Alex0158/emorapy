/**
 * ReconciliationService 單元測試（mock Prisma、aiService、isReconciliationPlanContent）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGenerateReconciliationPlans = jest.fn();
const mockIsReconciliationPlanContent = jest.fn();

// 符合 isReconciliationPlanContent 的範例方案
const validPlanContent = {
  title: '方案標題',
  description: '描述',
  steps: ['步驟1'],
  expected_effect: '效果',
  time_cost: 1,
  money_cost: 0,
  emotion_cost: 1,
  skill_requirement: 1,
  plan_type: 'activity' as const,
  estimated_duration: 7,
  difficulty_level: 'medium' as const,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  judgment: { findUnique: jest.fn() },
  reconciliationPlan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));
jest.mock('../../../src/services/ai.service', () => ({
  aiService: {
    generateReconciliationPlans: (...args: unknown[]) => mockGenerateReconciliationPlans(...args),
  },
  SAFETY_SIGNAL_REGEX: /安全|危險/,
  IPV_SIGNAL_REGEX: /控制|威脅|暴力/,
  CRISIS_SIGNAL_REGEX: /自傷|自殺/,
}));
jest.mock('../../../src/types/ai.types', () => ({
  isReconciliationPlanContent: (obj: unknown) => mockIsReconciliationPlanContent(obj),
}));

const mockLoadCaseContext = jest.fn();
const mockFormatForReconciliationPlans = jest.fn();
const mockFormatDiagnosticContext = jest.fn();
jest.mock('../../../src/services/case-context.service', () => ({
  caseContextService: {
    loadCaseContext: (...args: unknown[]) => mockLoadCaseContext(...args),
    formatForReconciliationPlans: (...args: unknown[]) => mockFormatForReconciliationPlans(...args),
    formatDiagnosticContext: (...args: unknown[]) => mockFormatDiagnosticContext(...args),
  },
}));

import { ReconciliationService } from '../../../src/services/reconciliation.service';

describe('ReconciliationService', () => {
  let service: ReconciliationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReconciliationService();
    mockIsReconciliationPlanContent.mockReturnValue(true);
  });

  describe('generatePlans', () => {
    it('判決不存在應拋出 NOT_FOUND', async () => {
      prismaMock.judgment.findUnique.mockResolvedValue(null);

      await expect(service.generatePlans('judge-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('判決'),
      });
      expect(mockGenerateReconciliationPlans).not.toHaveBeenCalled();
    });

    it('有 userId 且非當事人應拋出 FORBIDDEN', async () => {
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { plaintiff_id: 'u1', defendant_id: 'u2' },
        case_id: 'case-1',
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        summary: 's',
      });
      prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);

      await expect(service.generatePlans('judge-1', undefined, 'u3')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('已有方案應直接返回', async () => {
      const existing = [{ id: 'plan-1', judgment_id: 'judge-1' }];
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { type: '其他', plaintiff_id: 'u1', defendant_id: 'u2' },
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        summary: 's',
      });
      prismaMock.reconciliationPlan.findMany.mockResolvedValue(existing);

      const result = await service.generatePlans('judge-1');

      expect(result).toEqual(existing);
      expect(mockGenerateReconciliationPlans).not.toHaveBeenCalled();
    });

    it('AI 生成失敗應拋出 AI_SERVICE_ERROR 並記錄 logger.error', async () => {
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { type: '其他', plaintiff_id: 'u1', defendant_id: 'u2' },
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        summary: 's',
      });
      prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);
      const aiErr = new Error('AI error');
      (mockGenerateReconciliationPlans as jest.Mock).mockRejectedValue(aiErr as never);

      await expect(service.generatePlans('judge-1')).rejects.toMatchObject({
        code: 'AI_SERVICE_ERROR',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate reconciliation plans', {
        judgmentId: 'judge-1',
        error: aiErr,
      });
    });

    it('方案內容無效應拋出 VALIDATION_ERROR', async () => {
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { type: '其他', plaintiff_id: 'u1', defendant_id: 'u2' },
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        summary: 's',
      });
      prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);
      // @ts-expect-error mock 泛型推斷為 never
      mockGenerateReconciliationPlans.mockResolvedValue([{ bad: 'plan' }]);
      mockIsReconciliationPlanContent.mockReturnValue(false);
      prismaMock.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock));

      await expect(service.generatePlans('judge-1')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('成功應調用 AI 並保存方案', async () => {
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { type: '其他', plaintiff_id: 'u1', defendant_id: 'u2' },
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        summary: 's',
      });
      prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);
      // @ts-expect-error mock 泛型推斷為 never
      mockGenerateReconciliationPlans.mockResolvedValue([validPlanContent]);
      prismaMock.$transaction = jest.fn(async (fn: (tx: any) => any) => {
        const tx = {
          // @ts-expect-error mock 泛型推斷為 never
          reconciliationPlan: { create: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
        };
        return fn(tx);
      });

      const result = await service.generatePlans('judge-1');

      expect(result).toHaveLength(1);
      expect(mockGenerateReconciliationPlans).toHaveBeenCalledWith(
        '其他',
        { plaintiff: 50, defendant: 50 },
        's',
        undefined,
        undefined,
        undefined
      );
    });

    it('非 QUICK 模式且有 emotional_analysis 時應傳遞 diagnosticContext 給 AI', async () => {
      const emotionalAnalysis = {
        severity: 'moderate',
        interactionCycle: '追-逃循環',
        coreIssue: '核心議題',
        personA: { readinessStage: '準備期' },
        personB: { readinessStage: '沉思期' },
      };
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { id: 'case-1', type: '情感需求衝突', mode: 'remote', plaintiff_id: 'u1', defendant_id: 'u2' },
        plaintiff_ratio: 55,
        defendant_ratio: 45,
        summary: '摘要',
        emotional_analysis: emotionalAnalysis,
        judgment_content: '判決內容',
      });
      prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);
      // @ts-expect-error mock 泛型推斷為 never
      mockLoadCaseContext.mockResolvedValue({
        userA: { label: '角色A', communicationHint: '偏感性', attachmentHint: null, keyInsights: [], culturalHint: null },
        userB: null,
        relationship: null,
      });
      mockFormatForReconciliationPlans.mockReturnValue('角色A：溝通偏好：偏感性');
      mockFormatDiagnosticContext.mockReturnValue('互動循環模式：追-逃循環\n\n核心議題：核心議題');
      // @ts-expect-error mock 泛型推斷為 never
      mockGenerateReconciliationPlans.mockResolvedValue([validPlanContent]);
      prismaMock.$transaction = jest.fn(async (fn: (tx: any) => any) => {
        const tx = {
          // @ts-expect-error mock 泛型推斷為 never
          reconciliationPlan: { create: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
        };
        return fn(tx);
      });

      await service.generatePlans('judge-1');

      expect(mockFormatDiagnosticContext).toHaveBeenCalledWith(emotionalAnalysis);
      expect(mockGenerateReconciliationPlans).toHaveBeenCalledWith(
        '情感需求衝突',
        { plaintiff: 55, defendant: 45 },
        '摘要',
        '角色A：溝通偏好：偏感性',
        undefined,
        '互動循環模式：追-逃循環\n\n核心議題：核心議題'
      );
    });

    it('QUICK 模式不應載入診斷上下文', async () => {
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { id: 'case-1', type: '其他', mode: 'quick', plaintiff_id: 'u1', defendant_id: 'u2' },
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        summary: 's',
        emotional_analysis: { interactionCycle: '追-逃' },
        judgment_content: '',
      });
      prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);
      // @ts-expect-error mock 泛型推斷為 never
      mockGenerateReconciliationPlans.mockResolvedValue([validPlanContent]);
      prismaMock.$transaction = jest.fn(async (fn: (tx: any) => any) => {
        const tx = {
          // @ts-expect-error mock 泛型推斷為 never
          reconciliationPlan: { create: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
        };
        return fn(tx);
      });

      await service.generatePlans('judge-1');

      expect(mockFormatDiagnosticContext).not.toHaveBeenCalled();
      expect(mockLoadCaseContext).not.toHaveBeenCalled();
    });

    it('emotional_analysis 為 null 時不應呼叫 formatDiagnosticContext', async () => {
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { id: 'case-1', type: '其他', mode: 'remote', plaintiff_id: 'u1', defendant_id: 'u2' },
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        summary: 's',
        emotional_analysis: null,
        judgment_content: '',
      });
      prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);
      // @ts-expect-error mock 泛型推斷為 never
      mockLoadCaseContext.mockResolvedValue(null);
      // @ts-expect-error mock 泛型推斷為 never
      mockGenerateReconciliationPlans.mockResolvedValue([validPlanContent]);
      prismaMock.$transaction = jest.fn(async (fn: (tx: any) => any) => {
        const tx = {
          // @ts-expect-error mock 泛型推斷為 never
          reconciliationPlan: { create: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
        };
        return fn(tx);
      });

      await service.generatePlans('judge-1');

      expect(mockFormatDiagnosticContext).not.toHaveBeenCalled();
    });

    it('傳入 preferences 時應按 difficulty 與 types 過濾方案', async () => {
      const easyActivity = { ...validPlanContent, difficulty_level: 'easy' as const, plan_type: 'activity' as const };
      const mediumComm = { ...validPlanContent, title: 'B', difficulty_level: 'medium' as const, plan_type: 'communication' as const };
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { type: '其他', plaintiff_id: 'u1', defendant_id: 'u2' },
        plaintiff_ratio: 50,
        defendant_ratio: 50,
        summary: 's',
      });
      prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);
      mockGenerateReconciliationPlans.mockResolvedValue([easyActivity, mediumComm] as never);
      let createdPlans: unknown[] = [];
      prismaMock.$transaction = jest.fn(async (fn: (tx: { reconciliationPlan: { create: jest.Mock } }) => unknown) => {
        const tx = {
          reconciliationPlan: {
            create: jest.fn().mockImplementation((arg: unknown) => {
              createdPlans.push((arg as { data: unknown }).data);
              return Promise.resolve({ id: 'plan-1' });
            }),
          },
        };
        return fn(tx);
      });

      const result = await service.generatePlans('judge-1', {
        difficulty: 'easy',
        types: ['activity'],
      }, 'u1');

      expect(result).toHaveLength(1);
      expect(createdPlans).toHaveLength(1);
      expect((createdPlans[0] as { difficulty_level: string }).difficulty_level).toBe('easy');
      expect((createdPlans[0] as { plan_type: string }).plan_type).toBe('activity');
    });
  });

  describe('getPlansByJudgmentId', () => {
    it('應按條件查詢並返回列表', async () => {
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { plaintiff_id: 'u1', defendant_id: 'u2', session_id: null },
      });
      const plans = [{ id: 'plan-1', judgment_id: 'judge-1', difficulty_level: 'easy' }];
      prismaMock.reconciliationPlan.findMany.mockResolvedValue(plans);

      const result = await service.getPlansByJudgmentId('judge-1', 'u1', {
        difficulty: 'easy',
        type: 'activity',
      });

      expect(result).toEqual(plans);
      expect(prismaMock.reconciliationPlan.findMany).toHaveBeenCalledWith({
        where: { judgment_id: 'judge-1', difficulty_level: 'easy', plan_type: 'activity' },
        orderBy: { created_at: 'desc' },
      });
    });

    it('非當事人應被拒絕', async () => {
      prismaMock.judgment.findUnique.mockResolvedValue({
        id: 'judge-1',
        case: { plaintiff_id: 'u1', defendant_id: 'u2', session_id: null },
      });

      await expect(service.getPlansByJudgmentId('judge-1', 'u999')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  describe('getPlanById', () => {
    it('方案不存在應拋出 NOT_FOUND', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(null);

      await expect(service.getPlanById('plan-1', 'u1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('和好方案'),
      });
    });

    it('有 userId 且非當事人應拋出 FORBIDDEN', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        judgment: {
          case: { plaintiff_id: 'u1', defendant_id: 'u2' },
        },
      });

      await expect(service.getPlanById('plan-1', 'u3')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('成功應返回方案', async () => {
      const plan = {
        id: 'plan-1',
        judgment: { case: { plaintiff_id: 'u1', defendant_id: 'u2' } },
      };
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(plan);

      const result = await service.getPlanById('plan-1', 'u1');

      expect(result).toEqual(plan);
    });
  });

  describe('selectPlan', () => {
    it('方案不存在應拋出 NOT_FOUND', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue(null);

      await expect(service.selectPlan('plan-1', 'u1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('非當事人應拋出 FORBIDDEN', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        judgment: {
          case: { plaintiff_id: 'u1', defendant_id: 'u2' },
        },
      });

      await expect(service.selectPlan('plan-1', 'u3')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('當事人 user1 選擇應更新 user1_selected', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        judgment: {
          case: { plaintiff_id: 'u1', defendant_id: 'u2' },
        },
      });
      prismaMock.reconciliationPlan.update.mockResolvedValue({
        id: 'plan-1',
        user1_selected: true,
        user2_selected: false,
      });

      const result = await service.selectPlan('plan-1', 'u1');

      expect(result.user1_selected).toBe(true);
      expect(prismaMock.reconciliationPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { user1_selected: true },
      });
    });

    it('當事人 user2 選擇應更新 user2_selected', async () => {
      prismaMock.reconciliationPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        judgment: {
          case: { plaintiff_id: 'u1', defendant_id: 'u2' },
        },
      });
      prismaMock.reconciliationPlan.update.mockResolvedValue({
        id: 'plan-1',
        user1_selected: false,
        user2_selected: true,
      });

      const result = await service.selectPlan('plan-1', 'u2');

      expect(result.user2_selected).toBe(true);
      expect(prismaMock.reconciliationPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { user2_selected: true },
      });
    });
  });
});
