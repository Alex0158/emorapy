import crypto from 'crypto';
import { describe, it, expect, jest } from '@jest/globals';
import {
  createReleaseRegistrationProof,
  validateReleaseFixtureRequest,
} from '../../../scripts/create-release-registration-proof';

describe('create-release-registration-proof', () => {
  it('必須同時有 release gate、DATABASE_URL 與明確 smoke email pattern', () => {
    expect(() => validateReleaseFixtureRequest(
      { DATABASE_URL: 'postgresql://local/test' },
      ['--email=claim-smoke-123@example.com']
    )).toThrow('EMORAPY_RELEASE_GATE=1');

    expect(() => validateReleaseFixtureRequest(
      { EMORAPY_RELEASE_GATE: '1', DATABASE_URL: 'postgresql://local/test' },
      ['--email=customer@example.com']
    )).toThrow('claim-smoke-<id>@example.com');

    expect(validateReleaseFixtureRequest(
      { EMORAPY_RELEASE_GATE: '1', DATABASE_URL: 'postgresql://local/test' },
      ['--email', 'CLAIM-SMOKE-123@EXAMPLE.COM']
    )).toEqual({ email: 'claim-smoke-123@example.com', releaseGate: '1' });
  });

  it('transaction 內先拒絕既有 user、失效舊 challenge，再只儲存 proof digest', async () => {
    const userFindUnique = jest.fn().mockResolvedValue(null as never);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 } as never);
    const create = jest.fn().mockResolvedValue({ id: 'fixture' } as never);
    const tx = {
      user: { findUnique: (...args: unknown[]) => userFindUnique(...args) },
      authChallenge: {
        updateMany: (...args: unknown[]) => updateMany(...args),
        create: (...args: unknown[]) => create(...args),
      },
    };
    const transaction = jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx));
    const prisma = { $transaction: (...args: unknown[]) => transaction(args[0] as never) } as never;
    const now = new Date('2026-07-13T12:00:00.000Z');

    const proof = await createReleaseRegistrationProof(
      prisma,
      { email: 'claim-smoke-123@example.com', releaseGate: '1' },
      now
    );

    expect(proof).toMatch(/^rp1_[A-Za-z0-9_-]{43}$/);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        email: 'claim-smoke-123@example.com',
        type: 'register',
        consumed_at: null,
        invalidated_at: null,
      },
      data: { invalidated_at: now },
    });
    const createData = (create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(createData.registration_proof_digest).toBe(
      crypto.createHash('sha256').update(proof).digest('hex')
    );
    expect(createData.registration_proof_digest).not.toBe(proof);
    expect(createData).not.toHaveProperty('registration_proof');
    expect(String(createData.id)).toMatch(/^release-fixture-/);
    expect(createData).toMatchObject({
      source: 'release_fixture',
      delivery_status: 'release_fixture_ready',
    });
    expect(createData).not.toHaveProperty('provider_accepted_at');
    expect(createData).not.toHaveProperty('provider_message_id_digest');
  });

  it('fixture email 已有 user 時不建立 challenge', async () => {
    const create = jest.fn();
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' } as never) },
      authChallenge: { updateMany: jest.fn(), create },
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => Promise<void>) => callback(tx),
    } as never;

    await expect(createReleaseRegistrationProof(
      prisma,
      { email: 'claim-smoke-existing@example.com', releaseGate: '1' }
    )).rejects.toThrow('already belongs to a user');
    expect(create).not.toHaveBeenCalled();
  });

  it('DB helper 本身也不允許繞過 release gate 或 synthetic email boundary', async () => {
    const prisma = { $transaction: jest.fn() } as never;

    await expect(createReleaseRegistrationProof(
      prisma,
      { email: 'customer@example.com', releaseGate: '1' }
    )).rejects.toThrow('authorization is invalid');
    expect((prisma as { $transaction: ReturnType<typeof jest.fn> }).$transaction).not.toHaveBeenCalled();
  });
});
