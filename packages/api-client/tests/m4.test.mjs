import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createM4ApiClient } from '../dist/index.js';

function success(data) {
  return { data: { success: true, data } };
}

function fail(code, message) {
  return { data: { success: false, error: { code, message } } };
}

function createHttpMock() {
  const calls = [];
  const queue = [];
  return {
    calls,
    enqueue(response) {
      queue.push(response);
    },
    async get(url, config) {
      calls.push({ method: 'get', url, config });
      return queue.shift();
    },
    async post(url, data, config) {
      calls.push({ method: 'post', url, data, config });
      return queue.shift();
    },
    async put(url, data, config) {
      calls.push({ method: 'put', url, data, config });
      return queue.shift();
    },
    async delete(url, config) {
      calls.push({ method: 'delete', url, config });
      return queue.shift();
    },
  };
}

const mockCase = {
  id: 'case-1',
  pairing_id: 'pair-1',
  title: '正式案件',
  type: '其他衝突',
  plaintiff_statement: 'A statement',
  status: 'draft',
  mode: 'remote',
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
};

const mockJudgment = {
  id: 'judgment-1',
  case_id: 'case-1',
  judgment_content: '# result',
  plaintiff_ratio: 60,
  defendant_ratio: 40,
  ai_model: 'mock',
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
};

