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

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('execution API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mockGet.mockResolvedValue({ data: { data: { executions } } });
    const result = await getAllExecutionStatuses();
    expect(mockGet).toHaveBeenCalledWith('/execution/dashboard');
    expect(result[0].records).toEqual([]);
    expect(result[0].recent_checkins).toEqual([]);
  });

  it('getExecutionStatus 應返回新旅程形狀', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
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
        },
      },
    });
    const result = await getExecutionStatus('p1');
    expect(mockGet).toHaveBeenCalledWith('/execution/status', { params: { plan_id: 'p1' } });
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
    mockPost.mockResolvedValue({ data: { data: { execution } } });
    const result = await confirmExecution('p1');
    expect(mockPost).toHaveBeenCalledWith('/execution/confirm', { plan_id: 'p1' });
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
    mockPost.mockResolvedValue({ data: { data: { execution } } });

    await checkin({
      plan_id: 'p1',
      step_result: 'partial',
      closeness: 'same',
      stress: 'high',
      needs_help: true,
      notes: '今天卡住了',
    });

    expect(mockPost).toHaveBeenCalledWith('/execution/checkin', {
      plan_id: 'p1',
      step_result: 'partial',
      closeness: 'same',
      stress: 'high',
      needs_help: true,
      notes: '今天卡住了',
    });
  });

  it('replanTrack / resumeTrack 應命中 repair-tracks 接口', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { data: { track: { track_id: 't1', plan_id: 'p2', status: 'solo_active' } } } })
      .mockResolvedValueOnce({ data: { data: { track: { track_id: 't1', plan_id: 'p2', status: 'solo_active' } } } });

    const replanned = await replanTrack('t1', { mode: 'lower_pressure', reason: 'manual' });
    const resumed = await resumeTrack('t1');

    expect(mockPost).toHaveBeenNthCalledWith(1, '/repair-tracks/t1/replan', { mode: 'lower_pressure', reason: 'manual' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/repair-tracks/t1/resume');
    expect(replanned.plan_id).toBe('p2');
    expect(resumed.track_id).toBe('t1');
  });
});
