/**
 * CaseContextService 單元測試 — formatDiagnosticContext & formatForReconciliationPlans
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { CaseContextService } from '../../../src/services/case-context.service';
import type { CaseContextResult } from '../../../src/services/case-context.service';

describe('CaseContextService', () => {
  let service: CaseContextService;

  beforeEach(() => {
    service = new CaseContextService();
  });

  describe('formatDiagnosticContext', () => {
    const fullAnalysis = {
      severity: 'moderate',
      personA: {
        primaryFeelings: '被忽視的孤獨感',
        unmetNeeds: '被看見、被優先考慮',
        communicationPattern: '追逐型',
        readinessStage: '準備期',
      },
      personB: {
        primaryFeelings: '無力感、被誤解的委屈',
        unmetNeeds: '被認可努力',
        communicationPattern: '迴避型',
        readinessStage: '沉思期',
      },
      interactionCycle: '追-逃循環：A 追問 → B 沉默 → A 追更緊',
      triggerPattern: 'A 的觸發點：精心準備被忽視',
      coreIssue: '雙方都在問「我在你生命中排第幾位？」',
      secondaryIssues: ['時間管理期待落差'],
      relationshipStrengths: 'A 仍願意準備驚喜、B 遲到仍趕去',
      suggestedApproach: '先處理追-逃循環的覺察',
      gottmanFlags: ['批評', '石牆'],
      safetyFlags: [],
    };

    it('完整 EmotionalAnalysis 應生成包含所有區塊的診斷上下文', () => {
      const result = service.formatDiagnosticContext(fullAnalysis);

      expect(result).not.toBeNull();
      expect(result).toContain('嚴重程度：moderate');
      expect(result).toContain('角色 A 的情感狀態');
      expect(result).toContain('核心感受：被忽視的孤獨感');
      expect(result).toContain('改變準備度：準備期');
      expect(result).toContain('角色 B 的情感狀態');
      expect(result).toContain('改變準備度：沉思期');
      expect(result).toContain('互動循環模式：追-逃循環');
      expect(result).toContain('循環觸發點');
      expect(result).toContain('核心議題');
      expect(result).toContain('時間管理期待落差');
      expect(result).toContain('關係中仍在運作的力量');
      expect(result).toContain('建議介入方向');
      expect(result).toContain('Gottman 四騎士');
      expect(result).toContain('批評');
      expect(result).toContain('石牆');
    });

    it('空物件應返回 null', () => {
      const result = service.formatDiagnosticContext({});
      expect(result).toBeNull();
    });

    it('僅有部分欄位應只生成對應區塊', () => {
      const partial = {
        interactionCycle: '追-逃循環',
        coreIssue: '信任問題',
      };
      const result = service.formatDiagnosticContext(partial);

      expect(result).not.toBeNull();
      expect(result).toContain('互動循環模式：追-逃循環');
      expect(result).toContain('核心議題：信任問題');
      expect(result).not.toContain('嚴重程度');
      expect(result).not.toContain('角色 A');
      expect(result).not.toContain('Gottman');
    });

    it('沒有 secondaryIssues 時不應出現「其他相關議題」', () => {
      const noSecondary = { coreIssue: '核心問題' };
      const result = service.formatDiagnosticContext(noSecondary);

      expect(result).toContain('核心議題：核心問題');
      expect(result).not.toContain('其他相關議題');
    });

    it('空 gottmanFlags 陣列不應出現 Gottman 區塊', () => {
      const emptyFlags = { gottmanFlags: [], coreIssue: '問題' };
      const result = service.formatDiagnosticContext(emptyFlags);

      expect(result).not.toContain('Gottman');
    });

    it('personA 部分欄位缺失時只顯示有值的欄位', () => {
      const partial = {
        personA: {
          primaryFeelings: '焦慮',
        },
      };
      const result = service.formatDiagnosticContext(partial);

      expect(result).toContain('核心感受：焦慮');
      expect(result).not.toContain('未滿足需求');
      expect(result).not.toContain('溝通模式');
      expect(result).not.toContain('改變準備度');
    });
  });

  describe('loadCaseContext', () => {
    it('preloadedCase mode 為 quick 時應返回 null（F01/F05 邊界：quick 模式不載入 context）', async () => {
      const result = await service.loadCaseContext('case-1', {
        type: '其他衝突',
        mode: 'quick',
        plaintiff_id: 'u1',
        defendant_id: 'u2',
        pairing_id: 'p1',
      });
      expect(result).toBeNull();
    });

    it('preloadedCase plaintiff_id 為 null 時應返回 null（F01/F05 邊界：無原告不載入）', async () => {
      const result = await service.loadCaseContext('case-1', {
        type: '其他衝突',
        mode: 'remote',
        plaintiff_id: null,
        defendant_id: 'u2',
        pairing_id: null,
      });
      expect(result).toBeNull();
    });
  });

  describe('formatForEmotionalAnalysis', () => {
    it('無 attachmentHint 與 communicationHint 時應返回 null（F04/F05 邊界：空 ctx 不崩潰）', () => {
      const ctx: CaseContextResult = {
        userA: { label: '角色A', attachmentHint: null, communicationHint: null, keyInsights: [], culturalHint: null },
        userB: null,
        relationship: null,
        relevantDomains: [],
        caseType: '其他衝突',
      };
      expect(service.formatForEmotionalAnalysis(ctx)).toBeNull();
    });
  });

  describe('formatForResponsibilityRatio', () => {
    it('relationship 為 null 或無 duration/stage 時應返回 null（F04 邊界：空 ctx 不崩潰）', () => {
      const ctx: CaseContextResult = {
        userA: null,
        userB: null,
        relationship: null,
        relevantDomains: [],
        caseType: '其他衝突',
      };
      expect(service.formatForResponsibilityRatio(ctx)).toBeNull();
    });
  });

  describe('formatForSummary', () => {
    it('relationship 無 duration/stage 時應返回 null（F04/F05 邊界：空 ctx 不崩潰）', () => {
      const ctx: CaseContextResult = {
        userA: null,
        userB: null,
        relationship: {
          duration: null,
          stage: null,
          isLongDistance: false,
          strengths: [],
          challenges: [],
          bottomLines: { userA: [], userB: [] },
          conflictStyle: null,
          historicalPatterns: null,
          executionRate: null,
        },
        relevantDomains: [],
        caseType: '其他衝突',
      };
      expect(service.formatForSummary(ctx)).toBeNull();
    });
  });

  describe('formatForReconciliationPlans — culturalHint', () => {
    it('有 culturalHint 時應包含文化背景資訊', () => {
      const ctx: CaseContextResult = {
        userA: {
          label: '角色A',
          attachmentHint: '焦慮依附',
          communicationHint: '偏感性',
          keyInsights: [],
          culturalHint: '東亞傳統家庭觀念',
        },
        userB: null,
        relationship: null,
        relevantDomains: [],
        caseType: '其他衝突',
      };

      const result = service.formatForReconciliationPlans(ctx);

      expect(result).not.toBeNull();
      expect(result).toContain('文化背景：東亞傳統家庭觀念');
    });

    it('沒有 culturalHint 時不應包含文化背景區塊', () => {
      const ctx: CaseContextResult = {
        userA: {
          label: '角色A',
          attachmentHint: '焦慮依附',
          communicationHint: null,
          keyInsights: [],
          culturalHint: null,
        },
        userB: null,
        relationship: null,
        relevantDomains: [],
        caseType: '其他衝突',
      };

      const result = service.formatForReconciliationPlans(ctx);

      expect(result).not.toBeNull();
      expect(result).not.toContain('文化背景');
    });
  });
});
