/**
 * 配對API
 */

import request from '../request';
import { createM4ApiClient } from '@emorapy/api-client';

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

const sharedPairingApi = createM4ApiClient(request).pairing;

/**
 * 創建配對（生成邀請碼）
 */
export const createPairing = async (): Promise<Pairing> => {
  return sharedPairingApi.create() as Promise<Pairing>;
};

/**
 * 加入配對（使用邀請碼）
 */
export const joinPairing = async (inviteCode: string): Promise<Pairing> => {
  return sharedPairingApi.join(inviteCode) as Promise<Pairing>;
};

/**
 * 獲取配對狀態
 */
export const getPairingStatus = async (): Promise<Pairing | null> => {
  return sharedPairingApi.getStatus() as Promise<Pairing | null>;
};

/**
 * 解除配對
 */
export const cancelPairing = async (): Promise<Pairing> => {
  return sharedPairingApi.cancel() as Promise<Pairing>;
};
