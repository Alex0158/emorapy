/**
 * 判決API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';
import type { Judgment, AcceptJudgmentDto } from '@/types/judgment';

/**
 * 生成判決（手動觸發/重試）
 * @param caseId 案件ID
 * @param sessionId 可選，快速體驗時指定案件對應的 Session（用於多案件回訪）
 */
export const generateJudgment = async (
  caseId: string,
  sessionId?: string
): Promise<Judgment> => {
  const config = sessionId
    ? { headers: { 'X-Session-Id': sessionId } as Record<string, string> }
    : undefined;
  const response = await request.post<ApiResponse<{ judgment: Judgment }>>(
    `/judgments/generate/${caseId}`,
    undefined,
    config
  );
  const result = (response.data as ApiResponse<{ judgment: Judgment }>)?.data?.judgment;
  if (!result) throw new Error('Invalid judgment response from server');
  return result;
};

/**
 * 獲取判決詳情
 */
export const getJudgment = async (id: string): Promise<Judgment> => {
  const response = await request.get<ApiResponse<{ judgment: Judgment }>>(`/judgments/${id}`);
  const result = (response.data as ApiResponse<{ judgment: Judgment }>)?.data?.judgment;
  if (!result) throw new Error('Invalid judgment response from server');
  return result;
};

/**
 * 通過案件ID獲取判決（便捷方式，內部會查詢判決ID）
 * @param caseId 案件ID
 * @param sessionId 可選，快速體驗時指定案件對應的 Session（用於多案件回訪）
 */
export const getJudgmentByCaseId = async (
  caseId: string,
  sessionId?: string
): Promise<Judgment | null> => {
  try {
    const config = sessionId
      ? { headers: { 'X-Session-Id': sessionId } as Record<string, string> }
      : undefined;
    const response = await request.get<ApiResponse<{ judgment: Judgment }>>(
      `/cases/${caseId}/judgment`,
      config
    );
    return (response.data as ApiResponse<{ judgment: Judgment }>)?.data?.judgment ?? null;
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'JUDGMENT_PENDING' || err.code === 'JUDGMENT_NOT_FOUND' || err.code === 'HTTP_404') {
      return null;
    }
    throw error;
  }
};


/**
 * 接受/拒絕判決
 */
export const acceptJudgment = async (
  id: string,
  data: AcceptJudgmentDto
): Promise<Judgment> => {
  const response = await request.post<ApiResponse<{ judgment: Judgment }>>(
    `/judgments/${id}/accept`,
    data
  );
  const result = (response.data as ApiResponse<{ judgment: Judgment }>)?.data?.judgment;
  if (!result) throw new Error('Invalid judgment response from server');
  return result;
};

