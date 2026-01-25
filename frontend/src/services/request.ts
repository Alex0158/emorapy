/**
 * HTTP請求封裝
 */

import axios from 'axios';
import type { AxiosInstance, AxiosResponse, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import type { ApiResponse, ApiError } from '@/types/common';
import { env } from '@/config/env';
import { sessionStorage } from '@/utils/storage';
import { requestWithRetry } from '@/utils/retry';

// 擴展 InternalAxiosRequestConfig 以支持 metadata
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: {
    requestId?: string;
  };
}

// 創建axios實例
const request: AxiosInstance = axios.create({
  baseURL: env.apiBaseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求取消控制器Map（用於追蹤活躍的請求）
const cancelTokenMap = new Map<string, AbortController>();

/**
 * 取消指定的請求
 */
export const cancelRequest = (requestId: string): void => {
  const controller = cancelTokenMap.get(requestId);
  if (controller) {
    controller.abort();
    cancelTokenMap.delete(requestId);
  }
};

/**
 * 取消所有活躍的請求
 */
export const cancelAllRequests = (): void => {
  cancelTokenMap.forEach((controller) => {
    controller.abort();
  });
  cancelTokenMap.clear();
};

/**
 * 為請求添加取消支持
 */
const addCancelToken = (config: InternalAxiosRequestConfig): void => {
  const extendedConfig = config as ExtendedAxiosRequestConfig;
  
  // 生成請求ID（如果未提供）
  const requestId = extendedConfig.metadata?.requestId || `${config.method}-${config.url}-${Date.now()}`;
  
  // 創建AbortController
  const controller = new AbortController();
  extendedConfig.signal = controller.signal;
  extendedConfig.metadata = { ...extendedConfig.metadata, requestId };
  
  // 保存controller以便後續取消
  cancelTokenMap.set(requestId, controller);
  
  // 請求完成後清理（成功或失敗都會執行）
  const cleanup = () => {
    cancelTokenMap.delete(requestId);
  };
  
  // 監聽請求完成
  if (controller.signal) {
    controller.signal.addEventListener('abort', cleanup);
  }
};

/**
 * 帶重試的請求方法（用於關鍵操作）
 */
export const requestWithRetryWrapper = async <T = any>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  return requestWithRetry(
    () => request(config),
    {
      maxRetries: 3,
      initialDelay: 1000,
      shouldRetry: (error: any) => {
        // 只對網絡錯誤和5xx錯誤重試
        if (error.code === 'NETWORK_ERROR' || !error.response) {
          return true;
        }
        if (error.response?.status >= 500) {
          return true;
        }
        return false;
      },
    }
  );
};

// 請求攔截器
request.interceptors.request.use(
  async (config) => {
    // 添加請求取消支持
    addCancelToken(config);
    
    // 添加認證Token（如果存在）
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 注意：快速體驗的 Session ID 同時是案件/判決授權憑證
    // 不應在全局攔截器中自動刷新 Session，避免覆蓋舊 session_id 造成舊案件無法訪問

    // 添加Session ID（快速體驗模式）
    const sessionId = sessionStorage.get();
    if (sessionId && !config.headers['X-Session-Id']) {
      config.headers['X-Session-Id'] = sessionId;
      // 同時添加到查詢參數（後端可能從查詢參數讀取）
      if (config.params) {
        config.params.session_id = sessionId;
      } else {
        config.params = { session_id: sessionId };
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 響應攔截器
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // 請求完成後清理取消控制器
    const requestId = (response.config as any).metadata?.requestId;
    if (requestId) {
      cancelTokenMap.delete(requestId);
    }
    const { data } = response;

    // 後端已統一返回ApiResponse格式
    if (data && typeof data === 'object' && 'success' in data) {
      // 如果成功，直接返回
      if (data.success) {
        return response;
      }
      // 如果失敗，轉換為錯誤
      return Promise.reject({
        code: (data as any).error?.code || 'API_ERROR',
        message: (data as any).error?.message || '請求失敗',
        details: (data as any).error?.details,
      });
    }

    // 兼容直接返回數據的情況（舊版本兼容）
    return {
      ...response,
      data: { success: true, data } as ApiResponse,
    };
  },
  async (error: AxiosError<ApiError>) => {
    // 請求完成後清理取消控制器
    const requestId = (error.config as any)?.metadata?.requestId;
    if (requestId) {
      cancelTokenMap.delete(requestId);
    }
    
    // 如果請求被取消，不顯示錯誤消息
    if (axios.isCancel(error) || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      return Promise.reject({
        code: 'REQUEST_CANCELED',
        message: '請求已取消',
        isCanceled: true,
      });
    }
    
    const { response } = error;

    // 處理HTTP錯誤
    if (response) {
      const { status, data } = response;
      
      // 後端統一返回格式：{ success: false, error: { code, message, details } }
      const errorData = (data as any)?.error || data;

      switch (status) {
        case 401: {
          const code = errorData?.code;

          // 快速體驗 Session 過期/缺失：不導向登入頁（零門檻設計）
          if (code === 'SESSION_EXPIRED' || code === 'SESSION_ID_REQUIRED' || code === 'INVALID_SESSION_ID') {
            try {
              const { useSessionStore } = await import('@/store/sessionStore');
              // 先清理舊 Session，再嘗試換發新 Session，避免 401/403 無限循環
              useSessionStore.getState().clearSession();
              const refreshed = await useSessionStore.getState().refreshSession(true);
              if (refreshed) {
                message.warning(errorData?.message || '快速體驗 Session 已過期，已自動換發新 Session，請重新發起操作/重新開始流程');
              } else {
                message.error(errorData?.message || '快速體驗 Session 已過期，請重新開始');
              }
            } catch {
              message.error(errorData?.message || '快速體驗 Session 已過期，請重新開始');
            }
            break;
          }

          // 未認證（完整模式），清除token並跳轉到登錄頁
          localStorage.removeItem('token');
          // 使用useAuthStore清除狀態（如果可用）
          try {
            // 動態導入避免循環依賴
            import('@/store/authStore').then(({ useAuthStore }) => {
              useAuthStore.getState().logout();
            }).catch(() => {
              // Store可能未初始化，忽略
            });
          } catch {
            // 忽略錯誤
          }
          if (window.location.pathname !== '/auth/login') {
            window.location.href = '/auth/login';
          }
          message.error(errorData?.message || '登錄已過期，請重新登錄');
          break;
        }

        case 403:
          message.error(errorData?.message || '無權限訪問此資源');
          break;

        case 404:
          message.error(errorData?.message || '資源不存在');
          break;

        case 422:
          message.error(errorData?.message || '請求參數錯誤');
          break;

        case 429:
          if ((response.config?.url || '').includes('/uploads')) {
            message.error(errorData?.message || '文件訪問過於頻繁，請稍後再試');
          } else {
            message.error(errorData?.message || '請求過於頻繁，請稍後再試');
          }
          break;

        case 500:
        default:
          message.error(errorData?.message || '服務器錯誤，請稍後再試');
      }

      return Promise.reject({
        code: errorData?.code || `HTTP_${status}`,
        message: errorData?.message || error.message,
        details: errorData?.details,
      });
    }

    // 網絡錯誤
    if (error.request) {
      message.error('網絡連接失敗，請檢查網絡連接');
      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: '網絡連接失敗',
      });
    }

    // 其他錯誤
    message.error('發生未知錯誤');
    return Promise.reject({
      code: 'UNKNOWN_ERROR',
      message: error.message,
    });
  }
);

export default request;