describe('M4 formal case / repair API client', () => {
  it('handles pairing lifecycle', async () => {
    const http = createHttpMock();
    const m4 = createM4ApiClient(http);
    http.enqueue(success({ pairing: { id: 'pair-1', invite_code: 'ABC', status: 'pending' } }));
    http.enqueue(success({ pairing: { id: 'pair-1', status: 'active' } }));
    http.enqueue(success({ pairing: null }));
    http.enqueue(success({ pairing: { id: 'pair-1', status: 'cancelled' } }));

    assert.equal((await m4.pairing.create()).invite_code, 'ABC');
    assert.equal((await m4.pairing.join('ABC')).status, 'active');
    assert.equal(await m4.pairing.getStatus(), null);
    assert.equal((await m4.pairing.cancel()).status, 'cancelled');
    assert.deepEqual(http.calls.map((call) => [call.method, call.url]), [
      ['post', '/pairing/create'],
      ['post', '/pairing/join'],
      ['get', '/pairing/status'],
      ['post', '/pairing/cancel'],
    ]);
  });

  it('creates, lists, updates, submits, and reads formal cases', async () => {
    const http = createHttpMock();
    const m4 = createM4ApiClient(http);
    http.enqueue(success({ case: mockCase }));
    http.enqueue(success({ cases: [mockCase], pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 } }));
    http.enqueue(success({ case: mockCase }));
    http.enqueue(success({ case: { ...mockCase, title: '更新' } }));
    http.enqueue(success({ case: { ...mockCase, status: 'submitted' } }));

    await m4.cases.create({ pairing_id: 'pair-1', plaintiff_statement: 'A' });
    const list = await m4.cases.list({ status: 'draft' });
    await m4.cases.get('case-1');
    const updated = await m4.cases.update('case-1', { title: '更新' });
    const submitted = await m4.cases.submit('case-1');

    assert.equal(list.cases.length, 1);
    assert.equal(updated.title, '更新');
    assert.equal(submitted.status, 'submitted');
    assert.deepEqual(http.calls.map((call) => [call.method, call.url]), [
      ['post', '/cases'],
      ['get', '/cases'],
      ['get', '/cases/case-1'],
      ['put', '/cases/case-1'],
      ['post', '/cases/case-1/submit'],
    ]);
  });

  it('generates, reads, and accepts judgments', async () => {
    const http = createHttpMock();
    const m4 = createM4ApiClient(http);
    http.enqueue(success({ judgment: mockJudgment }));
    http.enqueue(success({ judgment: mockJudgment }));
    http.enqueue(success({ judgment: null }));
    http.enqueue(success({ judgment: { ...mockJudgment, user1_acceptance: true } }));

    assert.equal((await m4.judgment.generate('case-1', 'guest-1')).id, 'judgment-1');
    assert.equal((await m4.judgment.get('judgment-1')).case_id, 'case-1');
    assert.equal(await m4.judgment.getByCaseId('case-1', 'guest-1'), null);
    assert.equal((await m4.judgment.accept('judgment-1', { accepted: true, rating: 5 })).user1_acceptance, true);
    assert.deepEqual(http.calls.map((call) => [call.method, call.url]), [
      ['post', '/judgments/generate/case-1'],
      ['get', '/judgments/judgment-1'],
      ['get', '/cases/case-1/judgment'],
      ['post', '/judgments/judgment-1/accept'],
    ]);
    assert.equal(http.calls[0].config.headers['X-Session-Id'], 'guest-1');
    assert.equal(http.calls[2].config.headers['X-Session-Id'], 'guest-1');
    assert.deepEqual(http.calls[2].config.metadata, { suppressGlobalSessionToast: true });
  });

  it('handles reconciliation plans and commitments', async () => {
    const http = createHttpMock();
    const m4 = createM4ApiClient(http);
    const plan = {
      id: 'plan-1',
      judgment_id: 'judgment-1',
      intent: 'repair',
      plan_content: 'plan',
      plan_type: 'activity',
      difficulty_level: 'easy',
      time_cost: 1,
      money_cost: 1,
      emotion_cost: 1,
      skill_requirement: 1,
      user1_selected: false,
      user2_selected: false,
      created_at: '2026-05-08T00:00:00.000Z',
    };
    const bundle = { plans: [plan], recommended_plan_id: 'plan-1', intent: 'repair' };
    http.enqueue(success(bundle));
    http.enqueue(success(bundle));
    http.enqueue(success({ plan: { ...plan, judgment: { case_id: 'case-1' } } }));
    http.enqueue(success({ plan: { ...plan, user1_selected: true } }));
    http.enqueue(success({ commitment: { track_id: 'track-1', track_status: 'active', recommended_mode: 'solo', invited_partner_at: null, is_dual_committed: false, current_user: {}, partner: null } }));
    http.enqueue(success({ invitation: { track_id: 'track-1', partner_id: null, invited_at: 'now', status: 'invited' } }));
    http.enqueue(success({}));

    assert.equal((await m4.reconciliation.generatePlans('judgment-1')).plans.length, 1);
    assert.equal((await m4.reconciliation.getPlans('judgment-1', { intent: 'repair' })).recommended_plan_id, 'plan-1');
    assert.equal((await m4.reconciliation.getPlan('plan-1')).judgment?.case_id, 'case-1');
    assert.equal((await m4.reconciliation.selectPlan('plan-1')).user1_selected, true);
    assert.equal((await m4.reconciliation.getCommitment('plan-1')).track_id, 'track-1');
    assert.equal((await m4.reconciliation.invitePartner('plan-1')).status, 'invited');
    assert.deepEqual(await m4.reconciliation.getPlans('judgment-empty'), {
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

  it('normalizes execution dashboard and sends checkins', async () => {
    const http = createHttpMock();
    const m4 = createM4ApiClient(http);
    const execution = {
      id: 'execution-1',
      reconciliation_plan_id: 'plan-1',
      user_id: 'user-1',
      action: 'checkin',
      status: 'completed',
      photos_urls: [],
      created_at: '2026-05-08T00:00:00.000Z',
      updated_at: '2026-05-08T00:00:00.000Z',
    };
    const status = {
      plan_id: 'plan-1',
      status: 'in_progress',
      journey_status: 'active',
      relationship_mode: 'solo',
      records: undefined,
      recent_checkins: undefined,
      progress: 0,
    };
    http.enqueue(success({ executions: [status] }));
    http.enqueue(success(status));
    http.enqueue(success({ execution }));
    http.enqueue(success({ execution: { ...execution, action: 'confirm' } }));
    http.enqueue(success({ track: { track_id: 'track-1', status: 'replanning', accepted: true, stream_scope: 'repair_track', scope_id: 'track-1', stream_id: 'stream-1', request_id: 'req-1' } }));
    http.enqueue(success({ track: { track_id: 'track-1', plan_id: 'plan-1', status: 'active' } }));

    assert.deepEqual((await m4.execution.getDashboard())[0].records, []);
    assert.deepEqual((await m4.execution.getStatus('plan-1')).recent_checkins, []);
    assert.equal((await m4.execution.checkin({ plan_id: 'plan-1', step_result: 'done' })).status, 'completed');
    assert.equal((await m4.execution.confirm('plan-1')).action, 'confirm');
    assert.equal((await m4.execution.replanTrack('track-1', { mode: 'lower_pressure', reason: 'manual' })).accepted, true);
    assert.equal((await m4.execution.resumeTrack('track-1')).status, 'active');
  });

  it('normalizes failed envelopes', async () => {
    const http = createHttpMock();
    const m4 = createM4ApiClient(http);
    http.enqueue(fail('FORBIDDEN', 'no access'));

    await assert.rejects(
      () => m4.cases.list(),
      (error) => error.code === 'FORBIDDEN' && error.message === 'no access'
    );
  });
});
