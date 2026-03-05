import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

const mockVerifyToken = jest.fn() as any;
const mockUserFindUnique = jest.fn() as any;
const mockPairingFindUnique = jest.fn() as any;
const mockRelationshipFindUnique = jest.fn() as any;
const mockRelationshipUpsert = jest.fn() as any;

jest.mock('../../src/utils/jwt', () => ({
  verifyToken: (token: string) => mockVerifyToken(token),
  generateToken: jest.fn(),
}));

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    pairing: {
      findUnique: (...args: unknown[]) => mockPairingFindUnique(...args),
    },
    relationshipProfile: {
      findUnique: (...args: unknown[]) => mockRelationshipFindUnique(...args),
      upsert: (...args: unknown[]) => mockRelationshipUpsert(...args),
    },
    quickSession: {
      update: jest.fn(),
    },
  },
}));

import app from '../../src/app';

describe('Profile relationship integration flow', () => {
  const pairingId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockReturnValue({
      id: 'user-a',
      email: 'a@example.com',
      token_version: 0,
    });
    mockUserFindUnique.mockResolvedValue({
      id: 'user-a',
      email: 'a@example.com',
      is_active: true,
      token_version: 0,
    });
    mockPairingFindUnique.mockResolvedValue({
      id: pairingId,
      user1_id: 'user-a',
      user2_id: 'user-b',
    });
    mockRelationshipFindUnique.mockResolvedValue({
      pairing_id: pairingId,
      relationship_stage: 'stable',
      completion_percentage: 70,
    });
    mockRelationshipUpsert.mockResolvedValue({
      pairing_id: pairingId,
      relationship_stage: 'stable',
      completion_percentage: 80,
    });
  });

  it('未帶 token 讀取關係檔案應返回 401', async () => {
    const res = await request(app).get(`/api/v1/profile/relationship/${pairingId}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('帶 token 但 pairingId 非 UUID 應返回 400', async () => {
    const res = await request(app)
      .get('/api/v1/profile/relationship/not-a-uuid')
      .set('Authorization', 'Bearer token-ok');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('讀取關係檔案成功應返回 200 與 profile', async () => {
    const res = await request(app)
      .get(`/api/v1/profile/relationship/${pairingId}`)
      .set('Authorization', 'Bearer token-ok');

    expect(res.status).toBe(200);
    expect(mockVerifyToken).toHaveBeenCalledWith('token-ok');
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.pairing_id).toBe(pairingId);
  });

  it('更新關係檔案應通過白名單清洗並返回 200', async () => {
    const res = await request(app)
      .put(`/api/v1/profile/relationship/${pairingId}`)
      .set('Authorization', 'Bearer token-ok')
      .send({
        relationship_stage: 'stable',
        completion_percentage: 80,
        unknown_field: 'should_be_dropped',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const upsertArg = mockRelationshipUpsert.mock.calls[0]?.[0];
    expect(upsertArg.create).toMatchObject({
      pairing_id: pairingId,
      relationship_stage: 'stable',
      completion_percentage: 80,
    });
    expect(upsertArg.create).not.toHaveProperty('unknown_field');
  });

  it('非配對成員更新關係檔案應返回 403', async () => {
    mockPairingFindUnique.mockResolvedValueOnce({
      id: pairingId,
      user1_id: 'user-x',
      user2_id: 'user-y',
    });

    const res = await request(app)
      .put(`/api/v1/profile/relationship/${pairingId}`)
      .set('Authorization', 'Bearer token-ok')
      .send({
        relationship_stage: 'stable',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
