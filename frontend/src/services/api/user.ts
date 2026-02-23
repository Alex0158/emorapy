/**
 * 用戶API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';
import type { User } from './auth';

/**
 * 獲取用戶資料
 */
export const getProfile = async (): Promise<User> => {
  const response = await request.get<ApiResponse<{ user: User }>>('/user/profile');
  const result = (response.data as ApiResponse<{ user: User }>)?.data?.user;
  if (!result) throw new Error('Invalid profile response from server');
  return result;
};

/**
 * 更新用戶資料
 */
export const updateProfile = async (data: Partial<User>): Promise<User> => {
  const response = await request.put<ApiResponse<{ user: User }>>('/user/profile', data);
  const result = (response.data as ApiResponse<{ user: User }>)?.data?.user;
  if (!result) throw new Error('Invalid profile response from server');
  return result;
};

