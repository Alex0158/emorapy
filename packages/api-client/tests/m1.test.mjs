import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createM1ApiClient } from '../dist/index.js';

function createMockHttp(handlers) {
  const calls = [];
  return {
    calls,
    async get(url, config) {
      calls.push({ method: 'GET', url, config });
      const handler = handlers[`GET ${url}`];
      if (!handler) throw new Error(`Missing handler: GET ${url}`);
      return { data: await handler(undefined, config) };
    },
    async post(url, data, config) {
      calls.push({ method: 'POST', url, data, config });
      const handler = handlers[`POST ${url}`];
      if (!handler) throw new Error(`Missing handler: POST ${url}`);
      return { data: await handler(data, config) };
    },
  };
}

function ok(data) {
  return { success: true, data };
}

function fail(code, message, details) {
  return { success: false, error: { code, message, details } };
}

describe('M1 API client', () => {
  it('creates and refreshes quick sessions with explicit session header', async () => {
    const http = createMockHttp({
      'POST /sessions/quick': () => ok({ session_id: 'guest_1', expires_at: '2026-05-09T00:00:00.000Z' }),
      'POST /sessions/refresh': (_data, config) => {
        assert.equal(config.headers['X-Session-Id'], 'guest_1');
        return ok({ session_id: 'guest_2', expires_at: '2026-05-09T00:00:00.000Z' });
      },
    });
    const client = createM1ApiClient(http);

    assert.equal((await client.session.createQuickSession()).session_id, 'guest_1');
    assert.equal((await client.session.refreshQuickSession('guest_1')).session_id, 'guest_2');
  });

  it('submits quick case and reads case by id or session', async () => {
    const casePayload = {
      id: 'case_1',
      pairing_id: 'pairing_1',
      title: '快速整理',
      type: '其他衝突',
      plaintiff_statement: 'A'.repeat(30),
      defendant_statement: 'B'.repeat(30),
      status: 'submitted',
      mode: 'quick',
      created_at: '2026-05-08T00:00:00.000Z',
      updated_at: '2026-05-08T00:00:00.000Z',
    };
    const http = createMockHttp({
      'POST /cases/quick': (data) => {
        assert.equal(data.plaintiff_statement, 'A'.repeat(30));
        return ok({ case: casePayload, session_id: 'guest_1', session_expires_at: '2026-05-09T00:00:00.000Z' });
      },
      'GET /cases/case_1': (_data, config) => {
        assert.equal(config.headers['X-Session-Id'], 'guest_1');
        return ok({ case: casePayload });
      },
      'GET /cases/by-session': (_data, config) => {
        assert.equal(config.headers['X-Session-Id'], 'guest_1');
        return ok({ case: casePayload });
      },
    });
    const client = createM1ApiClient(http);

    const quick = await client.quick.createQuickCase({
      plaintiff_statement: 'A'.repeat(30),
      defendant_statement: 'B'.repeat(30),
    });
    assert.equal(quick.case.id, 'case_1');
    assert.equal((await client.quick.getCase('case_1', 'guest_1')).id, 'case_1');
    assert.equal((await client.quick.getCaseBySessionId('guest_1')).id, 'case_1');
  });

  it('handles collaborative quick cases and missing session-bound case', async () => {
    const casePayload = {
      id: 'case_2',
      pairing_id: 'pairing_1',
      title: '協作整理',
      type: '其他衝突',
      plaintiff_statement: 'A'.repeat(30),
      defendant_statement: 'B'.repeat(30),
      status: 'submitted',
      mode: 'quick',
      created_at: '2026-05-08T00:00:00.000Z',
      updated_at: '2026-05-08T00:00:00.000Z',
    };
    const http = createMockHttp({
      'POST /cases/collaborative': (data, config) => {
        assert.equal(data.case_id, 'case_2');
        assert.equal(config.headers['X-Session-Id'], 'guest_1');
        return ok({
          case: casePayload,
          session_id: 'guest_1',
          session_expires_at: '2026-05-09T00:00:00.000Z',
          phase: 'submitted',
        });
      },
      'GET /cases/by-session': () => fail('NOT_FOUND', 'Case not found'),
    });
    const client = createM1ApiClient(http);

    const collaborative = await client.quick.createCollaborativeCase(
      { case_id: 'case_2', defendant_statement: 'B'.repeat(30) },
      'guest_1'
    );

    assert.equal(collaborative.case.id, 'case_2');
    assert.equal(collaborative.phase, 'submitted');
    assert.equal(await client.quick.getCaseBySessionId('guest_missing'), null);
  });

  it('logs in, registers, and claims session through auth API', async () => {
    const auth = {
      token: 'jwt',
      user: { id: 'user_1', email: 'user@example.com', email_verified: true },
    };
    const http = createMockHttp({
      'POST /auth/login': (data) => {
        assert.equal(data.email, 'user@example.com');
        return ok(auth);
      },
      'POST /auth/register': (data) => {
        assert.equal(data.nickname, 'Alex');
        assert.equal(data.registration_proof, 'rp1_registration-proof');
        return ok(auth);
      },
      'POST /auth/claim-session': (data) => {
        assert.equal(data.session_id, 'guest_1');
        return ok({ case_id: 'case_1' });
      },
    });
    const client = createM1ApiClient(http);

    assert.equal((await client.auth.login({ email: 'user@example.com', password: 'Password123' })).token, 'jwt');
    assert.equal((await client.auth.register({
      email: 'user@example.com',
      password: 'Password123',
      registration_proof: 'rp1_registration-proof',
      nickname: 'Alex',
    })).user.id, 'user_1');
    assert.equal((await client.auth.claimSession('guest_1')).case_id, 'case_1');
  });

  it('handles auth verification and password reset endpoints', async () => {
    const http = createMockHttp({
      'POST /auth/send-verification-code': (data) => {
        assert.deepEqual(data, { email: 'user@example.com', type: 'register' });
        return ok({ expires_in: 300, resend_after: 60 });
      },
      'POST /auth/verify-email': (data) => {
        if (data.type === 'register') {
          assert.deepEqual(data, { email: 'user@example.com', code: '654321', type: 'register' });
          return ok({
            verified: true,
            registration_proof: 'rp1_registration-proof',
            registration_proof_expires_in: 600,
          });
        }
        assert.deepEqual(data, { email: 'user@example.com', code: '123456', type: 'verify_email' });
        return ok({ verified: true });
      },
      'POST /auth/reset-password': (data) => {
        assert.deepEqual(data, { email: 'user@example.com' });
        return ok(null);
      },
      'POST /auth/reset-password-confirm': (data) => {
        assert.deepEqual(data, {
          email: 'user@example.com',
          code: '123456',
          new_password: 'Password456',
        });
        return ok(null);
      },
    });
    const client = createM1ApiClient(http);

    assert.deepEqual(
      await client.auth.sendVerificationCode('user@example.com', 'register'),
      { expires_in: 300, resend_after: 60 }
    );
    assert.deepEqual(
      await client.auth.verifyRegistrationCode('user@example.com', '654321'),
      {
        verified: true,
        registration_proof: 'rp1_registration-proof',
        registration_proof_expires_in: 600,
      }
    );
    assert.equal(await client.auth.verifyEmail('user@example.com', '123456'), true);
    await client.auth.resetPassword('user@example.com');
    await client.auth.confirmResetPassword('user@example.com', '123456', 'Password456');
  });

  it('normalizes auth claim and verify-email empty payloads', async () => {
    const http = createMockHttp({
      'POST /auth/claim-session': () => ok({ case_id: undefined }),
      'POST /auth/verify-email': () => ok({}),
    });
    const client = createM1ApiClient(http);

    assert.deepEqual(await client.auth.claimSession('guest_1'), { case_id: null });
    assert.equal(await client.auth.verifyEmail('user@example.com', '000000'), false);
  });

  it('normalizes API envelope failure and invalid success payloads', async () => {
    const http = createMockHttp({
      'POST /auth/login': () => fail('VALIDATION_ERROR', 'Invalid input', { field: 'email' }),
      'POST /auth/register': () => ok({ token: null, user: null }),
    });
    const client = createM1ApiClient(http);

    await assert.rejects(
      () => client.auth.login({ email: 'bad', password: '' }),
      (error) => error.code === 'VALIDATION_ERROR' && error.message === 'Invalid input'
    );
    await assert.rejects(
      () => client.auth.register({
        email: 'user@example.com',
        password: 'Password123',
        registration_proof: 'rp1_registration-proof',
      }),
      (error) => error.code === 'INVALID_AUTH_RESPONSE'
    );
  });

  it('rejects registration verification responses without an opaque proof', async () => {
    const http = createMockHttp({
      'POST /auth/verify-email': () => ok({ verified: true }),
    });
    const client = createM1ApiClient(http);

    await assert.rejects(
      () => client.auth.verifyRegistrationCode('user@example.com', '123456'),
      (error) => error.code === 'INVALID_REGISTRATION_VERIFICATION_RESPONSE'
    );
  });

  it('rejects invalid verification delivery cooldown responses', async () => {
    const http = createMockHttp({
      'POST /auth/send-verification-code': () => ok({ expires_in: 300, resend_after: 301 }),
    });
    const client = createM1ApiClient(http);

    await assert.rejects(
      () => client.auth.sendVerificationCode('user@example.com', 'register'),
      (error) => error.code === 'INVALID_VERIFICATION_CODE_DELIVERY_RESPONSE'
    );
  });
});
