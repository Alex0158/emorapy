import crypto from 'crypto';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  AuthChallengeService,
  type AuthChallengeDependencies,
} from '../../../src/services/auth-challenge.service';

const OTP_PEPPER = 'test-otp-pepper-with-at-least-32-characters';
const NOW = new Date('2026-07-13T12:00:00.000Z');

function digestCode(id: string, email: string, type: string, code: string): string {
  return crypto
    .createHmac('sha256', OTP_PEPPER)
    .update(`v1\0${id}\0${type}\0${email}\0${code}`)
    .digest('hex');
}

function challenge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'challenge-1',
    email: 'user@example.com',
    type: 'register',
    code_digest: digestCode('challenge-1', 'user@example.com', 'register', '123456'),
    source: 'provider',
    delivery_status: 'provider_accepted',
    attempt_count: 0,
    expires_at: new Date(NOW.getTime() + 5 * 60 * 1000),
    provider_accepted_at: new Date(NOW.getTime() - 1000),
    delivery_failed_at: null,
    provider_message_id_digest: null,
    verified_at: null,
    consumed_at: null,
    invalidated_at: null,
    registration_proof_digest: null,
    registration_proof_expires_at: null,
    created_at: new Date(NOW.getTime() - 1000),
    updated_at: new Date(NOW.getTime() - 1000),
    ...overrides,
  };
}

function createHarness() {
  const txAuthUpdateMany = jest.fn();
  const txAuthFindFirst = jest.fn();
  const txAuthFindUnique = jest.fn();
  const txAuthCreate = jest.fn();
  const txUserUpdateMany = jest.fn();
  const txExecuteRaw = jest.fn();
  const dbAuthUpdateMany = jest.fn();
  const sendVerificationCode = jest.fn();

  const tx = {
    authChallenge: {
      updateMany: (...args: unknown[]) => txAuthUpdateMany(...args),
      findFirst: (...args: unknown[]) => txAuthFindFirst(...args),
      findUnique: (...args: unknown[]) => txAuthFindUnique(...args),
      create: (...args: unknown[]) => txAuthCreate(...args),
    },
    user: {
      updateMany: (...args: unknown[]) => txUserUpdateMany(...args),
    },
    $executeRaw: (...args: unknown[]) => txExecuteRaw(...args),
  };

  const transaction = jest.fn(async (
    callback: (client: typeof tx) => Promise<unknown>,
    _options?: { isolationLevel?: string }
  ) => callback(tx));
  const dependencies: AuthChallengeDependencies = {
    db: {
      $transaction: (...args: unknown[]) => transaction(args[0] as never, args[1] as never),
      authChallenge: {
        updateMany: (...args: unknown[]) => dbAuthUpdateMany(...args),
      },
    } as never,
    delivery: {
      sendVerificationCode: (...args: unknown[]) => sendVerificationCode(...args) as never,
    },
    otpPepper: OTP_PEPPER,
    now: () => NOW,
    generateCode: () => '123456',
    randomUUID: () => 'challenge-1',
    randomBytes: (size) => Buffer.alloc(size, 7),
  };

  return {
    service: new AuthChallengeService(dependencies),
    tx,
    transaction,
    txAuthUpdateMany,
    txAuthFindFirst,
    txAuthFindUnique,
    txAuthCreate,
    txUserUpdateMany,
    txExecuteRaw,
    dbAuthUpdateMany,
    sendVerificationCode,
  };
}

