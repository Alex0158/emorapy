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

/**
 * 上傳頭像
 * 使用 request 實例，由攔截器自動附加 token，頁面層無需直接存取 storage
 */
export const uploadAvatar = async (formData: FormData): Promise<User> => {
  const response = await request.post<ApiResponse<{ user: User }>>('/user/avatar', formData);
  const result = (response.data as ApiResponse<{ user: User }>)?.data?.user;
  if (!result) throw new Error('Invalid avatar upload response from server');
  return result;
};

