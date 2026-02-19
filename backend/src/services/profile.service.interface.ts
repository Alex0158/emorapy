/**
 * 個人/關係檔案服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * ProfileService 符合此介面；Controller 可選改為依賴 IProfileService 並在建構時注入。
 */

export interface IProfileService {
  getUserProfile(userId: string): Promise<unknown>;

  upsertUserProfile(userId: string, data: Record<string, unknown>): Promise<unknown>;

  getRelationshipProfile(pairingId: string, userId: string): Promise<unknown>;

  upsertRelationshipProfile(
    pairingId: string,
    userId: string,
    data: Record<string, unknown>
  ): Promise<unknown>;
}
