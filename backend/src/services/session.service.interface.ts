/**
 * Session 服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * SessionService 符合此介面；Controller 可選改為依賴 ISessionService 並在建構時注入。
 */

export interface ISessionService {
  createSession(): Promise<{ session_id: string; expires_at: Date }>;

  getSession(sessionId: string): Promise<unknown>;
}
