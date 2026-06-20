/**
 * 判決API
 */

import request from '../request';
import { createM4ApiClient } from '@emorapy/api-client';
import type { Judgment, AcceptJudgmentDto } from '@/types/judgment';

const sharedJudgmentApi = createM4ApiClient(request).judgment;

/**
 * 生成判決（手動觸發/重試）
 * @param caseId 案件ID
 * @param sessionId 可選，快速體驗時指定案件對應的 Session（用於多案件回訪）
 */
export const generateJudgment = async (
  caseId: string,
  sessionId?: string
): Promise<Judgment> => {
  return sharedJudgmentApi.generate(caseId, sessionId) as Promise<Judgment>;
};

/**
 * 獲取判決詳情
 */
export const getJudgment = async (id: string): Promise<Judgment> => {
  return sharedJudgmentApi.get(id) as Promise<Judgment>;
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
  return sharedJudgmentApi.getByCaseId(caseId, sessionId) as Promise<Judgment | null>;
};


/**
 * 接受/拒絕判決
 */
export const acceptJudgment = async (
  id: string,
  data: AcceptJudgmentDto
): Promise<Judgment> => {
  return sharedJudgmentApi.accept(id, data) as Promise<Judgment>;
};
