/**
 * 案件API
 */

import request from '../request';
import { createM1ApiClient, createM4ApiClient, createM5ApiClient } from '@cj/api-client';
import type { Case, CreateCaseDto, UpdateCaseDto, QuickCaseDto } from '@/types/case';

const sharedQuickApi = createM1ApiClient(request).quick;
const sharedFormalCaseApi = createM4ApiClient(request).cases;
const sharedMediaApi = createM5ApiClient(request).media;

/**
 * 創建案件（快速體驗模式）
 */
export const createQuickCase = async (
  data: QuickCaseDto
): Promise<{ case: Case; session_id?: string; session_expires_at?: string }> => {
  return sharedQuickApi.createQuickCase(data) as Promise<{
    case: Case;
    session_id?: string;
    session_expires_at?: string;
  }>;
};

/**
 * 創建案件（完整模式）
 */
export const createCase = async (data: CreateCaseDto): Promise<Case> => {
  return sharedFormalCaseApi.create(data) as Promise<Case>;
};

/**
 * 獲取案件詳情
 * @param id 案件ID
 * @param sessionId 可選，快速體驗時指定案件對應的 Session（用於多案件回訪）
 */
export const getCase = async (id: string, sessionId?: string): Promise<Case> => {
  return sharedQuickApi.getCase(id, sessionId) as Promise<Case>;
};

/**
 * 通過Session ID獲取案件（快速體驗模式）
 */
export const getCaseBySessionId = async (sessionId: string): Promise<Case | null> => {
  return sharedQuickApi.getCaseBySessionId(sessionId) as Promise<Case | null>;
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
  return sharedFormalCaseApi.list(params);
};

/**
 * 提交案件
 */
export const submitCase = async (id: string): Promise<Case> => {
  return sharedFormalCaseApi.submit(id) as Promise<Case>;
};

/**
 * 更新案件
 */
export const updateCase = async (id: string, data: UpdateCaseDto): Promise<Case> => {
  return sharedFormalCaseApi.update(id, data) as Promise<Case>;
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

  return sharedMediaApi.uploadEvidence(caseId, formData, sessionId) as Promise<
    Array<{ id: string; file_url: string; file_type: string }>
  >;
};

/**
 * 刪除單個證據文件（需 caseId + evidenceId）
 */
export const deleteEvidence = async (
  caseId: string,
  evidenceId: string,
  sessionId?: string
): Promise<void> => {
  await sharedMediaApi.deleteEvidence(caseId, evidenceId, sessionId);
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
  return sharedQuickApi.createCollaborativeCase(data, sessionId) as Promise<CollaborativeResponse>;
};
