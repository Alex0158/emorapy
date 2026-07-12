/**
 * ExecutionService 單元測試
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStartPlan = jest.fn();
const mockResumeTrack = jest.fn();
const mockGetSnapshots = jest.fn();
const mockCreateStream = jest.fn();
const mockStreamStart = jest.fn();
const mockStreamPhase = jest.fn();
const mockStreamCompleted = jest.fn();
const mockStreamPersisted = jest.fn();
const mockStreamFailed = jest.fn();
const mockGenerateReplannedRepairPlan = jest.fn();
const mockCreateNotification = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetEffectiveRouteSnapshot: any = jest.fn();

const basePlan = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  judgment_id: 'judgment-1',
  user1_selected: true,
  user2_selected: false,
  estimated_duration: 7,
  plan_content: JSON.stringify({
    title: '測試方案',
    description: '描述',
    steps: ['步驟1'],
    expected_effect: '效果',
    fit_reason: '適配原因',
    do_not_use_when: ['暫時不適合'],
    first_step: '先做這一步',
    fallback_step: '換成更低壓版本',
    pause_rule: '先停一下',
  }),
  plan_type: 'communication',
  difficulty_level: 'medium',
  judgment: {
    emotional_analysis: null,
    judgment_content: '一般衝突判決',
    case: {
      id: 'case-1',
      mode: 'remote',
      session_id: null,
      plaintiff_id: 'u1',
      defendant_id: 'u2',
    },
  },
  repair_track: null,
  execution_records: [],
  ...overrides,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  reconciliationPlan: { findUnique: jest.fn() },
  executionRecord: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  repairTrack: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  repairCheckIn: { create: jest.fn() },
  repairStepProgress: { update: jest.fn(), updateMany: jest.fn(), createMany: jest.fn() },
  repairTrackEvent: { create: jest.fn() },
  $transaction: jest.fn(),
  case: { findMany: jest.fn() },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/services/reconciliation.service', () => ({
  reconciliationService: {
    startPlan: (...args: unknown[]) => mockStartPlan(...args),
    resumeTrack: (...args: unknown[]) => mockResumeTrack(...args),
  },
}));
jest.mock('../../../src/services/ai-stream.service', () => ({
  aiStreamService: {
    getSnapshots: (...args: unknown[]) => mockGetSnapshots(...args),
    createStream: (...args: unknown[]) => mockCreateStream(...args),
    start: (...args: unknown[]) => mockStreamStart(...args),
    phase: (...args: unknown[]) => mockStreamPhase(...args),
    completed: (...args: unknown[]) => mockStreamCompleted(...args),
    persisted: (...args: unknown[]) => mockStreamPersisted(...args),
    failed: (...args: unknown[]) => mockStreamFailed(...args),
  },
}));
jest.mock('../../../src/services/ai.service', () => ({
  CRISIS_SIGNAL_REGEX: /自傷|自殺/,
  IPV_SIGNAL_REGEX: /控制|威脅|暴力|權力不對等|經濟控制|人身威脅|貶低人格|孤立社交/,
  aiService: {
    generateReplannedRepairPlan: (...args: unknown[]) => mockGenerateReplannedRepairPlan(...args),
  },
}));
jest.mock('../../../src/services/notification.service', () => ({
  notificationService: {
    createIfEnabled: (...args: unknown[]) => mockCreateNotification(...args),
  },
}));
jest.mock('../../../src/services/safety-assessment.service', () => ({
  safetyAssessmentService: {
    getEffectiveRouteSnapshot: (...args: unknown[]) => mockGetEffectiveRouteSnapshot(...args),
  },
}));

import { ExecutionService } from '../../../src/services/execution.service';
import { buildSafetyAssessmentSnapshotForRoute } from '../../../src/utils/product-safety-policy';

describe('ExecutionService', () => {
  let service: ExecutionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExecutionService();
    mockStartPlan.mockResolvedValue({} as never);
    mockResumeTrack.mockResolvedValue({ track_id: 'track-1', plan_id: 'plan-1', status: 'solo_active' } as never);
    mockGetSnapshots.mockResolvedValue([] as never);
    mockCreateStream.mockResolvedValue({
      streamId: 'stream-1',
      requestId: 'request-1',
      scopeType: 'repair_track',
      scopeId: 'track-1',
    } as never);
    mockStreamStart.mockResolvedValue(undefined as never);
    mockStreamPhase.mockResolvedValue(undefined as never);
    mockStreamCompleted.mockResolvedValue(undefined as never);
    mockStreamPersisted.mockResolvedValue(undefined as never);
    mockStreamFailed.mockResolvedValue(undefined as never);
    prismaMock.repairTrack.update.mockResolvedValue({});
    mockGenerateReplannedRepairPlan.mockResolvedValue({
      title: '低壓調整版',
      description: '先降一點壓力',
      steps: ['先做一個人的小步驟'],
      expected_effect: '保持安全與可持續',
      fit_reason: '目前需要較低壓方式',
      do_not_use_when: [],
      first_step: '先照顧自己的節奏',
      fallback_step: '暫停並尋求支持',
      pause_rule: '壓力升高就暫停',
      risk_note: null,
      plan_type: 'communication',
      difficulty_level: 'low',
      estimated_duration: 3,
      time_cost: 'low',
      money_cost: 'none',
      emotion_cost: 'low',
      skill_requirement: 'basic',
    } as never);
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

  it('confirmExecution 應在成功時啟動 repair journey', async () => {
    prismaMock.reconciliationPlan.findUnique.mockResolvedValue(basePlan());
    prismaMock.executionRecord.findFirst.mockResolvedValue(null);
    prismaMock.executionRecord.create.mockResolvedValue({
      id: 'exec-1',
      reconciliation_plan_id: 'plan-1',
      user_id: 'u1',
      action: 'confirm',
      status: 'in_progress',
    });

    const result = await service.confirmExecution('u1', 'plan-1', 'en-US');

    expect(mockStartPlan).toHaveBeenCalledWith('plan-1', 'u1', 'en-US');
    expect(result.action).toBe('confirm');
  });

  it('checkin 應寫入 repair_checkins 並更新旅程脈搏', async () => {
    prismaMock.reconciliationPlan.findUnique.mockResolvedValue(basePlan());
    prismaMock.repairTrack.findUnique.mockResolvedValue({
      id: 'track-1',
      plan_id: 'plan-1',
      status: 'solo_active',
      current_step_index: 0,
      step_progresses: [
        { step_index: 0, step_title: '今天的一小步', step_content: '先做這一步' },
      ],
    });
    prismaMock.repairCheckIn.create.mockResolvedValue({ id: 'checkin-1' });
    prismaMock.repairStepProgress.update.mockResolvedValue({});
    prismaMock.repairTrack.update.mockResolvedValue({});
    prismaMock.executionRecord.create.mockResolvedValue({
      id: 'exec-2',
      action: 'checkin',
      status: 'in_progress',
      photos_urls: [],
    });

    await service.checkin('u1', {
      plan_id: 'plan-1',
      step_result: 'partial',
      closeness: 'farther',
      stress: 'high',
      needs_help: true,
      notes: '今天有點卡',
    });

    expect(prismaMock.repairCheckIn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        repair_track_id: 'track-1',
        user_id: 'u1',
        result: 'partial',
        closeness: 'farther',
        stress: 'high',
        needs_help: true,
      }),
    });
    expect(prismaMock.repairTrack.update).toHaveBeenCalledWith({
      where: { id: 'track-1' },
      data: expect.objectContaining({
        status: 'replanning',
        needs_replan: true,
        last_closeness: 'farther',
        last_stress: 'high',
      }),
    });
  });

  it('getExecutionStatus 應返回當前步驟與脈搏摘要', async () => {
    prismaMock.reconciliationPlan.findUnique.mockResolvedValue(basePlan({
      repair_track: {
        status: 'solo_active',
        recommended_mode: 'solo',
        partner_invited_at: null,
        participant_states: [],
        step_progresses: [{ step_index: 0, step_title: '今天的一小步', step_content: '先做這一步' }],
        checkins: [],
      },
    }));
    prismaMock.executionRecord.findMany.mockResolvedValue([]);
    prismaMock.repairTrack.findUnique.mockResolvedValue({
      id: 'track-1',
      status: 'solo_active',
      recommended_mode: 'solo',
      current_step_index: 0,
      needs_replan: false,
      last_closeness: 'same',
      last_stress: 'medium',
      last_needs_help: false,
      partner_invited_at: null,
      participant_states: [],
      step_progresses: [{ step_index: 0, step_title: '今天的一小步', step_content: '先做這一步', fallback_content: '改低壓版本', pause_rule: '先停一下', status: 'active' }],
      checkins: [],
    });

    const result = await service.getExecutionStatus('u1', 'plan-1');

    expect(result.current_step?.content).toBe('先做這一步');
    expect(result.pulse_summary).toEqual({
      closeness: 'same',
      stress: 'medium',
      needs_replan: false,
      needs_help: false,
    });
    expect(result.track_id).toBe('track-1');
  });

  it('getExecutionStatus 對安全路由應強制 solo 並移除邀請 CTA', async () => {
    prismaMock.reconciliationPlan.findUnique.mockResolvedValue(basePlan({
      user2_selected: true,
      judgment: {
        emotional_analysis: { route: 'safety_support' },
        judgment_content: '存在控制與威脅風險',
        case: {
          mode: 'remote',
          session_id: null,
          plaintiff_id: 'u1',
          defendant_id: 'u2',
        },
      },
    }));
    prismaMock.executionRecord.findMany.mockResolvedValue([]);
    prismaMock.repairTrack.findUnique.mockResolvedValue({
      id: 'track-1',
      status: 'co_active',
      recommended_mode: 'co',
      current_step_index: 0,
      needs_replan: false,
      last_closeness: 'same',
      last_stress: 'medium',
      last_needs_help: false,
      partner_invited_at: null,
      participant_states: [
        { user_id: 'u1', commitment_status: 'committed' },
        { user_id: 'u2', commitment_status: 'committed' },
      ],
      step_progresses: [{ step_index: 0, step_title: '今天的一小步', step_content: '先做這一步', fallback_content: '改低壓版本', pause_rule: '先停一下', status: 'active' }],
      checkins: [],
    });

    const result = await service.getExecutionStatus('u1', 'plan-1');

    expect(result.relationship_mode).toBe('solo');
    expect(result.journey_context.primary_cta.action).toBe('continue_today_step');
    expect(result.journey_context.secondary_cta?.action).toBe('review_recommendation');
    expect(result.journey_context.title).toBe('今天只要先做一小步');
  });

  it('getExecutionStatus 應用 active relationship risk state 覆蓋標準判決路由', async () => {
    prismaMock.reconciliationPlan.findUnique.mockResolvedValue(basePlan({
      user2_selected: true,
      judgment: {
        emotional_analysis: { route: 'standard' },
        judgment_content: '一般衝突判決',
        case: {
          id: 'case-1',
          mode: 'remote',
          session_id: null,
          plaintiff_id: 'u1',
          defendant_id: 'u2',
        },
      },
    }));
    prismaMock.executionRecord.findMany.mockResolvedValue([]);
    prismaMock.repairTrack.findUnique.mockResolvedValue({
      id: 'track-1',
      status: 'co_active',
      recommended_mode: 'co',
      current_step_index: 0,
      needs_replan: false,
      last_closeness: 'same',
      last_stress: 'medium',
      last_needs_help: false,
      partner_invited_at: null,
      participant_states: [
        { user_id: 'u1', commitment_status: 'committed' },
        { user_id: 'u2', commitment_status: 'committed' },
      ],
      step_progresses: [{ step_index: 0, step_title: '今天的一小步', step_content: '先做這一步', fallback_content: '改低壓版本', pause_rule: '先停一下', status: 'active' }],
      checkins: [],
    });
    mockGetEffectiveRouteSnapshot.mockResolvedValue({
      source: 'active_risk_state',
      snapshot: buildSafetyAssessmentSnapshotForRoute('safety_support', {
        reasons: ['active risk state'],
      }),
    });

    const result = await service.getExecutionStatus('u1', 'plan-1');

    expect(mockGetEffectiveRouteSnapshot).toHaveBeenCalledWith(
      { subjectType: 'case', subjectId: 'case-1' },
      'standard',
      expect.any(Object),
    );
    expect(result.relationship_mode).toBe('solo');
    expect(result.journey_context.secondary_cta?.action).toBe('review_recommendation');
  });

  it('replanTrack 應保留 track 並生成新 plan version', async () => {
    const runReplanTaskSpy = jest
      .spyOn(service as unknown as { runReplanTask: () => Promise<void> }, 'runReplanTask')
      .mockImplementation(async () => undefined);
    prismaMock.repairTrack.findUnique.mockResolvedValue({
      id: 'track-1',
      plan_id: 'plan-1',
      intent: 'repair',
      status: 'replanning',
      participant_states: [
        { user_id: 'u1', commitment_status: 'committed' },
      ],
      step_progresses: [
        { step_index: 0, status: 'partial' },
      ],
      plan: {
        ...basePlan({ version_group_id: 'vg-1' }),
        judgment_id: 'judge-1',
        version_group_id: 'vg-1',
      },
    });
    const result = await service.replanTrack('u1', 'track-1', {
      mode: 'lower_pressure',
      reason: 'manual',
    }, 'en-US');

    expect(result).toEqual({
      track_id: 'track-1',
      status: 'replanning',
      accepted: true,
      stream_scope: 'repair_track',
      scope_id: 'track-1',
      stream_id: 'stream-1',
      request_id: 'request-1',
    });
    expect(mockCreateStream).toHaveBeenCalledWith('repair_track', 'track-1');
    expect(runReplanTaskSpy.mock.calls[0]).toEqual([
      'track-1',
      'u1',
      { mode: 'lower_pressure', reason: 'manual' },
      expect.objectContaining({ streamId: 'stream-1', requestId: 'request-1' }),
      expect.objectContaining({
        status: 'solo_active',
        planId: 'plan-1',
        judgmentId: 'judge-1',
      }),
      'en-US',
    ]);
  });

  it('replanTrack 接受請求前應拒絕 active safety state 不允許的既有 intent', async () => {
    const runReplanTaskSpy = jest
      .spyOn(service as unknown as { runReplanTask: () => Promise<void> }, 'runReplanTask')
      .mockImplementation(async () => undefined);
    prismaMock.repairTrack.findUnique.mockResolvedValue({
      id: 'track-1',
      plan_id: 'plan-1',
      intent: 'repair',
      status: 'co_active',
      recommended_mode: 'co',
      participant_states: [
        { user_id: 'u1', commitment_status: 'committed' },
        { user_id: 'u2', commitment_status: 'committed' },
      ],
      step_progresses: [],
      plan: {
        ...basePlan({ version_group_id: 'vg-1' }),
        judgment_id: 'judgment-1',
        version_group_id: 'vg-1',
      },
    });
    mockGetEffectiveRouteSnapshot.mockResolvedValue({
      source: 'active_risk_state',
      snapshot: buildSafetyAssessmentSnapshotForRoute('safety_support', {
        reasons: ['risk escalated before replan acceptance'],
      }),
    });

    await expect(service.replanTrack('u1', 'track-1', {
      mode: 'lower_pressure',
      reason: 'manual',
    })).rejects.toThrow('目前安全狀態不允許重新調整此方案');

    expect(mockGetSnapshots).not.toHaveBeenCalled();
    expect(mockCreateStream).not.toHaveBeenCalled();
    expect(prismaMock.repairTrack.update).not.toHaveBeenCalled();
    expect(runReplanTaskSpy).not.toHaveBeenCalled();
  });

  it('runReplanTask 應攔截接受後才升級的 safety state，且不得生成或通知共同方案', async () => {
    prismaMock.repairTrack.findUnique.mockResolvedValue({
      id: 'track-1',
      plan_id: 'plan-1',
      intent: 'repair',
      status: 'replanning',
      recommended_mode: 'co',
      participant_states: [
        { user_id: 'u1', commitment_status: 'committed' },
        { user_id: 'u2', commitment_status: 'committed' },
      ],
      step_progresses: [],
      checkins: [],
      last_closeness: 'same',
      last_stress: 'medium',
      last_needs_help: false,
      plan: {
        ...basePlan({ version_group_id: 'vg-1', user2_selected: true }),
        summary: '一般衝突',
        version_group_id: 'vg-1',
        time_cost: 'medium',
        money_cost: 'none',
        emotion_cost: 'medium',
        skill_requirement: 'basic',
      },
    });
    mockGetEffectiveRouteSnapshot.mockResolvedValue({
      source: 'active_risk_state',
      snapshot: buildSafetyAssessmentSnapshotForRoute('safety_support', {
        reasons: ['risk escalated while task was queued'],
      }),
    });

    await (service as unknown as {
      runReplanTask: (
        trackId: string,
        requestedBy: string,
        dto: { mode: 'lower_pressure'; reason: 'manual' },
        handle: { streamId: string; requestId: string; scopeType: 'repair_track'; scopeId: string },
        fallback: { status: 'co_active'; planId: string; judgmentId: string; versionGroupId: string },
        locale: 'zh-TW',
      ) => Promise<void>;
    }).runReplanTask(
      'track-1',
      'u1',
      { mode: 'lower_pressure', reason: 'manual' },
      { streamId: 'stream-1', requestId: 'request-1', scopeType: 'repair_track', scopeId: 'track-1' },
      { status: 'co_active', planId: 'plan-1', judgmentId: 'judgment-1', versionGroupId: 'vg-1' },
      'zh-TW',
    );

    expect(mockGenerateReplannedRepairPlan).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(prismaMock.repairTrack.update).toHaveBeenCalledWith({
      where: { id: 'track-1' },
      data: {
        status: 'solo_active',
        status_reason: 'replan_failed',
        needs_replan: true,
      },
    });
    expect(mockStreamFailed).toHaveBeenCalled();
  });

  it('runReplanTask 在 force solo policy 下應生成 solo plan 並禁止 partner notification', async () => {
    const track = {
      id: 'track-1',
      plan_id: 'plan-1',
      intent: 'cool_down',
      status: 'replanning',
      recommended_mode: 'co',
      participant_states: [
        { user_id: 'u1', commitment_status: 'committed' },
        { user_id: 'u2', commitment_status: 'committed' },
      ],
      step_progresses: [{ step_index: 0, status: 'active' }],
      checkins: [],
      last_closeness: 'same',
      last_stress: 'medium',
      last_needs_help: false,
      plan: {
        ...basePlan({ version_group_id: 'vg-1', user2_selected: true }),
        summary: '需要降溫',
        version_group_id: 'vg-1',
        time_cost: 'medium',
        money_cost: 'none',
        emotion_cost: 'medium',
        skill_requirement: 'basic',
      },
    };
    prismaMock.repairTrack.findUnique
      .mockResolvedValueOnce(track)
      .mockResolvedValueOnce({
        id: 'track-1',
        status: 'solo_active',
        recommended_mode: 'solo',
        status_reason: 'replan_ready',
        partner_invited_at: null,
        participant_states: track.participant_states,
        plan: {
          ...track.plan,
          id: 'plan-2',
          intent: 'cool_down',
        },
      });
    mockGetEffectiveRouteSnapshot.mockResolvedValue({
      source: 'active_risk_state',
      snapshot: buildSafetyAssessmentSnapshotForRoute('safety_support', {
        reasons: ['force solo repair'],
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx: any = {
      reconciliationPlan: {
        create: jest.fn(),
        update: jest.fn(),
      },
      repairStepProgress: {
        updateMany: jest.fn(),
        createMany: jest.fn(),
      },
      repairTrack: {
        update: jest.fn(),
      },
      repairTrackEvent: {
        create: jest.fn(),
      },
    };
    tx.reconciliationPlan.create.mockResolvedValue({ id: 'plan-2' });
    tx.reconciliationPlan.update.mockResolvedValue({});
    tx.repairStepProgress.updateMany.mockResolvedValue({ count: 1 });
    tx.repairStepProgress.createMany.mockResolvedValue({ count: 1 });
    tx.repairTrack.update.mockImplementation(async ({ data }: { data: { status: string } }) => ({
      id: 'track-1',
      status: data.status,
    }));
    tx.repairTrackEvent.create.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    await (service as unknown as {
      runReplanTask: (
        trackId: string,
        requestedBy: string,
        dto: { mode: 'lower_pressure'; reason: 'manual' },
        handle: { streamId: string; requestId: string; scopeType: 'repair_track'; scopeId: string },
        fallback: { status: 'co_active'; planId: string; judgmentId: string; versionGroupId: string },
        locale: 'zh-TW',
      ) => Promise<void>;
    }).runReplanTask(
      'track-1',
      'u1',
      { mode: 'lower_pressure', reason: 'manual' },
      { streamId: 'stream-1', requestId: 'request-1', scopeType: 'repair_track', scopeId: 'track-1' },
      { status: 'co_active', planId: 'plan-1', judgmentId: 'judgment-1', versionGroupId: 'vg-1' },
      'zh-TW',
    );

    expect(mockGenerateReplannedRepairPlan).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'cool_down',
      relationshipMode: 'solo',
    }));
    expect(tx.reconciliationPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user1_selected: true,
        user2_selected: false,
      }),
    });
    expect(tx.repairTrack.update).toHaveBeenCalledWith({
      where: { id: 'track-1' },
      data: expect.objectContaining({
        recommended_mode: 'solo',
        status: 'solo_active',
      }),
    });
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockStreamCompleted).toHaveBeenCalled();
    expect(mockStreamPersisted).toHaveBeenCalled();
  });

  it('resumeTrack 應委派給 reconciliationService.resumeTrack', async () => {
    const result = await service.resumeTrack('u1', 'track-1');
    expect(mockResumeTrack).toHaveBeenCalledWith('track-1', 'u1');
    expect(result.status).toBe('solo_active');
  });
});