describe('AuthChallengeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issue 只儲存 HMAC digest，provider 接受後才標記可驗證', async () => {
    const h = createHarness();
    (h.txAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 0 } as never);
    (h.txAuthFindFirst as jest.Mock).mockResolvedValue(null as never);
    (h.txAuthCreate as jest.Mock).mockResolvedValue({ id: 'challenge-1' } as never);
    (h.sendVerificationCode as jest.Mock).mockResolvedValue({
      acceptedAt: NOW,
      providerMessageIdDigest: 'a'.repeat(64),
    } as never);
    (h.dbAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);

    const result = await h.service.issue(' User@Example.COM ', 'register', 'en-US');

    const createCall = h.txAuthCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data.email).toBe('user@example.com');
    expect(createCall.data.code_digest).toBe(
      digestCode('challenge-1', 'user@example.com', 'register', '123456')
    );
    expect(createCall.data).not.toHaveProperty('code');
    expect(createCall.data.source).toBe('provider');
    expect(h.sendVerificationCode).toHaveBeenCalledWith(
      'user@example.com',
      '123456',
      'register',
      'en-US'
    );
    expect(h.dbAuthUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ delivery_status: 'pending' }),
      data: expect.objectContaining({
        delivery_status: 'provider_accepted',
        expires_at: new Date(NOW.getTime() + 5 * 60 * 1000),
      }),
    }));
    expect(result).toEqual({ expires_in: 300, resend_after: 60 });
  });

  it('provider 未接受時 fail closed 並把 challenge 標記 failed', async () => {
    const h = createHarness();
    (h.txAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 0 } as never);
    (h.txAuthFindFirst as jest.Mock).mockResolvedValue(null as never);
    (h.txAuthCreate as jest.Mock).mockResolvedValue({ id: 'challenge-1' } as never);
    (h.sendVerificationCode as jest.Mock).mockRejectedValue(new Error('smtp unavailable') as never);
    (h.dbAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);

    await expect(h.service.issue('user@example.com', 'register'))
      .rejects.toMatchObject({ code: 'EMAIL_DELIVERY_UNAVAILABLE' });
    expect(h.dbAuthUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        delivery_status: 'failed',
        delivery_failed_at: NOW,
        invalidated_at: NOW,
      }),
    }));
  });

  it('同 email/purpose 的 active challenge 在 cooldown 內不得重複發送', async () => {
    const h = createHarness();
    (h.txAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 0 } as never);
    (h.txAuthFindFirst as jest.Mock).mockResolvedValue({
      id: 'active',
      created_at: new Date(NOW.getTime() - 59_000),
      provider_accepted_at: new Date(NOW.getTime() - 59_000),
    } as never);

    await expect(h.service.issue('user@example.com', 'register'))
      .rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });

    expect(h.txAuthCreate).not.toHaveBeenCalled();
    expect(h.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('cooldown 後先作廢舊 code，再只允許新 code 通過', async () => {
    const h = createHarness();
    const replacement = challenge({
      attempt_count: 0,
      created_at: NOW,
      provider_accepted_at: NOW,
    });
    const replacementAfterAttempt = challenge({
      attempt_count: 1,
      created_at: NOW,
      provider_accepted_at: NOW,
    });
    (h.txAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 0 } as never);
    (h.txAuthFindFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'old-challenge',
        created_at: new Date(NOW.getTime() - 61_000),
        provider_accepted_at: new Date(NOW.getTime() - 61_000),
      } as never)
      .mockResolvedValueOnce(replacement as never)
      .mockResolvedValueOnce(replacementAfterAttempt as never);
    (h.txAuthCreate as jest.Mock).mockResolvedValue({ id: 'challenge-1' } as never);
    (h.sendVerificationCode as jest.Mock).mockResolvedValue({
      acceptedAt: NOW,
      providerMessageIdDigest: 'a'.repeat(64),
    } as never);
    (h.dbAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);
    (h.txExecuteRaw as jest.Mock).mockResolvedValue(1 as never);

    await expect(h.service.issue('user@example.com', 'register')).resolves.toEqual({
      expires_in: 300,
      resend_after: 60,
    });

    const retirement = h.txAuthUpdateMany.mock.calls[1][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(retirement).toEqual({
      where: {
        email: 'user@example.com',
        type: 'register',
        source: 'provider',
        delivery_status: { in: ['pending', 'provider_accepted'] },
        consumed_at: null,
        invalidated_at: null,
      },
      data: { invalidated_at: NOW },
    });
    expect(h.txAuthUpdateMany.mock.invocationCallOrder[1])
      .toBeLessThan(h.txAuthCreate.mock.invocationCallOrder[0]);

    await expect(h.service.verifyRegistrationCode('user@example.com', '654321'))
      .rejects.toMatchObject({ code: 'INVALID_CODE' });

    (h.txAuthUpdateMany as jest.Mock).mockResolvedValueOnce({ count: 1 } as never);
    await expect(h.service.verifyRegistrationCode('user@example.com', '123456'))
      .resolves.toMatchObject({ verified: true });
  });

  it('concurrent resend 的 Serializable 衝突應 fail closed 為 rate limit', async () => {
    const h = createHarness();
    (h.transaction as jest.Mock).mockRejectedValueOnce({ code: 'P2034' } as never);

    await expect(h.service.issue('user@example.com', 'register'))
      .rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });

    expect(h.transaction as jest.Mock).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' }
    );
    expect(h.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('錯碼嘗試會先提交 attempt update，再於 transaction 外回 INVALID_CODE', async () => {
    const h = createHarness();
    (h.txAuthFindFirst as jest.Mock).mockResolvedValue(challenge() as never);
    (h.txExecuteRaw as jest.Mock).mockResolvedValue(1 as never);

    await expect(h.service.verifyRegistrationCode('user@example.com', '000000'))
      .rejects.toMatchObject({ code: 'INVALID_CODE' });

    expect(h.txExecuteRaw).toHaveBeenCalledTimes(1);
    expect(h.transaction).toHaveBeenCalledTimes(1);
  });

  it('reset 錯碼在 caller transaction 內回傳 error value，不拋錯 rollback attempt', async () => {
    const h = createHarness();
    (h.txAuthFindFirst as jest.Mock).mockResolvedValue(challenge({
      type: 'reset_password',
      code_digest: digestCode('challenge-1', 'user@example.com', 'reset_password', '123456'),
    }) as never);
    (h.txExecuteRaw as jest.Mock).mockResolvedValue(1 as never);

    const error = await h.service.verifyAndConsumeResetCode(
      h.tx as never,
      'user@example.com',
      '000000'
    );

    expect(error).toMatchObject({ code: 'INVALID_CODE' });
    expect(h.txExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('register 驗證只回傳一次性 proof，DB 僅保存 proof digest 且只能消費一次', async () => {
    const h = createHarness();
    (h.txAuthFindFirst as jest.Mock).mockResolvedValue(challenge() as never);
    (h.txAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);

    const result = await h.service.verifyRegistrationCode('user@example.com', '123456');

    expect(result.verified).toBe(true);
    expect(result.registration_proof).toMatch(/^rp1_[A-Za-z0-9_-]{43}$/);
    const verifyUpdate = h.txAuthUpdateMany.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(verifyUpdate.data.registration_proof_digest).toBe(
      crypto.createHash('sha256').update(result.registration_proof).digest('hex')
    );
    expect(verifyUpdate.data.registration_proof_digest).not.toBe(result.registration_proof);

    (h.txAuthFindUnique as jest.Mock).mockResolvedValue(challenge({
      verified_at: NOW,
      registration_proof_digest: verifyUpdate.data.registration_proof_digest,
      registration_proof_expires_at: new Date(NOW.getTime() + 60_000),
    }) as never);
    (h.txAuthUpdateMany as jest.Mock).mockResolvedValueOnce({ count: 1 } as never);
    await expect(
      h.service.consumeRegistrationProof(h.tx as never, 'user@example.com', result.registration_proof)
    ).resolves.toBeUndefined();

    (h.txAuthUpdateMany as jest.Mock).mockResolvedValueOnce({ count: 0 } as never);
    await expect(
      h.service.consumeRegistrationProof(h.tx as never, 'user@example.com', result.registration_proof)
    ).rejects.toMatchObject({ code: 'REGISTRATION_PROOF_INVALID' });
  });

  it('過期 challenge 會持久化 invalidated_at 並回 CODE_EXPIRED', async () => {
    const h = createHarness();
    (h.txAuthFindFirst as jest.Mock).mockResolvedValue(challenge({
      expires_at: new Date(NOW.getTime() - 1),
    }) as never);
    (h.txAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);

    await expect(h.service.verifyRegistrationCode('user@example.com', '123456'))
      .rejects.toMatchObject({ code: 'CODE_EXPIRED' });
    expect(h.txAuthUpdateMany).toHaveBeenCalledWith({
      where: { id: 'challenge-1', consumed_at: null, invalidated_at: null },
      data: { invalidated_at: NOW },
    });
  });

  it('過期或 email 不匹配的 registration proof 不得被消費', async () => {
    const h = createHarness();
    const proof = `rp1_${Buffer.alloc(32, 9).toString('base64url')}`;
    (h.txAuthFindUnique as jest.Mock).mockResolvedValue(challenge({
      email: 'other@example.com',
      verified_at: NOW,
      registration_proof_digest: crypto.createHash('sha256').update(proof).digest('hex'),
      registration_proof_expires_at: new Date(NOW.getTime() + 60_000),
    }) as never);

    await expect(
      h.service.consumeRegistrationProof(h.tx as never, 'user@example.com', proof)
    ).rejects.toMatchObject({ code: 'REGISTRATION_PROOF_INVALID' });
    expect(h.txAuthUpdateMany).not.toHaveBeenCalled();

    (h.txAuthFindUnique as jest.Mock).mockResolvedValue(challenge({
      verified_at: NOW,
      registration_proof_digest: crypto.createHash('sha256').update(proof).digest('hex'),
      registration_proof_expires_at: new Date(NOW.getTime() - 1),
    }) as never);
    await expect(
      h.service.consumeRegistrationProof(h.tx as never, 'user@example.com', proof)
    ).rejects.toMatchObject({ code: 'REGISTRATION_PROOF_EXPIRED' });
    expect(h.txAuthUpdateMany).not.toHaveBeenCalled();
  });

  it('release fixture proof 只能透過顯式 source/status 分支消費', async () => {
    const h = createHarness();
    const proof = `rp1_${Buffer.alloc(32, 5).toString('base64url')}`;
    const proofDigest = crypto.createHash('sha256').update(proof).digest('hex');
    (h.txAuthFindUnique as jest.Mock).mockResolvedValue(challenge({
      id: 'release-fixture-fixture-1',
      email: 'claim-smoke-fixture-1@example.com',
      source: 'release_fixture',
      delivery_status: 'release_fixture_ready',
      provider_accepted_at: null,
      verified_at: NOW,
      registration_proof_digest: proofDigest,
      registration_proof_expires_at: new Date(NOW.getTime() + 60_000),
    }) as never);
    (h.txAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);

    await expect(
      h.service.consumeRegistrationProof(h.tx as never, 'claim-smoke-fixture-1@example.com', proof)
    ).resolves.toBeUndefined();
    expect(h.txAuthUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { source: 'provider', delivery_status: 'provider_accepted' },
          { source: 'release_fixture', delivery_status: 'release_fixture_ready' },
        ],
      }),
    }));
  });

  it('verify_email 成功時同 transaction 消費 challenge 並驗證 active user', async () => {
    const h = createHarness();
    (h.txAuthFindFirst as jest.Mock).mockResolvedValue(challenge({
      type: 'verify_email',
      code_digest: digestCode('challenge-1', 'user@example.com', 'verify_email', '123456'),
    }) as never);
    (h.txAuthUpdateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);
    (h.txUserUpdateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);

    await expect(h.service.verifyExistingEmail('user@example.com', '123456'))
      .resolves.toEqual({ verified: true });
    expect(h.txAuthUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { verified_at: NOW, consumed_at: NOW },
    }));
    expect(h.txUserUpdateMany).toHaveBeenCalledWith({
      where: { email: 'user@example.com', is_active: true },
      data: { email_verified: true },
    });
  });
});
