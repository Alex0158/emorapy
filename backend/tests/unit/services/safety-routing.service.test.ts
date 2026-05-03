/**
 * SafetyRoutingService 單元測試
 * 對齊 F02-BUG-002 建議驗證方案：打人/動手/推/扇巴掌/拉扯等語句必須進入 safety_support
 */
import { describe, it, expect } from '@jest/globals';
import {
  getProductSafetyPolicy,
  getProductSafetyPolicyForJudgment,
  safetyRoutingService,
} from '../../../src/services/safety-routing.service';

describe('SafetyRoutingService', () => {
  describe('decideRoute - IPV 信號應進入 safety_support（F02-BUG-002 護欄）', () => {
    const ipvPhrases = [
      { plaintiff: '他打我', defendant: '' },
      { plaintiff: '我打了他', defendant: '' },
      { plaintiff: '對方動手', defendant: '' },
      { plaintiff: '推我', defendant: '' },
      { plaintiff: '扇巴掌', defendant: '' },
      { plaintiff: '砸東西', defendant: '' },
      { plaintiff: '掐', defendant: '' },
      { plaintiff: '拉扯', defendant: '' },
      { plaintiff: '摔東西', defendant: '' },
      { plaintiff: '衝過來', defendant: '' },
      { plaintiff: '控制行為', defendant: '' },
      { plaintiff: '暴力', defendant: '' },
      { plaintiff: '威脅', defendant: '' },
      { plaintiff: '原告陳述一般內容', defendant: '他動手打我' },
      { plaintiff: '摔碗後又打男朋友', defendant: '' },
    ];

    ipvPhrases.forEach(({ plaintiff, defendant }) => {
      it(`「${plaintiff}」${defendant ? ` / 「${defendant}」` : ''} 應進入 safety_support`, () => {
        const result = safetyRoutingService.decideRoute({
          plaintiffStatement: plaintiff,
          defendantStatement: defendant,
        });
        expect(result.route).toBe('safety_support');
        expect(result.reasons).toContain('偵測到安全風險，需進入安全支持路徑');
        expect(result.detectedFlags).toContain('控制/暴力/威脅風險');
      });
    });
  });

  describe('decideRoute - analysis.safetyFlags 含 IPV 關鍵字應進入 safety_support', () => {
    const ipvFlags = ['控制', '威脅', '暴力', '權力不對等', '經濟控制', '人身威脅', '貶低人格', '孤立社交'];

    ipvFlags.forEach((flag) => {
      it(`safetyFlags 含「${flag}」時應進入 safety_support`, () => {
        const result = safetyRoutingService.decideRoute({
          plaintiffStatement: '一般陳述',
          defendantStatement: '一般回覆',
          analysis: { safetyFlags: [flag] },
        });
        expect(result.route).toBe('safety_support');
      });
    });
  });

  describe('decideRoute - 危機信號應進入 crisis_support', () => {
    const crisisPhrases = [
      { plaintiff: '我想自傷', defendant: '' },
      { plaintiff: '有自殺念頭', defendant: '' },
      { plaintiff: '一般陳述', defendant: '自傷傾向' },
    ];

    crisisPhrases.forEach(({ plaintiff, defendant }) => {
      it(`「${plaintiff}」${defendant ? ` / 「${defendant}」` : ''} 應進入 crisis_support`, () => {
        const result = safetyRoutingService.decideRoute({
          plaintiffStatement: plaintiff,
          defendantStatement: defendant,
        });
        expect(result.route).toBe('crisis_support');
        expect(result.reasons).toContain('偵測到危機信號，需進入危機支持路徑');
        expect(result.detectedFlags).toContain('自傷/自殺風險');
      });
    });

    it('safetyFlags 含「自傷」時應進入 crisis_support', () => {
      const result = safetyRoutingService.decideRoute({
        plaintiffStatement: '一般陳述',
        defendantStatement: '',
        analysis: { safetyFlags: ['自傷'] },
      });
      expect(result.route).toBe('crisis_support');
    });

    it('safetyFlags 含「自殺」時應進入 crisis_support', () => {
      const result = safetyRoutingService.decideRoute({
        plaintiffStatement: '一般陳述',
        defendantStatement: '',
        analysis: { safetyFlags: ['自殺'] },
      });
      expect(result.route).toBe('crisis_support');
    });
  });

  describe('decideRoute - 危機優先於 IPV', () => {
    it('同時含自傷與暴力信號時應進入 crisis_support（危機優先）', () => {
      const result = safetyRoutingService.decideRoute({
        plaintiffStatement: '我想自傷，他動手打我',
        defendantStatement: '',
      });
      expect(result.route).toBe('crisis_support');
    });
  });

  describe('decideRoute - 一般衝突應進入 standard', () => {
    it('無高風險信號時應進入 standard', () => {
      const result = safetyRoutingService.decideRoute({
        plaintiffStatement: '我們在家務分配上有摩擦',
        defendantStatement: '我最近工作很忙',
      });
      expect(result.route).toBe('standard');
      expect(result.reasons).toContain('未偵測到高風險信號，使用標準路徑');
    });

    it('空陳述時應進入 standard', () => {
      const result = safetyRoutingService.decideRoute({
        plaintiffStatement: '',
        defendantStatement: '',
      });
      expect(result.route).toBe('standard');
    });

    it('空 analysis 時應進入 standard', () => {
      const result = safetyRoutingService.decideRoute({
        plaintiffStatement: '一般陳述',
        defendantStatement: '一般回覆',
        analysis: null,
      });
      expect(result.route).toBe('standard');
    });

    it('analysis.severity 為 serious 且無危機/IPV 時應進入 standard', () => {
      const result = safetyRoutingService.decideRoute({
        plaintiffStatement: '一般陳述',
        defendantStatement: '一般回覆',
        analysis: { severity: 'serious' },
      });
      expect(result.route).toBe('standard');
      expect(result.reasons).toContain('嚴重衝突但無明確危機信號，維持標準路徑並加強情緒承接');
    });
  });

  describe('decideRoute - 邊界', () => {
    it('plaintiffStatement 為 undefined 時應視為空字串', () => {
      const result = safetyRoutingService.decideRoute({
        plaintiffStatement: undefined as unknown as string,
        defendantStatement: '他打我',
      });
      expect(result.route).toBe('safety_support');
    });

    it('defendantStatement 為 undefined 時應視為空字串', () => {
      const result = safetyRoutingService.decideRoute({
        plaintiffStatement: '他打我',
        defendantStatement: undefined as unknown as string,
      });
      expect(result.route).toBe('safety_support');
    });
  });

  describe('product safety policy', () => {
    it('stored safety route 應禁止伴侶邀請與共同修復，並默認 safety_support intent', () => {
      const policy = getProductSafetyPolicyForJudgment({
        emotional_analysis: { route: 'safety_support' },
        judgment_content: '一般內容',
      });

      expect(policy).toMatchObject({
        route: 'safety_support',
        isHighRisk: true,
        defaultReconciliationIntent: 'safety_support',
        canInvitePartner: false,
        canUseCoRepair: false,
        canNotifyPartner: false,
        canShowResponsibilityRatio: false,
        forceSoloRepair: true,
      });
      expect(policy.allowedReconciliationIntents).not.toContain('repair');
    });

    it('沒有 stored route 時應用 judgment_content fallback 判斷危機路由', () => {
      const policy = getProductSafetyPolicyForJudgment({
        judgment_content: '判決內容提到自殺念頭，需要先求助',
      });

      expect(policy.route).toBe('crisis_support');
      expect(policy.defaultReconciliationIntent).toBe('safety_support');
    });

    it('standard policy 應允許一般修復與伴侶通知', () => {
      const policy = getProductSafetyPolicy('standard');

      expect(policy.canInvitePartner).toBe(true);
      expect(policy.canUseCoRepair).toBe(true);
      expect(policy.canNotifyPartner).toBe(true);
      expect(policy.canShowResponsibilityRatio).toBe(true);
      expect(policy.allowedReconciliationIntents).toContain('repair');
    });
  });
});
