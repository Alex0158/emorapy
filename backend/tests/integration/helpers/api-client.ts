/**
 * API 客戶端 - 模擬前端 HTTP 請求行為
 * 
 * 用於集成測試，封裝所有與後端 API 的交互
 */

import request from 'supertest';
import type { Application } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
}

export interface Session {
  session_id: string;
  expires_at: string;
}

export interface QuickCaseRequest {
  plaintiff_statement: string;
  defendant_statement: string;
  evidence_urls?: string[];
}

export interface CollaborativeCaseRequest {
  case_id?: string;
  plaintiff_statement?: string;
  defendant_statement?: string;
}

export interface QuickCaseResponse {
  case: {
    id: string;
    title: string;
    type: string;
    status: string;
    plaintiff_statement: string;
    defendant_statement: string;
    session_id: string;
    mode: string;
    pairing_id: string;
    created_at: string;
    submitted_at: string;
  };
  session_id: string;
  session_expires_at?: string;
}

export interface CollaborativeCaseResponse {
  case: {
    id: string;
    title: string;
    type: string;
    status: string;
    plaintiff_statement: string;
    defendant_statement?: string | null;
    session_id: string;
    mode: string;
    pairing_id: string;
    created_at: string;
    submitted_at?: string | null;
  };
  session_id: string;
  session_expires_at?: string;
  phase: 'a_done' | 'submitted';
}

export interface Judgment {
  id: string;
  case_id: string;
  judgment_content: string;
  summary: string;
  plaintiff_ratio: number;
  defendant_ratio: number;
  // 向後兼容
  responsibility_ratio?: {
    plaintiff: number;
    defendant: number;
  };
  ai_model: string;
  prompt_version: string;
  created_at: string;
}

export interface Evidence {
  id: string;
  file_url: string;
  file_type: string;
  file_size: number;
}

/**
 * API 客戶端類
 * 
 * 模擬前端與後端 API 的完整交互流程
 */
export class ApiClient {
  private app: Application;
  private sessionId: string | null = null;
  private baseUrl = '/api/v1';

  constructor(app: Application) {
    this.app = app;
  }

  /**
   * 設置 Session ID（模擬前端存儲）
   */
  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  /**
   * 獲取當前 Session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * 創建通用請求頭
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.sessionId) {
      headers['X-Session-Id'] = this.sessionId;
    }
    return headers;
  }

  // ==================== Session API ====================

  /**
   * 創建 Session（快速體驗模式）
   * POST /api/v1/sessions/quick
   */
  async createSession(): Promise<{
    response: request.Response;
    data: Session | null;
    error: ApiResponse['error'] | null;
  }> {
    const response = await request(this.app)
      .post(`${this.baseUrl}/sessions/quick`)
      .set(this.getHeaders());

    const body = response.body as ApiResponse<Session>;
    
    if (body.success && body.data) {
      // 自動保存 Session ID（模擬前端行為）
      this.sessionId = body.data.session_id;
      return { response, data: body.data, error: null };
    }
    
    return { response, data: null, error: body.error || null };
  }

  // ==================== Case API ====================

  /**
   * 創建快速體驗案件
   * POST /api/v1/cases/quick
   */
  async createQuickCase(data: QuickCaseRequest): Promise<{
    response: request.Response;
    data: QuickCaseResponse | null;
    error: ApiResponse['error'] | null;
  }> {
    const response = await request(this.app)
      .post(`${this.baseUrl}/cases/quick`)
      .set(this.getHeaders())
      .send(data);

    const body = response.body as ApiResponse<QuickCaseResponse>;
    
    if (body.success && body.data) {
      // 如果後端返回新的 session_id，更新本地存儲
      if (body.data.session_id) {
        this.sessionId = body.data.session_id;
      }
      return { response, data: body.data, error: null };
    }
    
    return { response, data: null, error: body.error || null };
  }

  /**
   * 創建/更新協作聽證案件
   * POST /api/v1/cases/collaborative
   */
  async createCollaborativeCase(data: CollaborativeCaseRequest): Promise<{
    response: request.Response;
    data: CollaborativeCaseResponse | null;
    error: ApiResponse['error'] | null;
  }> {
    const response = await request(this.app)
      .post(`${this.baseUrl}/cases/collaborative`)
      .set(this.getHeaders())
      .send(data);

    const body = response.body as ApiResponse<CollaborativeCaseResponse>;

    if (body.success && body.data) {
      if (body.data.session_id) {
        this.sessionId = body.data.session_id;
      }
      return { response, data: body.data, error: null };
    }

    return { response, data: null, error: body.error || null };
  }

  /**
   * 獲取案件詳情
   * GET /api/v1/cases/:id
   */
  async getCase(caseId: string): Promise<{
    response: request.Response;
    data: QuickCaseResponse['case'] | null;
    error: ApiResponse['error'] | null;
  }> {
    const url = this.sessionId 
      ? `${this.baseUrl}/cases/${caseId}?session_id=${this.sessionId}`
      : `${this.baseUrl}/cases/${caseId}`;
      
    const response = await request(this.app)
      .get(url)
      .set(this.getHeaders());

    const body = response.body as ApiResponse<{ case: QuickCaseResponse['case'] }>;
    
    if (body.success && body.data) {
      return { response, data: body.data.case, error: null };
    }
    
    return { response, data: null, error: body.error || null };
  }

