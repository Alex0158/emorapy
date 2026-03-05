/**
 * 關係檔案 API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';

export interface RelationshipProfile {
  pairing_id: string;
  relationship_duration_days?: number | null;
  relationship_stage?: string | null;
  communication_frequency?: string | null;
  preferred_communication_methods?: string[] | null;
  relationship_strengths?: string | null;
  relationship_challenges?: string | null;
  completion_percentage?: number | null;
  last_updated_at?: string | null;
}

export interface RelationshipProfileInput {
  relationship_duration_days?: number;
  relationship_stage?: string;
  communication_frequency?: string;
  preferred_communication_methods?: string[];
  relationship_strengths?: string;
  relationship_challenges?: string;
  completion_percentage?: number;
}

/**
 * 讀取關係檔案（不存在時返回 null）
 */
export const getRelationshipProfile = async (
  pairingId: string
): Promise<RelationshipProfile | null> => {
  const response = await request.get<ApiResponse<{ profile: RelationshipProfile | null }>>(
    `/profile/relationship/${pairingId}`
  );
  return (response.data as ApiResponse<{ profile: RelationshipProfile | null }>)?.data?.profile ?? null;
};

/**
 * 更新關係檔案
 */
export const upsertRelationshipProfile = async (
  pairingId: string,
  payload: RelationshipProfileInput
): Promise<RelationshipProfile> => {
  const response = await request.put<ApiResponse<{ profile: RelationshipProfile }>>(
    `/profile/relationship/${pairingId}`,
    payload
  );
  const result = (response.data as ApiResponse<{ profile: RelationshipProfile }>)?.data?.profile;
  if (!result) throw new Error('Invalid relationship profile response from server');
  return result;
};
