import { describe, expect, it } from 'vitest';
import type { Case } from '@/types/case';
import type { Judgment } from '@/types/judgment';
import {
  canUploadEvidenceForCaseStatus,
  getEvidenceUploadStatusFromCase,
  getPendingEvidenceStorageKey,
  getResponsibilityRatio,
  isJudgmentFailedState,
  isPendingJudgmentErrorCode,
  isSessionJudgmentErrorCode,
  resolveQuickResultSessionId,
  shouldShowResponsibilityRatio,
} from './resultUtils';

function createJudgment(overrides: Partial<Judgment> = {}): Judgment {
  return {
    id: 'judgment-1',
    case_id: 'case-1',
    judgment_content: 'content',
    plaintiff_ratio: 60,
    defendant_ratio: 40,
    ai_model: 'test',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('quick result utils', () => {
  it('優先使用後端標準化後的 responsibility_ratio', () => {
    expect(getResponsibilityRatio(createJudgment({
      responsibility_ratio: { plaintiff: 55, defendant: 45 },
      plaintiff_ratio: 70,
      defendant_ratio: 30,
    }))).toEqual({ plaintiff: 55, defendant: 45 });
  });

  it('缺少 responsibility_ratio 時回退使用舊欄位比例', () => {
    expect(getResponsibilityRatio(createJudgment())).toEqual({ plaintiff: 60, defendant: 40 });
  });

  it('安全支援與危機支援路由不展示責任比例', () => {
    expect(shouldShowResponsibilityRatio(createJudgment({ judgment_route: 'standard' }))).toBe(true);
    expect(shouldShowResponsibilityRatio(createJudgment({ judgment_route: 'safety_support' }))).toBe(false);
    expect(shouldShowResponsibilityRatio(createJudgment({ judgment_route: 'crisis_support' }))).toBe(false);
  });

  it('判決等待、session 錯誤、判決失敗分類保持明確', () => {
    expect(isPendingJudgmentErrorCode('JUDGMENT_PENDING')).toBe(true);
    expect(isPendingJudgmentErrorCode('HTTP_404')).toBe(true);
    expect(isSessionJudgmentErrorCode('SESSION_EXPIRED')).toBe(true);
    expect(isSessionJudgmentErrorCode('INVALID_SESSION_ID')).toBe(true);
    expect(isJudgmentFailedState('JUDGMENT_FAILED', null)).toBe(true);
    expect(isJudgmentFailedState(null, 'judgment_failed')).toBe(true);
  });

  it('只允許草稿、已提交與處理中的案件補充證據', () => {
    expect(canUploadEvidenceForCaseStatus('draft')).toBe(true);
    expect(canUploadEvidenceForCaseStatus('submitted')).toBe(true);
    expect(canUploadEvidenceForCaseStatus('in_progress')).toBe(true);
    expect(canUploadEvidenceForCaseStatus('completed')).toBe(false);
  });

  it('依案件證據與 pending marker 推導證據上傳狀態', () => {
    expect(getEvidenceUploadStatusFromCase({ evidences: [{ id: 'e1' }] } as Case, false)).toBe('success');
    expect(getEvidenceUploadStatusFromCase({ evidences: [] } as unknown as Case, true)).toBe('pending');
    expect(getEvidenceUploadStatusFromCase({ evidences: [] } as unknown as Case, false)).toBeNull();
  });

  it('pending evidence storage key 使用案件維度', () => {
    expect(getPendingEvidenceStorageKey('case-1')).toBe('pending_evidence_case-1');
  });

  it('session fallback 順序保持 case map 優先，其次全局 session，再其次 store session', () => {
    expect(resolveQuickResultSessionId({
      caseSessionId: 'case-session',
      globalSessionId: 'global-session',
      storeSessionId: 'store-session',
    })).toBe('case-session');
    expect(resolveQuickResultSessionId({
      caseSessionId: null,
      globalSessionId: 'global-session',
      storeSessionId: 'store-session',
    })).toBe('global-session');
    expect(resolveQuickResultSessionId({
      caseSessionId: null,
      globalSessionId: null,
      storeSessionId: 'store-session',
    })).toBe('store-session');
  });
});
