const txMock = {
  safetyAssessment: {
    create: jest.fn(),
  },
  relationshipRiskState: {
    updateMany: jest.fn(),
    create: jest.fn(),
  },
};

const prismaMock = {
  $transaction: jest.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
  relationshipRiskState: {
    findFirst: jest.fn(),
  },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { SafetyAssessmentService } from '../../../src/services/safety-assessment.service';
import { buildSafetyAssessmentSnapshotForRoute } from '../../../src/utils/product-safety-policy';

describe('SafetyAssessmentService', () => {
  let service: SafetyAssessmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    txMock.safetyAssessment.create.mockResolvedValue({ id: 'assessment-1' });
    txMock.relationshipRiskState.updateMany.mockResolvedValue({ count: 0 });
    txMock.relationshipRiskState.create.mockResolvedValue({ id: 'state-1' });
    prismaMock.relationshipRiskState.findFirst.mockResolvedValue(null);
    service = new SafetyAssessmentService(prismaMock as never);
  });

  it('getActiveRiskState 應讀取同 scope active state', async () => {
    prismaMock.relationshipRiskState.findFirst.mockResolvedValue({ id: 'state-1' });

    await expect(service.getActiveRiskState({ subjectType: 'case', subjectId: 'case-1' })).resolves.toEqual({
      id: 'state-1',
    });

    expect(prismaMock.relationshipRiskState.findFirst).toHaveBeenCalledWith({
      where: {
        scope_type: 'case',
        scope_id: 'case-1',
        is_active: true,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });
  });

  it('getEffectiveRouteSnapshot 有 active state 時應優先使用持久風險狀態', async () => {
    prismaMock.relationshipRiskState.findFirst.mockResolvedValue({
      id: 'state-1',
      scope_type: 'chat_room',
      scope_id: 'room-1',
      current_risk_level: 'imminent_crisis',
      judgment_route: 'crisis_support',
      can_invite_partner: false,
      can_use_co_repair: false,
      can_notify_partner: false,
      can_show_responsibility_ratio: false,
      force_solo_repair: true,
      source_assessment_id: 'assessment-1',
      reasons: ['active risk'],
      metadata: { reviewed: true },
    });

    await expect(
      service.getEffectiveRouteSnapshot({ subjectType: 'chat_room', subjectId: 'room-1' }, 'standard')
    ).resolves.toMatchObject({
      source: 'active_risk_state',
      snapshot: {
        risk_level: 'imminent_crisis',
        judgment_route: 'crisis_support',
        can_invite_partner: false,
        force_solo_repair: true,
        reasons: ['active risk'],
        metadata: {
          kind: 'relationship_risk_state_snapshot',
          relationship_risk_state_id: 'state-1',
          source_assessment_id: 'assessment-1',
          reviewed: true,
        },
      },
    });
  });

  it('getEffectiveRouteSnapshot 無 active state 時應回退 route policy', async () => {
    await expect(
      service.getEffectiveRouteSnapshot(
        { subjectType: 'case', subjectId: 'case-1' },
        'safety_support',
        { fallbackReasons: ['fallback'], fallbackMetadata: { case_id: 'case-1' } }
      )
    ).resolves.toMatchObject({
      source: 'fallback_route',
      snapshot: {
        risk_level: 'high_risk_relationship',
        judgment_route: 'safety_support',
        force_solo_repair: true,
        reasons: ['fallback'],
        metadata: {
          kind: 'product_safety_route_snapshot',
          case_id: 'case-1',
        },
      },
    });
  });

  it('recordAssessment 應建立 assessment 並刷新 active risk state', async () => {
    const snapshot = buildSafetyAssessmentSnapshotForRoute('safety_support', {
      reasons: ['safety'],
      metadata: { room_id: 'room-1' },
    });

    await service.recordAssessment({
      subjectType: 'chat_room',
      subjectId: 'room-1',
      source: 'chat_judgment_policy',
      snapshot,
      assessedByUserId: 'user-1',
      metadata: { link_id: 'link-1' },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.safetyAssessment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subject_type: 'chat_room',
        subject_id: 'room-1',
        source: 'chat_judgment_policy',
        risk_level: 'high_risk_relationship',
        judgment_route: 'safety_support',
        can_invite_partner: false,
        can_use_co_repair: false,
        can_notify_partner: false,
        can_show_responsibility_ratio: false,
        force_solo_repair: true,
        reasons: ['safety'],
        assessed_by_user_id: 'user-1',
        metadata: expect.objectContaining({
          kind: 'product_safety_route_snapshot',
          room_id: 'room-1',
          link_id: 'link-1',
        }),
      }),
    });
    expect(txMock.relationshipRiskState.updateMany).toHaveBeenCalledWith({
      where: {
        scope_type: 'chat_room',
        scope_id: 'room-1',
        is_active: true,
      },
      data: { is_active: false },
    });
    expect(txMock.relationshipRiskState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope_type: 'chat_room',
        scope_id: 'room-1',
        current_risk_level: 'high_risk_relationship',
        source_assessment_id: 'assessment-1',
        is_active: true,
      }),
    });
  });

  it('recordAssessment 可只寫 assessment 不刷新 active state', async () => {
    await service.recordAssessment({
      subjectType: 'case',
      subjectId: 'case-1',
      source: 'formal_case_assertion',
      snapshot: buildSafetyAssessmentSnapshotForRoute('standard'),
      updateActiveRiskState: false,
    });

    expect(txMock.safetyAssessment.create).toHaveBeenCalledTimes(1);
    expect(txMock.relationshipRiskState.updateMany).not.toHaveBeenCalled();
    expect(txMock.relationshipRiskState.create).not.toHaveBeenCalled();
  });

  it('recordRouteAssessment 應使用 route snapshot 與預設 judgment_route source', async () => {
    await service.recordRouteAssessment(
      { subjectType: 'case', subjectId: 'case-1' },
      'crisis_support',
      { metadata: { judgment_id: 'judgment-1' } }
    );

    expect(txMock.safetyAssessment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'judgment_route',
        risk_level: 'imminent_crisis',
        judgment_route: 'crisis_support',
        force_solo_repair: true,
        metadata: expect.objectContaining({
          judgment_id: 'judgment-1',
        }),
      }),
    });
  });
});
