/**
 * 案件服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * CaseService 符合此介面；Controller 可選改為依賴 ICaseService 並在建構時注入。
 */
import type { CreateCaseDto } from '../types/case.types';

/** 快速體驗創建案件 DTO（與 case.service QuickCaseDto 對齊） */
export interface QuickCaseDtoForInterface {
  plaintiff_statement: string;
  defendant_statement?: string;
  evidence_urls?: string[];
}

export type CaseListParams = {
  status?: string;
  type?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  search?: string;
};

export type CaseListResult = {
  cases: unknown[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
};

export interface ICaseService {
  createQuickCase(
    data: QuickCaseDtoForInterface,
    sessionId: string | null
  ): Promise<{ case: unknown; sessionId: string; sessionExpiresAt: Date }>;

  createCase(userId: string, data: CreateCaseDto): Promise<unknown>;

  getCaseList(userId: string, params?: CaseListParams): Promise<CaseListResult>;

  submitCase(caseId: string, userId: string): Promise<unknown>;

  updateCase(caseId: string, userId: string, data: Partial<CreateCaseDto>): Promise<unknown>;

  getCaseById(caseId: string, userId?: string, sessionId?: string): Promise<unknown>;

  getCaseBySessionId(sessionId: string): Promise<unknown>;
}
