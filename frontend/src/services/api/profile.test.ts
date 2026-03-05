/**
 * 關係檔案 API 單元測試
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRelationshipProfile,
  upsertRelationshipProfile,
  type RelationshipProfile,
  type RelationshipProfileInput,
} from './profile';

const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

describe('relationship profile API', () => {
  const pairingId = '550e8400-e29b-41d4-a716-446655440000';
  const profile: RelationshipProfile = {
    pairing_id: pairingId,
    relationship_stage: 'stable',
    relationship_duration_days: 365,
    communication_frequency: 'daily',
    preferred_communication_methods: ['chat', 'call'],
    relationship_strengths: '互相信任',
    relationship_challenges: '工作壓力',
    completion_percentage: 70,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getRelationshipProfile 應請求正確路徑並返回 profile', async () => {
    mockGet.mockResolvedValue({ data: { data: { profile } } });

    const result = await getRelationshipProfile(pairingId);

    expect(mockGet).toHaveBeenCalledWith(`/profile/relationship/${pairingId}`);
    expect(result).toEqual(profile);
  });

  it('getRelationshipProfile 在 profile 為 null 時應返回 null', async () => {
    mockGet.mockResolvedValue({ data: { data: { profile: null } } });

    const result = await getRelationshipProfile(pairingId);

    expect(result).toBeNull();
  });

  it('upsertRelationshipProfile 應請求正確路徑並返回 profile', async () => {
    const payload: RelationshipProfileInput = {
      relationship_stage: 'stable',
      communication_frequency: 'daily',
      completion_percentage: 80,
    };
    mockPut.mockResolvedValue({ data: { data: { profile: { ...profile, ...payload } } } });

    const result = await upsertRelationshipProfile(pairingId, payload);

    expect(mockPut).toHaveBeenCalledWith(`/profile/relationship/${pairingId}`, payload);
    expect(result.completion_percentage).toBe(80);
  });

  it('upsertRelationshipProfile 無 profile 時應拋錯', async () => {
    mockPut.mockResolvedValue({ data: { data: {} } });

    await expect(upsertRelationshipProfile(pairingId, {})).rejects.toThrow(
      'Invalid relationship profile response from server'
    );
  });
});
