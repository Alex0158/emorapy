/**
 * HTTP請求封裝
 */

import { message } from "antd";
import type {
	AxiosError,
	AxiosInstance,
	AxiosRequestConfig,
	AxiosResponse,
	InternalAxiosRequestConfig,
} from "axios";
import axios from "axios";
import { env } from "@/config/env";
import type { ApiError, ApiResponse } from "@/types/common";
import { getAdminLoginUrl } from "@/utils/adminEntry";
import { getLocale, t } from "@/utils/i18n";
import { requestWithRetry } from "@/utils/retry";
import { triggerRequestLogout } from "@/services/requestAuthBridge";
import {
	cancelAllRequests as cancelAllRequestsInternal,
	cancelRequest as cancelRequestInternal,
	registerCancelableRequest,
	unregisterCancelableRequest,
} from "@/services/requestCancel";
import { sessionStorage as quickSessionStorage } from "@/utils/storage";

// 擴展 InternalAxiosRequestConfig 以支持 metadata
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
	metadata?: {
		requestId?: string;
	};
}

// 後端錯誤響應體（success: false 時）
interface ApiErrorResponseBody {
	success: false;
	error?: ApiError;
}

function getFailedRequestSessionId(
	config?: { params?: Record<string, unknown>; headers?: Record<string, unknown> },
): string | undefined {
	const sessionIdFromParams = config?.params?.session_id;
	if (typeof sessionIdFromParams === "string" && sessionIdFromParams) {
		return sessionIdFromParams;
	}

	const headers = config?.headers ?? {};
	const headerValue =
		headers["X-Session-Id"] ??
		headers["x-session-id"];

	return typeof headerValue === "string" && headerValue ? headerValue : undefined;
}

function safeNavigate(url: string): void {
	if (
		typeof navigator !== "undefined" &&
		typeof navigator.userAgent === "string" &&
		navigator.userAgent.toLowerCase().includes("jsdom")
	) {
		return;
	}
	try {
		window.location.href = url;
	} catch {
		// 在測試環境或受限執行環境下，導航 API 可能不可用；忽略不影響主流程
	}
}

function isAdminApiRequest(url: string): boolean {
	const trimmed = url.trim();
	if (!trimmed) return false;
	if (trimmed.startsWith("/admin") || trimmed.startsWith("/api/v1/admin")) return true;
	try {
		const parsed = new URL(trimmed);
		return (
			parsed.pathname.startsWith("/admin") ||
			parsed.pathname.startsWith("/api/v1/admin")
		);
	} catch {
		return false;
	}
}

function shouldResetAdminSessionOn401(errorCode?: string): boolean {
	// 登入失敗（帳密錯）不應觸發全域 admin token 清理與導轉，避免覆蓋頁面內錯誤提示。
	if (errorCode === "INVALID_CREDENTIALS") return false;
	return true;
}

// 創建axios實例
const request: AxiosInstance = axios.create({
	baseURL: env.apiBaseURL,
	timeout: 30000,
	headers: {
		"Content-Type": "application/json",
	},
});

/**
 * 取消指定的請求
 */
export const cancelRequest = (requestId: string): void => {
	cancelRequestInternal(requestId);
};

/**
 * 取消所有活躍的請求
 */
export const cancelAllRequests = (): void => {
	cancelAllRequestsInternal();
};

/**
 * 為請求添加取消支持
 */
const addCancelToken = (config: InternalAxiosRequestConfig): void => {
	const extendedConfig = config as ExtendedAxiosRequestConfig;

	// 生成請求ID（如果未提供）
	const requestId =
		extendedConfig.metadata?.requestId ||
		`${config.method}-${config.url}-${Date.now()}`;

	// 創建AbortController
	const controller = new AbortController();
	extendedConfig.signal = controller.signal;
	extendedConfig.metadata = { ...extendedConfig.metadata, requestId };

	// 保存controller以便後續取消
	registerCancelableRequest(requestId, controller);

	// 請求完成後清理（成功或失敗都會執行）
	const cleanup = () => {
		unregisterCancelableRequest(requestId);
	};

	// 監聽請求完成
	if (controller.signal) {
		controller.signal.addEventListener("abort", cleanup);
	}
};

/**
 * 帶重試的請求方法（用於關鍵操作）
 */
