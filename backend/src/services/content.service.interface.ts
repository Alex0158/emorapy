/**
 * 內容服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * ContentService 符合此介面；Controller 可選改為依賴 IContentService 並在建構時注入。
 */

export interface ListContentOptions {
  type?: string;
  tags?: string[];
  language?: string;
  is_active?: boolean;
  limit?: number;
}

export interface IContentService {
  listContent(options: ListContentOptions): Promise<unknown[]>;

  getRecommendations(caseId: string, relation?: string): Promise<unknown[]>;

  linkContent(caseId: string, contentId: string, relation?: string): Promise<unknown>;
}
