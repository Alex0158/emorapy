/**
 * 內容API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';

export interface ContentItem {
  id: string;
  title: string;
  content: string;
  content_type: 'article' | 'case_sample' | 'quiz' | 'tip';
  tags: string[];
  language: string;
  is_active: boolean;
  created_at: string;
}

/**
 * 獲取內容列表
 */
export const getContentList = async (params?: {
  type?: string;
  language?: string;
  limit?: number;
}): Promise<ContentItem[]> => {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.language) query.set('language', params.language);
  if (params?.limit) query.set('limit', String(params.limit));
  const response = await request.get<ApiResponse<{ items: ContentItem[] }>>(`/content-items?${query.toString()}`);
  const items = (response.data as ApiResponse<{ items: ContentItem[] }>)?.data?.items;
  return Array.isArray(items) ? items : [];
};
