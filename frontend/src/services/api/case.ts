/**
 * 案件API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';
import type { Case, CreateCaseDto, QuickCaseDto } from '@/types/case';

/**
 * 創建案件（快速體驗模式）
 */
export const createQuickCase = async (
  data: QuickCaseDto
): Promise<{ case: Case; session_id?: string; session_expires_at?: string }> => {
  const response = await request.post<ApiResponse<{ case: Case; session_id?: string; session_expires_at?: string }>>(
    '/cases/quick',
    data
  );
  return (response.data as ApiResponse<{ case: Case; session_id?: string; session_expires_at?: string }>).data;
};

/**
 * 創建案件（完整模式）
 */
export const createCase = async (data: CreateCaseDto): Promise<Case> => {
  const response = await request.post<ApiResponse<{ case: Case }>>('/cases', data);
  return (response.data as ApiResponse<{ case: Case }>).data.case;
};

/**
 * 獲取案件詳情
 * @param id 案件ID
 * @param sessionId 可選，快速體驗時指定案件對應的 Session（用於多案件回訪）
 */
export const getCase = async (id: string, sessionId?: string): Promise<Case> => {
  const config = sessionId
    ? { headers: { 'X-Session-Id': sessionId } as Record<string, string>, params: { session_id: sessionId } }
    : undefined;
  const response = await request.get<ApiResponse<{ case: Case }>>(`/cases/${id}`, config);
  return (response.data as ApiResponse<{ case: Case }>).data.case;
};

/**
 * 通過Session ID獲取案件（快速體驗模式）
 */
export const getCaseBySessionId = async (sessionId: string): Promise<Case | null> => {
  try {
    const response = await request.get<ApiResponse<{ case: Case }>>('/cases/by-session', {
      params: { session_id: sessionId },
    });
    return (response.data as ApiResponse<{ case: Case }>).data.case;
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'NOT_FOUND' || err.code === 'HTTP_404') {
      return null;
    }
    throw error;
  }
};

/**
 * 獲取案件列表
 */
export const getCaseList = async (params?: {
  status?: string;
  type?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  search?: string;
}): Promise<{
  cases: Case[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}> => {
  const response = await request.get<ApiResponse<{
    cases: Case[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
    };
  }>>('/cases', { params });
  return (response.data as ApiResponse<{
    cases: Case[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
    };
  }>).data;
};

/**
 * 提交案件
 */
export const submitCase = async (id: string): Promise<void> => {
  await request.post<ApiResponse>(`/cases/${id}/submit`);
};

/**
 * 更新案件
 */
export const updateCase = async (id: string, data: Partial<CreateCaseDto>): Promise<Case> => {
  const response = await request.put<ApiResponse<{ case: Case }>>(`/cases/${id}`, data);
  return (response.data as ApiResponse<{ case: Case }>).data.case;
};

/**
 * 上傳證據
 */
export const uploadEvidence = async (
  caseId: string,
  files: File[],
  sessionId?: string
): Promise<Array<{ id: string; file_url: string; file_type: string }>> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const config: { headers: { 'Content-Type': string }; params?: { session_id: string } } = {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  };

  // 如果提供了sessionId，添加到查询参数（request拦截器也会自动添加，但这里明确传递）
  if (sessionId) {
    config.params = { session_id: sessionId };
  }

  const response = await request.post<ApiResponse<{ evidences: Array<{ id: string; file_url: string; file_type: string }> }>>(
    `/cases/${caseId}/evidence`,
    formData,
    config
  );
  return (response.data as ApiResponse<{ evidences: Array<{ id: string; file_url: string; file_type: string }> }>).data.evidences;
};

/**
 * 刪除單個證據文件（需 caseId + evidenceId）
 */
export const deleteEvidence = async (
  caseId: string,
  evidenceId: string,
  sessionId?: string
): Promise<void> => {
  const config: { params?: { session_id: string } } = {};
  if (sessionId) {
    config.params = { session_id: sessionId };
  }
  await request.delete<ApiResponse>(`/cases/${caseId}/evidence/${evidenceId}`, config);
};
