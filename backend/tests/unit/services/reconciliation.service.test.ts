/**
 * ReconciliationService 單元測試
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGenerateReconciliationPlans = jest.fn();
const mockIsReconciliationPlanContent = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetEffectiveRouteSnapshot: any = jest.fn();

const validPlanContent = {
  title: '方案標題',
  description: '描述',
  steps: ['步驟1'],
  expected_effect: '效果',
  fit_reason: '適配原因',
  do_not_use_when: ['現在不適合'],
  first_step: '今天先做這一步',
  fallback_step: '換成更低壓版本',
  pause_rule: '先停一下',
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
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  repairTrack: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  repairParticipantState: {
    upsert: jest.fn(),
  },
  repairTrackEvent: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
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
jest.mock('../../../src/services/case-context.service', () => ({
  caseContextService: {
    loadCaseContext: jest.fn(),
    formatForReconciliationPlans: jest.fn(),
    formatDiagnosticContext: jest.fn(),
  },
}));
jest.mock('../../../src/services/notification.service', () => ({
  notificationService: {
    createIfEnabled: jest.fn(),
  },
}));
jest.mock('../../../src/services/safety-assessment.service', () => ({
  safetyAssessmentService: {
    getEffectiveRouteSnapshot: (...args: unknown[]) => mockGetEffectiveRouteSnapshot(...args),
  },
}));

import { ReconciliationService } from '../../../src/services/reconciliation.service';
import { caseContextService } from '../../../src/services/case-context.service';
import { buildSafetyAssessmentSnapshotForRoute } from '../../../src/utils/product-safety-policy';

const baseJudgment = {
  id: 'judge-1',
  case: {
    id: 'case-1',
    type: '情感需求衝突',
    mode: 'remote',
    plaintiff_id: 'u1',
    defendant_id: 'u2',
  },
  plaintiff_ratio: 50,
  defendant_ratio: 50,
  summary: '摘要',
  judgment_content: '判決內容',
  emotional_analysis: null,
};

const storedPlan = {
  id: 'plan-1',
  judgment_id: 'judge-1',
  intent: 'repair',
  plan_content: JSON.stringify(validPlanContent),
  plan_type: 'activity',
  difficulty_level: 'medium',
  estimated_duration: 7,
  time_cost: 1,
  money_cost: 0,
  emotion_cost: 1,
  skill_requirement: 1,
  user1_selected: false,
  user2_selected: false,
  created_at: new Date(),
  version_group_id: null,
  superseded_at: null,
  superseded_by_plan_id: null,
  judgment: baseJudgment,
  repair_track: null,
};

describe('ReconciliationService', () => {
  let service: ReconciliationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReconciliationService();
    mockIsReconciliationPlanContent.mockReturnValue(true);
    prismaMock.reconciliationPlan.count.mockResolvedValue(0);
    (caseContextService.loadCaseContext as any).mockResolvedValue(null);
    (caseContextService.formatForReconciliationPlans as any).mockReturnValue(undefined);
    (caseContextService.formatDiagnosticContext as any).mockReturnValue(undefined);
    mockGetEffectiveRouteSnapshot.mockImplementation(async (_scope: unknown, route: unknown, options?: { fallbackReasons?: string[]; fallbackMetadata?: Record<string, unknown> }) => {
      const fallbackRoute = route === 'safety_support' || route === 'crisis_support' ? route : 'standard';
      return {
        source: 'fallback_route',
        snapshot: buildSafetyAssessmentSnapshotForRoute(fallbackRoute, {
          reasons: options?.fallbackReasons,
          metadata: options?.fallbackMetadata,
        }),
      };
    });
  });

  it('generatePlans 應返回帶 recommended_plan_id 的 bundle', async () => {
    prismaMock.judgment.findUnique.mockResolvedValue(baseJudgment);
    prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);
    mockGenerateReconciliationPlans.mockResolvedValue([validPlanContent] as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        reconciliationPlan: {
          create: jest.fn().mockResolvedValue(storedPlan as never),
          updateMany: jest.fn(),
        },
        repairTrack: {
          updateMany: jest.fn(),
        },
      };
      return fn(tx);
    });

    const result = await service.generatePlans('judge-1', {
      intent: 'repair',
      preferences: { pressure_level: 'low' },
    }, 'u1', 'en-US');

    expect(mockGenerateReconciliationPlans).toHaveBeenCalledWith(
      '情感需求衝突',
      { plaintiff: 50, defendant: 50 },
      '摘要',
      undefined,
      undefined,
      undefined,
      expect.objectContaining({
        intent: 'repair',
        locale: 'en-US',
        preferenceSummary: expect.stringContaining('壓力承受度：low'),
      }),
    );
    expect(result.recommended_plan_id).toBe('plan-1');
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].fit_reason).toBe('適配原因');
  });

  it('chat-to-case 產品流即使 mode=quick 也應載入修復方案個人化上下文', async () => {
    const chatToCaseJudgment = {
      ...baseJudgment,
      case: {
        ...baseJudgment.case,
        mode: 'quick',
        session_id: 'guest_1704067200000_abcdefghijklmnop',
        chat_to_case_links: [{ id: 'link-1' }],
      },
    };
    prismaMock.judgment.findUnique.mockResolvedValue(chatToCaseJudgment);
    prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);
    (caseContextService.loadCaseContext as any).mockResolvedValue({ userA: {}, userB: null, relationship: null });
    (caseContextService.formatForReconciliationPlans as any).mockReturnValue('chat-to-case personalization');
    (caseContextService.formatDiagnosticContext as any).mockReturnValue(undefined);
    mockGenerateReconciliationPlans.mockResolvedValue([validPlanContent] as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        reconciliationPlan: {
          create: jest.fn().mockResolvedValue({
            ...storedPlan,
            judgment: chatToCaseJudgment,
          } as never),
          updateMany: jest.fn(),
        },
        repairTrack: {
          updateMany: jest.fn(),
        },
      };
      return fn(tx);
    });

    const result = await service.generatePlans('judge-1', { intent: 'repair' }, 'u1');

    expect(caseContextService.loadCaseContext).toHaveBeenCalledWith('case-1');
    expect(mockGenerateReconciliationPlans).toHaveBeenCalledWith(
      '情感需求衝突',
      { plaintiff: 50, defendant: 50 },
      '摘要',
      'chat-to-case personalization',
      undefined,
      undefined,
      expect.objectContaining({ intent: 'repair' }),
    );
    expect(result.journey_entry.journey_context?.repair_access).toMatchObject({
      product_flow: 'chat_to_case',
      relationship_scope: 'chat_to_case_dual_perspective',
      pairing_strength: 'weak_contextual',
    });
  });

  it('已有同方向方案時應直接返回 bundle', async () => {
    prismaMock.judgment.findUnique.mockResolvedValue(baseJudgment);
    prismaMock.reconciliationPlan.findMany.mockResolvedValue([storedPlan]);

    const result = await service.generatePlans('judge-1', { intent: 'repair' }, 'u1');

    expect(mockGenerateReconciliationPlans).not.toHaveBeenCalled();
    expect(result.plans[0].id).toBe('plan-1');
    expect(result.intent).toBe('repair');
  });

  it('高風險判決未指定 intent 時應默認生成 safety_support 方案', async () => {
    const safetyJudgment = {
      ...baseJudgment,
      emotional_analysis: { route: 'safety_support' },
      judgment_content: '判決內容',
    };
    prismaMock.judgment.findUnique.mockResolvedValue(safetyJudgment);
    prismaMock.reconciliationPlan.findMany.mockResolvedValue([]);
    mockGenerateReconciliationPlans.mockResolvedValue([{ ...validPlanContent, risk_note: '安全優先' }] as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        reconciliationPlan: {
          create: jest.fn().mockResolvedValue({
            ...storedPlan,
            intent: 'safety_support',
            judgment: safetyJudgment,
            plan_content: JSON.stringify({ ...validPlanContent, risk_note: '安全優先' }),
          } as never),
          updateMany: jest.fn(),
        },
        repairTrack: {
          updateMany: jest.fn(),
        },
      };
      return fn(tx);
    });

    const result = await service.generatePlans('judge-1', undefined, 'u1');

    expect(prismaMock.reconciliationPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ judgment_id: 'judge-1', intent: 'safety_support' }),
    }));
    expect(mockGenerateReconciliationPlans).toHaveBeenCalledWith(
      '情感需求衝突',
      { plaintiff: 50, defendant: 50 },
      '摘要',
      undefined,
      expect.stringContaining('安全支持路由'),
      undefined,
      expect.objectContaining({ intent: 'safety_support' }),
    );
    expect(result.intent).toBe('safety_support');
  });

  it('高風險判決明確要求 repair 時應拒絕一般共同修復方案', async () => {
    prismaMock.judgment.findUnique.mockResolvedValue({
      ...baseJudgment,
      emotional_analysis: { route: 'crisis_support' },
    });

    await expect(service.generatePlans('judge-1', { intent: 'repair' }, 'u1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(mockGenerateReconciliationPlans).not.toHaveBeenCalled();
  });

  it('session-bound quick case 要求邀請伴侶時應拒絕並保持 solo 邊界', async () => {
    prismaMock.judgment.findUnique.mockResolvedValue({
      ...baseJudgment,
      case: {
        ...baseJudgment.case,
        mode: 'quick',
        session_id: 'guest_1',
      },
    });

    await expect(service.generatePlans('judge-1', {
      intent: 'repair',
      preferences: { invite_partner: true },
    }, 'u1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(mockGenerateReconciliationPlans).not.toHaveBeenCalled();
  });

  it('無已登入當事人的案件不能生成修復方案', async () => {
    prismaMock.judgment.findUnique.mockResolvedValue({
      ...baseJudgment,
      case: {
        ...baseJudgment.case,
        plaintiff_id: null,
        defendant_id: null,
      },
    });

    await expect(service.generatePlans('judge-1', { intent: 'repair' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mockGenerateReconciliationPlans).not.toHaveBeenCalled();
  });

  it('selectPlan 應為當前用戶建立承諾與 track', async () => {
    prismaMock.reconciliationPlan.findUnique
      .mockResolvedValueOnce(storedPlan)
      .mockResolvedValueOnce({
        ...storedPlan,
        user1_selected: true,
        repair_track: {
          id: 'track-1',
          status: 'draft',
          recommended_mode: 'solo',
          partner_invited_at: null,
          participant_states: [
            {
              user_id: 'u1',
              commitment_status: 'committed',
              viewed_at: new Date(),
              committed_at: new Date(),
            },
          ],
          step_progresses: [],
          checkins: [],
        },
      });
    prismaMock.reconciliationPlan.update.mockResolvedValue({ ...storedPlan, user1_selected: true });
    prismaMock.repairTrack.create.mockResolvedValue({
      id: 'track-1',
      participant_states: [],
      step_progresses: [],
      checkins: [],
    });
    prismaMock.repairParticipantState.upsert.mockResolvedValue({});
    prismaMock.repairTrack.findUnique.mockResolvedValue({
      id: 'track-1',
      status: 'draft',
      recommended_mode: 'solo',
      partner_invited_at: null,
      participant_states: [
        { user_id: 'u1', commitment_status: 'committed' },
      ],
    });
    prismaMock.repairTrack.update.mockResolvedValue({
      id: 'track-1',
      status: 'draft',
      recommended_mode: 'solo',
      partner_invited_at: null,
      participant_states: [
        { user_id: 'u1', commitment_status: 'committed', viewed_at: new Date(), committed_at: new Date() },
      ],
      step_progresses: [],
      checkins: [],
    });

    const result = await service.selectPlan('plan-1', 'u1');

    expect(prismaMock.repairParticipantState.upsert).toHaveBeenCalled();
    expect(result.commitment.current_user.commitment_status).toBe('committed');
  });

  it('force_regenerate 應保留舊版本並標記 superseded，而不是直接刪除', async () => {
    prismaMock.judgment.findUnique.mockResolvedValue(baseJudgment);
    prismaMock.reconciliationPlan.findMany.mockResolvedValue([
      { ...storedPlan, version_group_id: 'vg-1' },
    ]);
    mockGenerateReconciliationPlans.mockResolvedValue([validPlanContent] as never);
    const tx = {
      reconciliationPlan: {
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ ...storedPlan, id: 'plan-2', version_group_id: 'vg-1' } as never),
      },
      repairTrack: {
        updateMany: jest.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (fn: (innerTx: unknown) => unknown) => fn(tx));

    const result = await service.generatePlans('judge-1', { intent: 'repair', force_regenerate: true }, 'u1');

    expect(tx.reconciliationPlan.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        version_group_id: 'vg-1',
      }),
    }));
    expect(result.plans[0].id).toBe('plan-2');
  });

  it('respondPlan(viewed) 應記錄 invitee 已查看狀態', async () => {
    prismaMock.reconciliationPlan.findUnique
      .mockResolvedValueOnce({
        ...storedPlan,
        repair_track: {
          id: 'track-1',
          status: 'partner_invited',
          recommended_mode: 'solo',
          partner_invited_at: new Date(),
          participant_states: [
            { user_id: 'u1', commitment_status: 'committed', viewed_at: new Date(), committed_at: new Date() },
            { user_id: 'u2', commitment_status: 'not_viewed', viewed_at: null, committed_at: null, invited_at: new Date() },
          ],
          step_progresses: [],
          checkins: [],
        },
      })
      .mockResolvedValueOnce({
        ...storedPlan,
        repair_track: {
          id: 'track-1',
          status: 'partner_invited',
          recommended_mode: 'solo',
          partner_invited_at: new Date(),
          participant_states: [
            { user_id: 'u1', commitment_status: 'committed', viewed_at: new Date(), committed_at: new Date() },
            { user_id: 'u2', commitment_status: 'viewed', viewed_at: new Date(), committed_at: null, invited_at: new Date() },
          ],
          step_progresses: [],
          checkins: [],
        },
      });
    prismaMock.repairParticipantState.upsert.mockResolvedValue({});
    prismaMock.repairTrack.findUnique.mockResolvedValue({
      id: 'track-1',
      status: 'partner_invited',
      recommended_mode: 'solo',
      partner_invited_at: new Date(),
      participant_states: [
        { user_id: 'u1', commitment_status: 'committed' },
        { user_id: 'u2', commitment_status: 'viewed' },
      ],
    });
    prismaMock.repairTrack.update.mockResolvedValue({
      id: 'track-1',
      status: 'partner_invited',
      recommended_mode: 'solo',
      partner_invited_at: new Date(),
      participant_states: [],
      step_progresses: [],
      checkins: [],
    });

    const result = await service.respondPlan('plan-1', 'u2', 'viewed');

    expect(prismaMock.repairParticipantState.upsert).toHaveBeenCalled();
    expect(prismaMock.repairTrackEvent.create).toHaveBeenCalled();
    expect(result.commitment.current_user.commitment_status).toBe('viewed');
  });

  it('安全支持方案應拒絕邀請伴侶加入修復旅程', async () => {
    prismaMock.reconciliationPlan.findUnique.mockResolvedValue({
      ...storedPlan,
      intent: 'safety_support',
      judgment: {
        ...baseJudgment,
        emotional_analysis: { route: 'safety_support' },
      },
    });

    await expect(service.invitePartner('plan-1', 'u1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.repairTrack.create).not.toHaveBeenCalled();
  });

  it('session-bound quick 方案應拒絕邀請伴侶加入修復旅程', async () => {
    prismaMock.reconciliationPlan.findUnique.mockResolvedValue({
      ...storedPlan,
      judgment: {
        ...baseJudgment,
        case: {
          ...baseJudgment.case,
          mode: 'quick',
          session_id: 'guest_1',
        },
      },
    });

    await expect(service.invitePartner('plan-1', 'u1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.repairTrack.create).not.toHaveBeenCalled();
  });

  it('active relationship risk state 應覆蓋 judgment route 並拒絕邀請伴侶', async () => {
    prismaMock.reconciliationPlan.findUnique.mockResolvedValue({
      ...storedPlan,
      judgment: {
        ...baseJudgment,
        emotional_analysis: { route: 'standard' },
      },
    });
    mockGetEffectiveRouteSnapshot.mockResolvedValueOnce({
      source: 'active_risk_state',
      snapshot: buildSafetyAssessmentSnapshotForRoute('safety_support', {
        reasons: ['active risk state'],
      }),
    });

    await expect(service.invitePartner('plan-1', 'u1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.repairTrack.create).not.toHaveBeenCalled();
  });
});
