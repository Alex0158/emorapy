/**
 * 執行服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * ExecutionService 符合此介面；Controller 可選改為依賴 IExecutionService 並在建構時注入。
 */

export interface CheckinDtoForInterface {
  plan_id: string;
  notes?: string;
  photos?: string[];
}

export interface IExecutionService {
  confirmExecution(userId: string, planId: string): Promise<unknown>;

  checkin(userId: string, data: CheckinDtoForInterface): Promise<unknown>;

  getExecutionStatus(userId: string, planId: string): Promise<unknown>;

  getAllExecutionStatuses(userId: string): Promise<unknown>;
}
