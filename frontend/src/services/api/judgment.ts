/**
 * 判決API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';
import type { Judgment, AcceptJudgmentDto } from '@/types/judgment';

/**
 * 生成判決
 */
export const generateJudgment = async (caseId: string): Promise<Judgment> => {
  const response = await request.post<ApiResponse<{ judgment: Judgment }>>(
    `/judgments/generate/${caseId}`
  );
  return (response.data as ApiResponse<{ judgment: Judgment }>).data.judgment;
};

/**
 * 獲取判決詳情
 */
export const getJudgment = async (id: string): Promise<Judgment> => {
  const response = await request.get<ApiResponse<{ judgment: Judgment }>>(`/judgments/${id}`);
  return (response.data as ApiResponse<{ judgment: Judgment }>).data.judgment;
};

/**
 * 通過案件ID獲取判決（便捷方式，內部會查詢判決ID）
 */
export const getJudgmentByCaseId = async (caseId: string): Promise<Judgment | null> => {
  try {
    // 先嘗試通過案件ID獲取判決
    const response = await request.get<ApiResponse<{ judgment: Judgment }>>(
      `/cases/${caseId}/judgment`
    );
    return (response.data as ApiResponse<{ judgment: Judgment }>).data.judgment;
  } catch (error: any) {
    // 判決尚未生成：視為正常 pending（不作為錯誤）
    if (error.code === 'JUDGMENT_PENDING' || error.code === 'JUDGMENT_NOT_FOUND' || error.code === 'HTTP_404') {
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
  return (response.data as ApiResponse<{ judgment: Judgment }>).data.judgment;
};

