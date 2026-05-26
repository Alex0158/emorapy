import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createM2ApiClient } from '../dist/index.js';

function ok(data) {
  return { data: { success: true, data } };
}

function fail(code, message) {
  return { data: { success: false, error: { code, message } } };
}

class FakeHttp {
  calls = [];
  responses = [];

  queue(response) {
    this.responses.push(response);
  }

  next(method, url, data) {
    this.calls.push({ method, url, data });
    const response = this.responses.shift();
    if (!response) throw new Error(`Missing fake response for ${method} ${url}`);
    return Promise.resolve(response);
  }

  delete(url) {
    return this.next('delete', url);
  }

  get(url) {
    return this.next('get', url);
  }

  post(url, data) {
    return this.next('post', url, data);
  }

  put(url, data) {
    return this.next('put', url, data);
  }
}

describe('M2 API client', () => {
  it('reads and upserts user profile through envelope payloads', async () => {
    const http = new FakeHttp();
    const api = createM2ApiClient(http);
    http.queue(ok({ profile: { id: 'profile-1', occupation: 'designer' } }));
    http.queue(ok({ profile: { id: 'profile-1', occupation: 'engineer' } }));

    assert.deepEqual(await api.profile.getUserProfile(), { id: 'profile-1', occupation: 'designer' });
    assert.deepEqual(await api.profile.upsertUserProfile({ occupation: 'engineer' }), {
      id: 'profile-1',
      occupation: 'engineer',
    });
    assert.deepEqual(http.calls, [
      { method: 'get', url: '/profile/me', data: undefined },
      { method: 'put', url: '/profile/me', data: { occupation: 'engineer' } },
    ]);
  });

  it('handles psych profile consent, feedback history, and deletion', async () => {
    const http = new FakeHttp();
    const api = createM2ApiClient(http);
    http.queue(ok({ consent_given: false, narratives: [], insights: [], richness_score: 0 }));
    http.queue(ok({ history: [{ session_id: 's1', feedback_card: 'done', domains_touched: [], created_at: 'a', updated_at: 'b' }] }));
    http.queue(ok(undefined));
    http.queue(ok(undefined));

    assert.equal((await api.psychProfile.getProfile()).consent_given, false);
    assert.equal((await api.psychProfile.getFeedbackHistory()).history[0].session_id, 's1');
    await api.psychProfile.giveConsent();
    await api.psychProfile.deleteAllData();
    assert.deepEqual(http.calls.map((call) => `${call.method} ${call.url}`), [
      'get /psych-profile',
      'get /psych-profile/feedback',
      'post /psych-profile/consent',
      'delete /psych-profile',
    ]);
  });

  it('starts, resumes, reads, responds, skips, cancels, ends, and retries interview sessions', async () => {
    const http = new FakeHttp();
    const api = createM2ApiClient(http);
    const session = {
      id: 'interview-1',
      user_id: 'user-1',
      status: 'in_progress',
      trigger: 'organic',
      total_user_words: 0,
      domains_touched: [],
      pipeline_step: 0,
      created_at: 'now',
      updated_at: 'now',
    };
    http.queue(ok(session));
    http.queue(ok({ has_pending: true, session_id: 'interview-1' }));
    http.queue(ok({ ...session, turns: [] }));
    http.queue(ok({ accepted: true, session_id: 'interview-1' }));
    http.queue(ok({ accepted: true, session_id: 'interview-1' }));
    http.queue(ok({ cancelled: true, session_id: 'interview-1' }));
    http.queue(ok(undefined));
    http.queue(ok(undefined));

    assert.equal((await api.interview.startSession('onboarding')).id, 'interview-1');
    assert.equal((await api.interview.checkResume())?.session_id, 'interview-1');
    assert.equal((await api.interview.getSession('interview-1')).id, 'interview-1');
    assert.equal((await api.interview.respond('interview-1', 'hello')).accepted, true);
    assert.equal((await api.interview.skip('interview-1')).accepted, true);
    assert.equal((await api.interview.cancel('interview-1')).cancelled, true);
    await api.interview.endSession('interview-1');
    await api.interview.retryFailed('interview-1');

    assert.deepEqual(http.calls.map((call) => `${call.method} ${call.url}`), [
      'post /interview/start',
      'get /interview/resume',
      'get /interview/interview-1',
      'post /interview/interview-1/respond',
      'post /interview/interview-1/skip',
      'post /interview/interview-1/cancel',
      'post /interview/interview-1/end',
      'post /interview/interview-1/retry',
    ]);
  });

  it('normalizes failed envelopes', async () => {
    const http = new FakeHttp();
    const api = createM2ApiClient(http);
    http.queue(fail('CONSENT_REQUIRED', '需要先同意'));

    await assert.rejects(() => api.psychProfile.getProfile(), {
      code: 'CONSENT_REQUIRED',
      message: '需要先同意',
    });
  });
});
