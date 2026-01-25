/**
 * 配對API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';

export interface Pairing {
  id: string;
  user1_id?: string;
  user2_id?: string;
  invite_code?: string;
  status: 'pending' | 'active' | 'cancelled' | 'temp';
  pairing_type: 'normal' | 'quick';
  created_at: string;
  confirmed_at?: string;
  expires_at?: string;
  user1?: {
    id: string;
    nickname?: string;
    avatar_url?: string;
  };
  user2?: {
    id: string;
    nickname?: string;
    avatar_url?: string;
  };
}

/**
 * 創建配對（生成邀請碼）
 */
export const createPairing = async (): Promise<Pairing> => {
  const response = await request.post<ApiResponse<{ pairing: Pairing }>>('/pairing/create');
  return (response.data as ApiResponse<{ pairing: Pairing }>).data.pairing;
};

/**
 * 加入配對（使用邀請碼）
 */
export const joinPairing = async (inviteCode: string): Promise<Pairing> => {
  const response = await request.post<ApiResponse<{ pairing: Pairing }>>('/pairing/join', {
    invite_code: inviteCode,
  });
  return (response.data as ApiResponse<{ pairing: Pairing }>).data.pairing;
};

/**
 * 獲取配對狀態
 */
export const getPairingStatus = async (): Promise<Pairing | null> => {
  try {
    const response = await request.get<ApiResponse<{ pairing: Pairing }>>('/pairing/status');
    return (response.data as ApiResponse<{ pairing: Pairing }>).data.pairing;
  } catch (error: any) {
    if (error.code === 'NOT_FOUND' || error.code === 'HTTP_404') {
      return null;
    }
    throw error;
  }
};

/**
 * 解除配對
 */
export const cancelPairing = async (): Promise<Pairing> => {
  const response = await request.post<ApiResponse<{ pairing: Pairing }>>('/pairing/cancel');
  return (response.data as ApiResponse<{ pairing: Pairing }>).data.pairing;
};
