import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createM5ApiClient } from '../dist/index.js';

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

const mockNotification = {
  id: '6c2b5a36-4c37-4309-965e-4464c8a7d8d1',
  channel: 'push',
  template_code: 'repair.checkin',
  action_key: 'continue_today_step',
  priority: 'soon',
  group_key: 'repair-track-1',
  status: 'sent',
  error_message: null,
  created_at: '2026-05-08T00:00:00.000Z',
  sent_at: '2026-05-08T00:00:00.000Z',
  read_at: null,
  dismissed_at: null,
  acted_at: null,
  snoozed_until: null,
  unread: true,
  actionable: true,
  payload: {},
  journey_context: null,
  render_payload: {
    title: '今天的一小步',
    body: '回到修復旅程',
    path: '/execution/plan-1/checkin',
    cta_label: '開始',
    entity_type: 'repair_track',
    entity_id: 'track-1',
    journey_status: 'solo_active',
    track_id: 'track-1',
    plan_id: 'plan-1',
    judgment_id: 'judgment-1',
    case_id: 'case-1',
    priority: 'soon',
    partner_state: null,
    reason_code: null,
  },
};

describe('M5 notifications / media API client', () => {
  it('lists notifications and normalizes missing list fields', async () => {
    const http = createHttpMock();
    const m5 = createM5ApiClient(http);
    http.enqueue(success({ notifications: [mockNotification], next_cursor: 'cursor-1', has_more: true }));
    http.enqueue(success({ notifications: null }));

    const list = await m5.notifications.list({ state: 'actionable', limit: 20 });
    const empty = await m5.notifications.list({ state: 'unread' });

    assert.equal(list.notifications.length, 1);
    assert.equal(list.next_cursor, 'cursor-1');
    assert.equal(list.has_more, true);
    assert.deepEqual(empty, { notifications: [], next_cursor: null, has_more: false });
    assert.deepEqual(http.calls.map((call) => [call.method, call.url]), [
      ['get', '/notifications'],
      ['get', '/notifications'],
    ]);
    assert.deepEqual(http.calls[0].config, { params: { state: 'actionable', limit: 20 } });
  });

  it('handles read, snooze, dismiss, and act notification actions', async () => {
    const http = createHttpMock();
    const m5 = createM5ApiClient(http);
    http.enqueue(success({ unread_count: 3 }));
    http.enqueue(success({ notification: { ...mockNotification, read_at: 'now' } }));
    http.enqueue(success({ updatedCount: 2, readAt: '2026-05-08T00:00:00.000Z' }));
    http.enqueue(success({ notification: { ...mockNotification, snoozed_until: 'later' } }));
    http.enqueue(success({ notification: { ...mockNotification, dismissed_at: 'now' } }));
    http.enqueue(success({
      notification: { ...mockNotification, acted_at: 'now' },
      target: { path: '/execution/plan-1/checkin', action_key: 'continue_today_step', entity_type: 'repair_track', entity_id: 'track-1' },
    }));

    assert.equal(await m5.notifications.unreadCount(), 3);
    assert.equal((await m5.notifications.markRead(mockNotification.id)).read_at, 'now');
    assert.equal((await m5.notifications.markAllRead()).updatedCount, 2);
    assert.equal((await m5.notifications.snooze(mockNotification.id, 24)).snoozed_until, 'later');
    assert.equal((await m5.notifications.dismiss(mockNotification.id)).dismissed_at, 'now');
    assert.equal((await m5.notifications.act(mockNotification.id, 'continue_today_step')).target.path, '/execution/plan-1/checkin');

    assert.deepEqual(http.calls.map((call) => [call.method, call.url]), [
      ['get', '/notifications/unread-count'],
      ['post', `/notifications/${mockNotification.id}/read`],
      ['post', '/notifications/read-all'],
      ['post', `/notifications/${mockNotification.id}/snooze`],
      ['post', `/notifications/${mockNotification.id}/dismiss`],
      ['post', `/notifications/${mockNotification.id}/act`],
    ]);
  });

  it('registers and revokes push device tokens', async () => {
    const http = createHttpMock();
    const m5 = createM5ApiClient(http);
    http.enqueue(success({
      device_token: {
        id: 'pdt-1',
        user_id: 'user-1',
        platform: 'ios',
        device_id: 'device-1',
        app_version: '1.3.1',
        build_number: '1',
        revoked_at: null,
        last_seen_at: '2026-05-08T00:00:00.000Z',
        created_at: '2026-05-08T00:00:00.000Z',
        updated_at: '2026-05-08T00:00:00.000Z',
      },
    }));
    http.enqueue(success({ revokedCount: 1, revokedAt: '2026-05-08T00:00:00.000Z' }));

    const registered = await m5.notifications.registerDeviceToken({
      token: 'ExpoPushToken[test]',
      platform: 'ios',
      device_id: 'device-1',
      app_version: '1.3.1',
      build_number: '1',
    });
    const revoked = await m5.notifications.revokeDeviceToken({ token: 'ExpoPushToken[test]' });

    assert.equal(registered.id, 'pdt-1');
    assert.equal(revoked.revokedCount, 1);
    assert.deepEqual(http.calls.map((call) => [call.method, call.url]), [
      ['post', '/notifications/device-tokens'],
      ['post', '/notifications/device-tokens/revoke'],
    ]);
  });

  it('uploads and deletes case evidence through the shared media API', async () => {
    const http = createHttpMock();
    const m5 = createM5ApiClient(http);
    const formData = new FormData();
    http.enqueue(success({ evidences: [{ id: 'e1', case_id: 'case-1', file_url: 'https://cdn.test/e1.jpg', file_type: 'image', file_size: 123, created_at: 'now' }] }));
    http.enqueue(success({ evidences: { items: [] } }));
    http.enqueue(success({ deleted: true }));

    const uploaded = await m5.media.uploadEvidence('case/1', formData, 'session-1');
    const normalized = await m5.media.uploadEvidence('case-2', formData);
    await m5.media.deleteEvidence('case/1', 'evidence/1', 'session-1');

    assert.equal(uploaded[0].id, 'e1');
    assert.deepEqual(normalized, []);
    assert.equal(http.calls[0].url, '/cases/case%2F1/evidence');
    assert.equal(http.calls[0].data, formData);
    assert.deepEqual(http.calls[0].config, { headers: { 'X-Session-Id': 'session-1' } });
    assert.equal(http.calls[1].url, '/cases/case-2/evidence');
    assert.equal(http.calls[1].config, undefined);
    assert.equal(http.calls[2].url, '/cases/case%2F1/evidence/evidence%2F1');
  });

  it('rejects empty evidence upload payloads', async () => {
    const http = createHttpMock();
    const m5 = createM5ApiClient(http);
    http.enqueue(success({ evidences: null }));

    await assert.rejects(
      () => m5.media.uploadEvidence('case-1', new FormData()),
      (error) => error.code === 'INVALID_EVIDENCE_RESPONSE' && error.message === 'Invalid evidence response from server'
    );
  });

  it('normalizes failed envelopes', async () => {
    const http = createHttpMock();
    const m5 = createM5ApiClient(http);
    http.enqueue(fail('FORBIDDEN', 'no access'));

    await assert.rejects(
      () => m5.notifications.list(),
      (error) => error.code === 'FORBIDDEN' && error.message === 'no access'
    );
  });
});
