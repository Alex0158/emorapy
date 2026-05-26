/**
 * 修復旅程 API 單元測試
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkin,
  confirmExecution,
  getAllExecutionStatuses,
  getExecutionStatus,
  replanTrack,
  resumeTrack,
  type ExecutionRecord,
  type ExecutionStatus,
} from './execution';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  checkin: vi.fn(),
  getStatus: vi.fn(),
  getDashboard: vi.fn(),
  replanTrack: vi.fn(),
  resumeTrack: vi.fn(),
  createM4ApiClient: vi.fn(() => ({
    execution: {
      confirm: mocks.confirm,
      checkin: mocks.checkin,
      getStatus: mocks.getStatus,
      getDashboard: mocks.getDashboard,
      replanTrack: mocks.replanTrack,
      resumeTrack: mocks.resumeTrack,
    },
  })),
}));

vi.mock('@cj/api-client', () => ({
  createM4ApiClient: (...args: unknown[]) => mocks.createM4ApiClient(...args),
}));

vi.mock('../request', () => ({
  default: { requestName: 'web-request-adapter' },
}));

describe('execution API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createM4ApiClient.mockReturnValue({
      execution: {
        confirm: mocks.confirm,
        checkin: mocks.checkin,
        getStatus: mocks.getStatus,
        getDashboard: mocks.getDashboard,
        replanTrack: mocks.replanTrack,
        resumeTrack: mocks.resumeTrack,
      },
    });
  });

  it('getAllExecutionStatuses 應正規化 recent_checkins 與 records', async () => {
    const executions: ExecutionStatus[] = [
      {
        plan_id: 'p1',
        judgment_id: 'j1',
        status: 'in_progress',
        journey_status: 'solo_active',
        relationship_mode: 'solo',
        records: null as unknown as ExecutionRecord[],
        recent_checkins: null as unknown as ExecutionStatus['recent_checkins'],
        progress: 50,
      },
    ];
    mocks.getDashboard.mockResolvedValue([
      {
        ...executions[0],
        records: [],
        recent_checkins: [],
      },
    ]);
    const result = await getAllExecutionStatuses();
    expect(mocks.getDashboard).toHaveBeenCalledTimes(1);
    expect(result[0].records).toEqual([]);
    expect(result[0].recent_checkins).toEqual([]);
  });

  it('getExecutionStatus 應返回新旅程形狀', async () => {
    mocks.getStatus.mockResolvedValue({
      plan_id: 'p1',
      judgment_id: 'j1',
      status: 'in_progress',
      journey_status: 'solo_active',
      relationship_mode: 'solo',
      progress: 25,
      records: [],
      recent_checkins: [],
      current_step: { step_index: 0, title: '今天的一小步', content: '先做這件事' },
      pulse_summary: { closeness: 'same', stress: 'medium', needs_replan: false, needs_help: false },
    });
    const result = await getExecutionStatus('p1');
    expect(mocks.getStatus).toHaveBeenCalledWith('p1');
    expect(result.current_step?.content).toBe('先做這件事');
    expect(result.pulse_summary?.needs_replan).toBe(false);
  });

  it('confirmExecution 應 POST /execution/confirm', async () => {
    const execution: ExecutionRecord = {
      id: 'e1',
      reconciliation_plan_id: 'p1',
      user_id: 'u1',
      action: 'confirm',
      status: 'in_progress',
      photos_urls: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mocks.confirm.mockResolvedValue(execution);
    const result = await confirmExecution('p1');
    expect(mocks.confirm).toHaveBeenCalledWith('p1');
    expect(result.action).toBe('confirm');
  });

  it('checkin 應把每日脈搏一起送出', async () => {
    const execution: ExecutionRecord = {
      id: 'e2',
      reconciliation_plan_id: 'p1',
      user_id: 'u1',
      action: 'checkin',
      status: 'in_progress',
      photos_urls: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mocks.checkin.mockResolvedValue(execution);

    await checkin({
      plan_id: 'p1',
      step_result: 'partial',
      closeness: 'same',
      stress: 'high',
      needs_help: true,
      notes: '今天卡住了',
    });

    expect(mocks.checkin).toHaveBeenCalledWith({
      plan_id: 'p1',
      step_result: 'partial',
      closeness: 'same',
      stress: 'high',
      needs_help: true,
      notes: '今天卡住了',
    });
  });

  it('replanTrack / resumeTrack 應命中 repair-tracks 接口', async () => {
    mocks.replanTrack.mockResolvedValue({ track_id: 't1', plan_id: 'p2', status: 'solo_active' });
    mocks.resumeTrack.mockResolvedValue({ track_id: 't1', plan_id: 'p2', status: 'solo_active' });

    const replanned = await replanTrack('t1', { mode: 'lower_pressure', reason: 'manual' });
    const resumed = await resumeTrack('t1');

    expect(mocks.replanTrack).toHaveBeenCalledWith('t1', { mode: 'lower_pressure', reason: 'manual' });
    expect(mocks.resumeTrack).toHaveBeenCalledWith('t1');
    expect(replanned.plan_id).toBe('p2');
    expect(resumed.track_id).toBe('t1');
  });

});