export const requestWithRetryWrapper = async <T = unknown>(
	config: AxiosRequestConfig,
): Promise<AxiosResponse<T>> => {
	return requestWithRetry(() => request(config), {
		maxRetries: 3,
		initialDelay: 1000,
		shouldRetry: (error: unknown) => {
			// 只對網絡錯誤和5xx錯誤重試
			const err = error as { code?: string; response?: { status?: number } };
			if (err.code === "NETWORK_ERROR" || !err.response) {
				return true;
			}
			const status = err.response?.status;
			if (status !== undefined && status >= 500) {
				return true;
			}
			return false;
		},
	});
};

// 請求攔截器
request.interceptors.request.use(
	async (config) => {
		// 添加請求取消支持
		addCancelToken(config);

		// 添加認證 Token（如果呼叫端已自行指定 Authorization，則不覆蓋）
		let token: string | null = null;
		try {
			token = localStorage.getItem("token") || window.sessionStorage.getItem("token");
		} catch {
			/* noop */
		}
		const requestUrl = String(config.url || "");
		const isAdminRequest = isAdminApiRequest(requestUrl);
		if (!config.headers.Authorization && token && !isAdminRequest) {
			config.headers.Authorization = `Bearer ${token}`;
		}

		// 注意：快速體驗的 Session ID 同時是案件/判決授權憑證
		// 不應在全局攔截器中自動刷新 Session，避免覆蓋舊 session_id 造成舊案件無法訪問

		// 添加Session ID（快速體驗模式）
		const sessionId = quickSessionStorage.get();
		if (sessionId && !config.headers["X-Session-Id"]) {
			config.headers["X-Session-Id"] = sessionId;
		}

		// 跟隨前端語言設定，讓後端錯誤與提示文案可同步切換
		config.headers["X-Locale"] = getLocale();

		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

// 響應攔截器
request.interceptors.response.use(
	(response: AxiosResponse<ApiResponse>) => {
		// 請求完成後清理取消控制器
		const requestId = (response.config as ExtendedAxiosRequestConfig).metadata
			?.requestId;
		if (requestId) {
			unregisterCancelableRequest(requestId);
		}
		const { data } = response;

		// 後端已統一返回ApiResponse格式
		if (data && typeof data === "object" && "success" in data) {
			// 如果成功，直接返回
			if (data.success) {
				return response;
			}
			// 如果失敗，轉換為錯誤
			const errBody = data as ApiErrorResponseBody;
			const err = errBody.error;
			return Promise.reject({
				code: err?.code || "API_ERROR",
				message: err?.message || t("common.requestFail"),
				details: err?.details,
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
		const requestId = (error.config as ExtendedAxiosRequestConfig | undefined)
			?.metadata?.requestId;
		if (requestId) {
			unregisterCancelableRequest(requestId);
		}

		// 如果請求被取消，不顯示錯誤消息
		if (
			axios.isCancel(error) ||
			error.name === "AbortError" ||
			error.code === "ERR_CANCELED"
		) {
			return Promise.reject({
				code: "REQUEST_CANCELED",
				message: t("common.requestCanceled"),
				isCanceled: true,
			});
		}

		const { response } = error;

		// 處理HTTP錯誤
		if (response) {
			const { status, data } = response;

			// 後端統一返回格式：{ success: false, error: { code, message, details } }
			const errBody = data as unknown as ApiErrorResponseBody | undefined;
			type ErrorLike = { code?: string; message?: string; details?: unknown };
			const errorData: ErrorLike =
				(errBody?.error as ErrorLike) ??
				(typeof data === "object" && data !== null ? (data as ErrorLike) : {});

			switch (status) {
				case 400: {
					const code = errorData?.code;
					if (code === "SESSION_ID_REQUIRED" || code === "INVALID_SESSION_ID") {
						try {
							const { useSessionStore } = await import("@/store/sessionStore");
							const staleSessionId = getFailedRequestSessionId(response.config);
							useSessionStore.getState().clearSession();
							const refreshed = await useSessionStore
								.getState()
								.refreshSession(true, staleSessionId);
							if (refreshed) {
								message.warning(
									errorData?.message || t("common.sessionExpiredRefreshed"),
								);
							} else {
								message.error(
									errorData?.message || t("error.session.expiredHint"),
								);
							}
						} catch {
							message.error(
								errorData?.message || t("error.session.expiredHint"),
							);
						}
						break;
					}
					message.error(errorData?.message || t("common.validationError"));
					break;
				}

				case 401: {
					const code = errorData?.code;
          const requestUrl = String(response.config?.url || "");
          const isAdminRequest = isAdminApiRequest(requestUrl);

					// 快速體驗 Session 過期/缺失：不導向登入頁（零門檻設計）
					if (
						code === "SESSION_EXPIRED" ||
						code === "SESSION_ID_REQUIRED" ||
						code === "INVALID_SESSION_ID"
					) {
						try {
							const { useSessionStore } = await import("@/store/sessionStore");
							// 先清理舊 Session，再嘗試換發新 Session，避免 401/403 無限循環
							const staleSessionId = getFailedRequestSessionId(response.config);
							useSessionStore.getState().clearSession();
							const refreshed = await useSessionStore
								.getState()
								.refreshSession(true, staleSessionId);
							if (refreshed) {
								message.warning(
									errorData?.message || t("common.sessionExpiredRefreshed"),
								);
							} else {
								message.error(
									errorData?.message || t("error.session.expiredHint"),
								);
							}
						} catch {
							message.error(
								errorData?.message || t("error.session.expiredHint"),
							);
						}
						break;
					}

          // Admin API 401：僅在 token/session 失效類錯誤時清理 admin token。
          if (isAdminRequest && shouldResetAdminSessionOn401(code)) {
            try {
              localStorage.removeItem("admin_token");
              window.sessionStorage.removeItem("admin_token");
              window.dispatchEvent(new Event("admin-token-changed"));
            } catch {
              // 忽略 storage 例外，避免覆蓋原始錯誤處理鏈
            }
            const adminLoginUrl = getAdminLoginUrl();
            if (window.location.pathname.startsWith('/admin')) {
              if (adminLoginUrl) {
                safeNavigate(adminLoginUrl);
              } else {
                message.error(t("admin.login.urlMissing"));
              }
            }
          } else {
            // 非 Admin API 401：維持原有前台 user token 清理流程
					  localStorage.removeItem("token");
					  window.sessionStorage.removeItem("token");
					  triggerRequestLogout();
					  if (window.location.pathname !== "/auth/login") {
						  safeNavigate("/auth/login");
					  }
          } 
          // Admin API 的 401 由頁面門禁/導轉處理，避免與頁面錯誤提示重複彈窗。
          if (!isAdminRequest) {
					  message.error(errorData?.message || t("common.unauthorized"));
          }
					break;
				}

				case 403:
          if (!isAdminApiRequest(String(response.config?.url || ""))) {
					  message.error(errorData?.message || t("common.forbidden"));
          }
					break;

				case 404: {
					const url = (response.config?.url ?? "") as string;
					const params = response.config?.params as
						| { session_id?: string }
						| undefined;
					const hasSession = !!(
						params?.session_id ?? response.config?.headers?.["X-Session-Id"]
					);
					if (url.includes("by-session")) {
						// 快速體驗「找回案件」無案件時 404 屬正常，不彈窗
						break;
					}
					if (url.includes("/cases/") && hasSession) {
						// 快速體驗 GET /cases/:id 404（案件不存在或已過期），由結果頁處理，不全局彈窗
						break;
					}
					message.error(errorData?.message || t("common.notFound"));
					break;
				}

				case 409: {
					const url = (response.config?.url ?? "") as string;
					if (
						url.includes("/judgment") &&
						errorData?.code === "JUDGMENT_FAILED"
					) {
						// 快速體驗結果頁會自行顯示重試，不全局彈窗
						break;
					}
					message.error(errorData?.message || t("common.conflict"));
					break;
				}

				case 422:
					message.error(errorData?.message || t("common.validationError"));
					break;

				case 413:
					message.error(errorData?.message || t("common.fileTooLarge"));
					break;

				case 429:
					if ((response.config?.url || "").includes("/uploads")) {
						message.error(errorData?.message || t("common.fileRateLimit"));
					} else {
						message.error(errorData?.message || t("common.rateLimit"));
					}
					break;

				case 503:
					message.error(errorData?.message || t("common.serviceUnavailable"));
					break;

				case 500:
				default:
					message.error(errorData?.message || t("common.serverError"));
			}

			return Promise.reject({
				code: errorData?.code || `HTTP_${status}`,
				message: errorData?.message || error.message,
				details: errorData?.details,
			});
		}

		// 網絡錯誤
		if (error.request) {
			message.error(t("common.networkError"));
			return Promise.reject({
				code: "NETWORK_ERROR",
				message: t("common.networkError"),
			});
		}

		// 其他錯誤
		message.error(t("common.unknownError"));
		return Promise.reject({
			code: "UNKNOWN_ERROR",
			message: error.message,
		});
	},
);

export default request;
