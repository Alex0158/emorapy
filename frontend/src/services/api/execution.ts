/**
 * 執行API
 */

import request from '../request';
import type { ApiResponse } from '@/types/common';

export interface ExecutionRecord {
  id: string;
  reconciliation_plan_id: string;
  user_id: string;
  action: 'confirm' | 'checkin' | 'complete' | 'skip';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  notes?: string;
  photos_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface ExecutionStatus {
  plan_id: string;
  status: string;
  records: ExecutionRecord[];
  progress: number;
}

export interface CheckinDto {
  plan_id: string;
  notes?: string;
  photos?: string[];
}

/**
 * 確認執行
 */
export const confirmExecution = async (planId: string): Promise<ExecutionRecord> => {
  const response = await request.post<ApiResponse<{ execution: ExecutionRecord }>>(
    '/execution/confirm',
    { plan_id: planId }
  );
  return (response.data as ApiResponse<{ execution: ExecutionRecord }>).data.execution;
};

/**
 * 執行打卡
 */
export const checkin = async (data: CheckinDto): Promise<ExecutionRecord> => {
  const response = await request.post<ApiResponse<{ execution: ExecutionRecord }>>(
    '/execution/checkin',
    data
  );
  return (response.data as ApiResponse<{ execution: ExecutionRecord }>).data.execution;
};

/**
 * 獲取執行狀態
 */
export const getExecutionStatus = async (planId: string): Promise<ExecutionStatus> => {
  const response = await request.get<ApiResponse<ExecutionStatus>>(
    `/execution/status?plan_id=${planId}`
  );
  return (response.data as ApiResponse<ExecutionStatus>).data;
};

/**
 * 獲取所有執行狀態（用於執行看板）
 */
export const getAllExecutionStatuses = async (): Promise<ExecutionStatus[]> => {
  const response = await request.get<ApiResponse<{ executions: ExecutionStatus[] }>>(
    '/execution/dashboard'
  );
  return (response.data as ApiResponse<{ executions: ExecutionStatus[] }>).data.executions;
};

