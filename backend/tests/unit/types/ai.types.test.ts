/**
 * types/ai.types 單元測試（類型守衛 isResponsibilityRatio、isReconciliationPlanContent）
 */
import { describe, it, expect } from '@jest/globals';
import {
  isResponsibilityRatio,
  isReconciliationPlanContent,
} from '../../../src/types/ai.types';

describe('ai.types', () => {
  describe('isResponsibilityRatio', () => {
    it('應接受 plaintiff + defendant = 100 的對象', () => {
      expect(isResponsibilityRatio({ plaintiff: 60, defendant: 40 })).toBe(true);
    });
    it('應拒絕非對象', () => {
      expect(isResponsibilityRatio(null)).toBe(false);
      expect(isResponsibilityRatio(1)).toBe(false);
    });
    it('應拒絕總和非 100 的對象', () => {
      expect(isResponsibilityRatio({ plaintiff: 50, defendant: 40 })).toBe(false);
    });
    it('應拒絕負數', () => {
      expect(isResponsibilityRatio({ plaintiff: -10, defendant: 110 })).toBe(false);
      expect(isResponsibilityRatio({ plaintiff: 60, defendant: -40 })).toBe(false);
    });
    it('應拒絕缺少 plaintiff 或 defendant', () => {
      expect(isResponsibilityRatio({ defendant: 100 })).toBe(false);
      expect(isResponsibilityRatio({ plaintiff: 100 })).toBe(false);
    });
    it('應拒絕非數字類型', () => {
      expect(isResponsibilityRatio({ plaintiff: '60', defendant: 40 })).toBe(false);
      expect(isResponsibilityRatio({ plaintiff: 60, defendant: '40' })).toBe(false);
    });
    it('應接受 0+100 與 100+0 邊界', () => {
      expect(isResponsibilityRatio({ plaintiff: 0, defendant: 100 })).toBe(true);
      expect(isResponsibilityRatio({ plaintiff: 100, defendant: 0 })).toBe(true);
    });
    it('應拒絕 undefined', () => {
      expect(isResponsibilityRatio(undefined)).toBe(false);
    });
  });

  describe('isReconciliationPlanContent', () => {
    it('應拒絕 null 或非對象', () => {
      expect(isReconciliationPlanContent(null)).toBe(false);
      expect(isReconciliationPlanContent(undefined)).toBe(false);
      expect(isReconciliationPlanContent('x')).toBe(false);
    });
    it('應接受符合介面的對象', () => {
      const valid = {
        title: 't',
        description: 'd',
        steps: ['s1'],
        expected_effect: 'e',
        fit_reason: 'f',
        do_not_use_when: [],
        first_step: 'start',
        fallback_step: 'fallback',
        pause_rule: 'pause',
        time_cost: 1,
        money_cost: 2,
        emotion_cost: 3,
        skill_requirement: 4,
        plan_type: 'activity',
      };
      expect(isReconciliationPlanContent(valid)).toBe(true);
    });
    it('應拒絕 plan_type 不在允許列表', () => {
      const invalid = {
        title: 't',
        description: 'd',
        steps: [],
        expected_effect: 'e',
        fit_reason: 'f',
        do_not_use_when: [],
        first_step: 'start',
        fallback_step: 'fallback',
        pause_rule: 'pause',
        time_cost: 1,
        money_cost: 2,
        emotion_cost: 3,
        skill_requirement: 4,
        plan_type: 'other',
      };
      expect(isReconciliationPlanContent(invalid)).toBe(false);
    });
    it('應拒絕缺少必填欄位', () => {
      expect(isReconciliationPlanContent({})).toBe(false);
      expect(isReconciliationPlanContent({ title: 't' })).toBe(false);
    });
    it('應拒絕 steps 非陣列', () => {
      const invalid = {
        title: 't',
        description: 'd',
        steps: 'not-array',
        expected_effect: 'e',
        fit_reason: 'f',
        do_not_use_when: [],
        first_step: 'start',
        fallback_step: 'fallback',
        pause_rule: 'pause',
        time_cost: 1,
        money_cost: 2,
        emotion_cost: 3,
        skill_requirement: 4,
        plan_type: 'activity',
      };
      expect(isReconciliationPlanContent(invalid)).toBe(false);
    });
    it('應接受空 steps 陣列', () => {
      const valid = {
        title: 't',
        description: 'd',
        steps: [],
        expected_effect: 'e',
        fit_reason: 'f',
        do_not_use_when: [],
        first_step: 'start',
        fallback_step: 'fallback',
        pause_rule: 'pause',
        time_cost: 1,
        money_cost: 2,
        emotion_cost: 3,
        skill_requirement: 4,
        plan_type: 'activity',
      };
      expect(isReconciliationPlanContent(valid)).toBe(true);
    });
  });
});
