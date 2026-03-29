/**
 * 案件API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';
import type { Case, CreateCaseDto, UpdateCaseDto, QuickCaseDto } from '@/types/case';

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
  const result = (response.data as ApiResponse<{ case: Case; session_id?: string; session_expires_at?: string }>)?.data;
  if (!result?.case) throw new Error('Invalid case response from server');
  return result;
};

/**
 * 創建案件（完整模式）
 */
export const createCase = async (data: CreateCaseDto): Promise<Case> => {
  const response = await request.post<ApiResponse<{ case: Case }>>('/cases', data);
  const result = (response.data as ApiResponse<{ case: Case }>)?.data?.case;
  if (!result) throw new Error('Invalid case response from server');
  return result;
};

/**
 * 獲取案件詳情
 * @param id 案件ID
 * @param sessionId 可選，快速體驗時指定案件對應的 Session（用於多案件回訪）
 */
export const getCase = async (id: string, sessionId?: string): Promise<Case> => {
  const config = sessionId
    ? { headers: { 'X-Session-Id': sessionId } as Record<string, string> }
    : undefined;
  const response = await request.get<ApiResponse<{ case: Case }>>(`/cases/${id}`, config);
  const result = (response.data as ApiResponse<{ case: Case }>)?.data?.case;
  if (!result) throw new Error('Invalid case response from server');
  return result;
};

/**
 * 通過Session ID獲取案件（快速體驗模式）
 */
export const getCaseBySessionId = async (sessionId: string): Promise<Case | null> => {
  try {
    const response = await request.get<ApiResponse<{ case: Case }>>('/cases/by-session', {
      headers: { 'X-Session-Id': sessionId },
    });
    return (response.data as ApiResponse<{ case: Case }>)?.data?.case ?? null;
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
  const result = (response.data as ApiResponse<{
    cases: Case[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
    };
  }>)?.data;
  if (!result) throw new Error('Invalid case list response from server');
  const cases = result.cases;
  const pagination = result.pagination;
  const safePagination = pagination && typeof pagination === 'object'
    ? {
        page: pagination.page ?? 1,
        page_size: pagination.page_size ?? 10,
        total: pagination.total ?? 0,
        total_pages: pagination.total_pages ?? 0,
      }
    : { page: 1, page_size: 10, total: 0, total_pages: 0 };
  return { cases: Array.isArray(cases) ? cases : [], pagination: safePagination };
};

/**
 * 提交案件
 */
export const submitCase = async (id: string): Promise<Case> => {
  const response = await request.post<ApiResponse<{ case: Case }>>(`/cases/${id}/submit`);
  const result = (response.data as ApiResponse<{ case: Case }>)?.data?.case;
  if (!result) throw new Error('Invalid case response from server');
  return result;
};

/**
 * 更新案件
 */
export const updateCase = async (id: string, data: UpdateCaseDto): Promise<Case> => {
  const response = await request.put<ApiResponse<{ case: Case }>>(`/cases/${id}`, data);
  const result = (response.data as ApiResponse<{ case: Case }>)?.data?.case;
  if (!result) throw new Error('Invalid case response from server');
  return result;
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

  const config: { headers?: Record<string, string> } = {};

  if (sessionId) {
    config.headers = { 'X-Session-Id': sessionId };
  }

  const response = await request.post<ApiResponse<{ evidences: Array<{ id: string; file_url: string; file_type: string }> }>>(
    `/cases/${caseId}/evidence`,
    formData,
    config
  );
  const result = (response.data as ApiResponse<{ evidences: Array<{ id: string; file_url: string; file_type: string }> }>)?.data?.evidences;
  if (!result) throw new Error('Invalid evidence response from server');
  return Array.isArray(result) ? result : [];
};

/**
 * 刪除單個證據文件（需 caseId + evidenceId）
 */
export const deleteEvidence = async (
  caseId: string,
  evidenceId: string,
  sessionId?: string
): Promise<void> => {
  const config: { headers?: { 'X-Session-Id': string } } = {};
  if (sessionId) {
    config.headers = { 'X-Session-Id': sessionId };
  }
  await request.delete<ApiResponse>(`/cases/${caseId}/evidence/${evidenceId}`, config);
};

/**
 * 創建/更新協作聽證案件
 */
export interface CollaborativeResponse {
  case: Case;
  session_id: string;
  session_expires_at: string;
  phase: 'a_done' | 'submitted';
}

export const createCollaborativeCase = async (
  data: {
    case_id?: string;
    plaintiff_statement?: string;
    defendant_statement?: string;
  },
  sessionId?: string
): Promise<CollaborativeResponse> => {
  const config = sessionId
    ? { headers: { 'X-Session-Id': sessionId } as Record<string, string> }
    : undefined;
  const response = await request.post<ApiResponse<CollaborativeResponse>>(
    '/cases/collaborative',
    data,
    config
  );
  const result = (response.data as ApiResponse<CollaborativeResponse>)?.data;
  if (!result?.case) throw new Error('Invalid collaborative case response from server');
  return result;
};
