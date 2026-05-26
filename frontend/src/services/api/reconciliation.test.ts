/**
 * 和好方案 API 單元測試
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generatePlans,
  getPlans,
  getPlanById,
  selectPlan,
  invitePartner,
  pausePlan,
  getCommitment,
  respondPlan,
  type ReconciliationPlan,
} from './reconciliation';

const mocks = vi.hoisted(() => {
  const generatePlans = vi.fn();
  const getPlans = vi.fn();
  const getPlan = vi.fn();
  const selectPlan = vi.fn();
  const getCommitment = vi.fn();
  const invitePartner = vi.fn();
  const pausePlan = vi.fn();
  const respondPlan = vi.fn();
  return {
    generatePlans,
    getPlans,
    getPlan,
    selectPlan,
    getCommitment,
    invitePartner,
    pausePlan,
    respondPlan,
    createM4ApiClient: vi.fn(() => ({
      reconciliation: {
        generatePlans,
        getPlans,
        getPlan,
        selectPlan,
        getCommitment,
        invitePartner,
        pausePlan,
        respondPlan,
      },
    })),
    request: { request: true },
  };
});

vi.mock('../request', () => ({
  default: mocks.request,
}));

vi.mock('@cj/api-client', () => ({
  createM4ApiClient: (...args: unknown[]) => mocks.createM4ApiClient(...args),
}));

const mockPlan: ReconciliationPlan = {
  id: 'rp1',
  judgment_id: 'j1',
  intent: 'repair',
  plan_content: JSON.stringify({
    title: '方案內容',
    description: '描述',
    steps: ['步驟1'],
    expected_effect: '效果',
    fit_reason: '適配原因',
    do_not_use_when: ['當前不適合'],
    first_step: '今天先做這件事',
    fallback_step: '改成更低壓版本',
    pause_rule: '先停一下',
  }),
  plan_type: 'activity',
  difficulty_level: 'easy',
  time_cost: 1,
  money_cost: 0,
  emotion_cost: 1,
  skill_requirement: 1,
  user1_selected: false,
  user2_selected: false,
  created_at: new Date().toISOString(),
};

describe('reconciliation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generatePlans 應返回 bundle 並傳遞方向與偏好', async () => {
    mocks.generatePlans.mockResolvedValue({
      plans: [mockPlan],
      recommended_plan_id: 'rp1',
      intent: 'repair',
      applied_preferences: { pressure_level: 'low' },
      journey_entry: { status: 'draft', track_id: null, active_plan_id: 'rp1', recommended_action: 'commit_plan', last_pulse: null, has_superseded_versions: false },
      version_summary: { version_group_id: null, has_superseded_versions: false, superseded_versions_count: 0 },
    });

    const input = {
      intent: 'repair',
      preferences: { pressure_level: 'low' },
    };
    const result = await generatePlans('j1', input);

    expect(mocks.generatePlans).toHaveBeenCalledWith('j1', input);
    expect(result.recommended_plan_id).toBe('rp1');
    expect(result.plans).toEqual([mockPlan]);
  });

  it('getPlans 應返回 bundle 並帶 intent 查詢參數', async () => {
    mocks.getPlans.mockResolvedValue({
      plans: [mockPlan],
      recommended_plan_id: 'rp1',
      intent: 'repair',
      applied_preferences: null,
      journey_entry: { status: 'draft', track_id: null, active_plan_id: 'rp1', recommended_action: 'commit_plan', last_pulse: null, has_superseded_versions: false },
      version_summary: { version_group_id: null, has_superseded_versions: false, superseded_versions_count: 0 },
    });

    const result = await getPlans('j1', { intent: 'repair', type: 'activity' });

    expect(mocks.getPlans).toHaveBeenCalledWith('j1', { intent: 'repair', type: 'activity' });
    expect(result.plans).toHaveLength(1);
    expect(result.intent).toBe('repair');
  });

  it('bundle 缺失時應沿用 shared client 的空結構', async () => {
    mocks.getPlans.mockResolvedValue({
      plans: [],
      recommended_plan_id: null,
      intent: 'repair',
      applied_preferences: null,
      journey_entry: {
        status: 'none',
        track_id: null,
        active_plan_id: null,
        recommended_action: 'generate_bundle',
        last_pulse: null,
        has_superseded_versions: false,
      },
      version_summary: {
        version_group_id: null,
        has_superseded_versions: false,
        superseded_versions_count: 0,
      },
    });
    const result = await getPlans('j1');
    expect(result).toEqual({
      plans: [],
      recommended_plan_id: null,
      intent: 'repair',
      applied_preferences: null,
      journey_entry: {
        status: 'none',
        track_id: null,
        active_plan_id: null,
        recommended_action: 'generate_bundle',
        last_pulse: null,
        has_superseded_versions: false,
      },
      version_summary: {
        version_group_id: null,
        has_superseded_versions: false,
        superseded_versions_count: 0,
      },
    });
  });

  it('getPlanById 應返回 plan', async () => {
    const planWithJudgment = { ...mockPlan, judgment: { case_id: 'c1' } };
    mocks.getPlan.mockResolvedValue(planWithJudgment);
    const result = await getPlanById('rp1');
    expect(mocks.getPlan).toHaveBeenCalledWith('rp1');
    expect(result.judgment.case_id).toBe('c1');
  });

  it('selectPlan / getCommitment / invitePartner / pausePlan / respondPlan 應處理各自回應', async () => {
    mocks.selectPlan.mockResolvedValue(mockPlan);
    mocks.getCommitment.mockResolvedValue({ track_id: 't1', track_status: 'draft', recommended_mode: 'solo', invited_partner_at: null, is_dual_committed: false, current_user: { user_id: 'u1', commitment_status: 'committed', viewed_at: null, committed_at: null }, partner: null });
    mocks.invitePartner.mockResolvedValue({ track_id: 't1', partner_id: 'u2', invited_at: 'now', status: 'partner_invited' });
    mocks.pausePlan.mockResolvedValue({ track_id: 't1', track_status: 'paused', recommended_mode: 'solo', invited_partner_at: null, is_dual_committed: false, current_user: { user_id: 'u1', commitment_status: 'paused', viewed_at: null, committed_at: null }, partner: null });
    mocks.respondPlan.mockResolvedValue({ ...mockPlan, id: 'rp2' });

    const selected = await selectPlan('rp1');
    const commitment = await getCommitment('rp1');
    const invitation = await invitePartner('rp1');
    const paused = await pausePlan('rp1');
    const responded = await respondPlan('rp1', 'viewed');

    expect(selected.id).toBe('rp1');
    expect(commitment.track_id).toBe('t1');
    expect(invitation.status).toBe('partner_invited');
    expect(paused.track_status).toBe('paused');
    expect(responded.id).toBe('rp2');
    expect(mocks.selectPlan).toHaveBeenCalledWith('rp1');
    expect(mocks.getCommitment).toHaveBeenCalledWith('rp1');
    expect(mocks.invitePartner).toHaveBeenCalledWith('rp1');
    expect(mocks.pausePlan).toHaveBeenCalledWith('rp1');
    expect(mocks.respondPlan).toHaveBeenCalledWith('rp1', 'viewed', undefined);
  });
});
