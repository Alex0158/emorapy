import { beforeEach, describe, expect, it } from '@jest/globals';
import { getProductSafetyPolicy } from '../../../src/utils/product-safety-policy';

const mockGetEffectiveRouteSnapshot = jest.fn();

jest.mock('../../../src/services/safety-assessment.service', () => ({
  safetyAssessmentService: {
    getEffectiveRouteSnapshot: (...args: unknown[]) => mockGetEffectiveRouteSnapshot(...args),
  },
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  buildRepairAccessContext,
  getRepairEligibilityForCase,
  getRepairJourneyAccessPolicyForJudgment,
  getRepairJourneyAccessPolicy,
} from '../../../src/services/repair-eligibility.service';

describe('repair-eligibility.service', () => {
  beforeEach(() => {
    mockGetEffectiveRouteSnapshot.mockReset();
  });

  it('session-bound quick case 應強制 solo 並禁止伴侶邀請與通知', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'quick',
      session_id: 'guest_1',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    });

    expect(policy.flow).toBe('session_bound');
    expect(policy.productFlow).toBe('quick_single');
    expect(policy.relationshipScope).toBe('quick_single_solo');
    expect(policy.pairingStrength).toBe('session_context');
    expect(policy.canGeneratePlans).toBe(true);
    expect(policy.forceSoloRepair).toBe(true);
    expect(policy.canInvitePartner).toBe(false);
    expect(policy.canNotifyPartner).toBe(false);
  });

  it('session-bound collaborative case 應強制 solo', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'collaborative',
      session_id: 'guest_1',
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    });

    expect(policy.flow).toBe('session_bound');
    expect(policy.productFlow).toBe('quick_collaborative');
    expect(policy.relationshipScope).toBe('quick_collaborative_solo');
    expect(policy.forceSoloRepair).toBe(true);
    expect(policy.canUseCoRepair).toBe(false);
  });

  it('正式單方案件可生成方案但不可共同修復', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'remote',
      session_id: null,
      plaintiff_id: 'u1',
      defendant_id: null,
    });

    expect(policy.flow).toBe('formal_solo');
    expect(policy.productFlow).toBe('formal_remote');
    expect(policy.relationshipScope).toBe('formal_single_party');
    expect(policy.canGeneratePlans).toBe(true);
    expect(policy.forceSoloRepair).toBe(true);
    expect(policy.canInvitePartner).toBe(false);
  });

  it('正式雙方案件可共同修復與通知伴侶', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'remote',
      session_id: null,
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    });

    expect(policy.flow).toBe('formal_dual');
    expect(policy.relationshipScope).toBe('formal_dual_party');
    expect(policy.pairingStrength).toBe('formal_confirmed');
    expect(policy.canGeneratePlans).toBe(true);
    expect(policy.forceSoloRepair).toBe(false);
    expect(policy.canInvitePartner).toBe(true);
    expect(policy.canNotifyPartner).toBe(true);
  });

  it('沒有任何已登入當事人時不能生成修復方案', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'remote',
      session_id: null,
      plaintiff_id: null,
      defendant_id: null,
    });

    expect(policy.canGeneratePlans).toBe(false);
    expect(policy.forceSoloRepair).toBe(true);
  });

  it('chat-to-case 單方視角應標記弱配對並只允許 solo', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'quick',
      session_id: 'guest_1',
      plaintiff_id: 'u1',
      defendant_id: null,
      chat_to_case_links: [{ id: 'link-1' }],
    });

    expect(policy.flow).toBe('formal_solo');
    expect(policy.productFlow).toBe('chat_to_case');
    expect(policy.relationshipScope).toBe('chat_to_case_single_perspective');
    expect(policy.pairingStrength).toBe('weak_contextual');
    expect(policy.canGeneratePlans).toBe(true);
    expect(policy.forceSoloRepair).toBe(true);
    expect(policy.canInvitePartner).toBe(false);
  });

  it('chat-to-case 雙方視角應標記弱配對但保留共同修復資格', () => {
    const policy = getRepairEligibilityForCase({
      mode: 'collaborative',
      session_id: null,
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      chat_to_case_links: [{ id: 'link-1' }],
    });

    expect(policy.flow).toBe('formal_dual');
    expect(policy.productFlow).toBe('chat_to_case');
    expect(policy.relationshipScope).toBe('chat_to_case_dual_perspective');
    expect(policy.pairingStrength).toBe('weak_contextual');
    expect(policy.canUseCoRepair).toBe(true);
    expect(policy.canInvitePartner).toBe(true);
  });

  it('repair journey access 應合併安全路由與案件資格', () => {
    const eligibility = getRepairEligibilityForCase({
      mode: 'remote',
      session_id: null,
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    });

    const access = getRepairJourneyAccessPolicy(
      getProductSafetyPolicy('safety_support'),
      eligibility,
    );

    expect(access.canEnterRepairJourney).toBe(true);
    expect(access.relationshipScope).toBe('formal_dual_party');
    expect(access.pairingStrength).toBe('formal_confirmed');
    expect(access.canInvitePartner).toBe(false);
    expect(access.canUseCoRepair).toBe(false);
    expect(access.canNotifyPartner).toBe(false);
    expect(access.forceSoloRepair).toBe(true);
    expect(access.reasons).toEqual(expect.arrayContaining([
      '安全支持路由不得把關係風險對稱化或推進共同修復',
      '正式雙方案件允許共同修復旅程',
    ]));
  });

  it('repair access context 應輸出前端使用的 snake_case 固定契約', () => {
    const eligibility = getRepairEligibilityForCase({
      mode: 'collaborative',
      session_id: null,
      plaintiff_id: 'u1',
      defendant_id: 'u2',
      chat_to_case_links: [{ id: 'link-1' }],
    });
    const access = getRepairJourneyAccessPolicy(
      getProductSafetyPolicy('standard'),
      eligibility,
    );

    expect(buildRepairAccessContext(access)).toEqual({
      flow: 'formal_dual',
      product_flow: 'chat_to_case',
      relationship_scope: 'chat_to_case_dual_perspective',
      pairing_strength: 'weak_contextual',
      can_invite_partner: true,
      can_use_co_repair: true,
      can_notify_partner: true,
      force_solo_repair: false,
      safety_source: undefined,
      risk_level: undefined,
      reasons: expect.arrayContaining([
        '聊天室轉判決屬弱配對上下文；可共同修復但前端需標示為先聊再判的弱配對視角',
      ]),
    });
  });

  it('repair journey access 無登入當事人時不可進入旅程', () => {
    const eligibility = getRepairEligibilityForCase({
      mode: 'remote',
      session_id: null,
      plaintiff_id: null,
      defendant_id: null,
    });

    const access = getRepairJourneyAccessPolicy(
      getProductSafetyPolicy('standard'),
      eligibility,
    );

    expect(access.canEnterRepairJourney).toBe(false);
    expect(access.forceSoloRepair).toBe(true);
    expect(access.canInvitePartner).toBe(false);
  });

  it('repair journey access 應優先讀取 case scope active risk state', async () => {
    mockGetEffectiveRouteSnapshot.mockResolvedValueOnce({
      source: 'active_risk_state',
      snapshot: {
        risk_level: 'high_risk_relationship',
        judgment_route: 'safety_support',
        can_invite_partner: false,
        can_use_co_repair: false,
        can_notify_partner: false,
        can_show_responsibility_ratio: false,
        force_solo_repair: true,
        reasons: ['active safety state'],
        metadata: {},
      },
    });
    const eligibility = getRepairEligibilityForCase({
      mode: 'remote',
      session_id: null,
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    });

    const access = await getRepairJourneyAccessPolicyForJudgment({
      id: 'judgment-1',
      judgment_content: '一般判決內容',
      emotional_analysis: { route: 'standard' },
      case: {
        id: 'case-1',
        mode: 'remote',
        session_id: null,
        plaintiff_id: 'u1',
        defendant_id: 'u2',
      },
    }, eligibility);

    expect(mockGetEffectiveRouteSnapshot).toHaveBeenCalledWith(
      { subjectType: 'case', subjectId: 'case-1' },
      'standard',
      expect.objectContaining({
        fallbackMetadata: expect.objectContaining({
          judgment_id: 'judgment-1',
          case_id: 'case-1',
        }),
      }),
    );
    expect(access.safetySource).toBe('active_risk_state');
    expect(access.riskLevel).toBe('high_risk_relationship');
    expect(access.canInvitePartner).toBe(false);
    expect(access.canUseCoRepair).toBe(false);
    expect(access.forceSoloRepair).toBe(true);
    expect(access.reasons).toEqual(expect.arrayContaining(['active safety state']));
  });

  it('repair journey access 讀取 active risk state 失敗時應回退 route policy', async () => {
    mockGetEffectiveRouteSnapshot.mockRejectedValueOnce(new Error('missing table'));
    const eligibility = getRepairEligibilityForCase({
      mode: 'remote',
      session_id: null,
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    });

    const access = await getRepairJourneyAccessPolicyForJudgment({
      id: 'judgment-2',
      judgment_content: '一般判決內容',
      emotional_analysis: { route: 'standard' },
      case: {
        id: 'case-2',
        mode: 'remote',
        session_id: null,
        plaintiff_id: 'u1',
        defendant_id: 'u2',
      },
    }, eligibility);

    expect(access.safetySource).toBe('route_policy');
    expect(access.canInvitePartner).toBe(true);
    expect(access.canUseCoRepair).toBe(true);
    expect(access.forceSoloRepair).toBe(false);
  });
});