  /**
   * 通過 Session ID 獲取案件
   * GET /api/v1/cases/by-session
   */
  async getCaseBySession(): Promise<{
    response: request.Response;
    data: QuickCaseResponse['case'] | null;
    error: ApiResponse['error'] | null;
  }> {
    if (!this.sessionId) {
      throw new Error('Session ID not set');
    }

    const response = await request(this.app)
      .get(`${this.baseUrl}/cases/by-session?session_id=${this.sessionId}`)
      .set(this.getHeaders());

    const body = response.body as ApiResponse<{ case: QuickCaseResponse['case'] }>;
    
    if (body.success && body.data) {
      return { response, data: body.data.case, error: null };
    }
    
    return { response, data: null, error: body.error || null };
  }

  // ==================== Judgment API ====================

  /**
   * 獲取案件判決
   * GET /api/v1/cases/:id/judgment
   */
  async getJudgmentByCaseId(caseId: string): Promise<{
    response: request.Response;
    data: Judgment | null;
    error: ApiResponse['error'] | null;
    isPending: boolean;
  }> {
    const url = this.sessionId 
      ? `${this.baseUrl}/cases/${caseId}/judgment?session_id=${this.sessionId}`
      : `${this.baseUrl}/cases/${caseId}/judgment`;
      
    const response = await request(this.app)
      .get(url)
      .set(this.getHeaders());

    const body = response.body as ApiResponse<{ judgment: Judgment }>;
    
    // 判決生成中返回 202
    if (response.status === 202) {
      return { 
        response, 
        data: null, 
        error: body.error || null,
        isPending: true 
      };
    }
    
    if (body.success && body.data) {
      return { response, data: body.data.judgment, error: null, isPending: false };
    }
    
    return { response, data: null, error: body.error || null, isPending: false };
  }

  /**
   * 重新生成判決
   * POST /api/v1/judgments/generate/:caseId
   */
  async regenerateJudgment(caseId: string): Promise<{
    response: request.Response;
    data: Judgment | null;
    error: ApiResponse['error'] | null;
  }> {
    const response = await request(this.app)
      .post(`${this.baseUrl}/judgments/generate/${caseId}`)
      .set(this.getHeaders());

    const body = response.body as ApiResponse<{ judgment: Judgment }>;
    
    if (body.success && body.data) {
      return { response, data: body.data.judgment, error: null };
    }
    
    return { response, data: null, error: body.error || null };
  }

  // ==================== Evidence API ====================

  /**
   * 上傳證據
   * POST /api/v1/cases/:id/evidence
   */
  async uploadEvidence(caseId: string, files: Buffer[], filenames: string[]): Promise<{
    response: request.Response;
    data: Evidence[] | null;
    error: ApiResponse['error'] | null;
  }> {
    let req = request(this.app)
      .post(`${this.baseUrl}/cases/${caseId}/evidence`);
    
    if (this.sessionId) {
      req = req.query({ session_id: this.sessionId });
      req = req.set('X-Session-Id', this.sessionId);
    }

    // 添加文件
    for (let i = 0; i < files.length; i++) {
      req = req.attach('files', files[i], filenames[i]);
    }

    const response = await req;
    const body = response.body as ApiResponse<{ evidences: Evidence[] }>;
    
    if (body.success && body.data) {
      return { response, data: body.data.evidences, error: null };
    }
    
    return { response, data: null, error: body.error || null };
  }

  // ==================== 輪詢輔助方法 ====================

  /**
   * 輪詢判決直到生成完成或超時
   * 
   * @param caseId - 案件 ID
   * @param options - 輪詢選項
   * @returns 判決結果或 null（超時）
   */
  async pollJudgment(
    caseId: string,
    options: {
      maxAttempts?: number;
      intervalMs?: number;
      onPending?: (attempt: number) => void;
    } = {}
  ): Promise<{
    judgment: Judgment | null;
    attempts: number;
    timedOut: boolean;
    error: ApiResponse['error'] | null;
  }> {
    const { 
      maxAttempts = 30, 
      intervalMs = 1000,
      onPending 
    } = options;

    let attempts = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      const result = await this.getJudgmentByCaseId(caseId);
      
      if (result.data) {
        return { 
          judgment: result.data, 
          attempts, 
          timedOut: false,
          error: null 
        };
      }
      
      // 非 pending 狀態的錯誤（如 JUDGMENT_FAILED）
      if (!result.isPending && result.error) {
        return {
          judgment: null,
          attempts,
          timedOut: false,
          error: result.error
        };
      }
      
      if (onPending) {
        onPending(attempts);
      }
      
      // 等待下一次輪詢
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    return { 
      judgment: null, 
      attempts, 
      timedOut: true,
      error: null 
    };
  }
}

/**
 * 創建 API 客戶端實例
 */
export function createApiClient(app: Application): ApiClient {
  return new ApiClient(app);
}
