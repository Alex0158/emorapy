import type { InternalAxiosRequestConfig } from "axios";
import type { ApiError } from "@/types/common";

export interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
	metadata?: {
		requestId?: string;
		suppressGlobalSessionToast?: boolean;
	};
}

interface ApiErrorResponseBody {
	success: false;
	error?: ApiError;
}

export type HttpErrorData = {
	code?: string;
	message?: string;
	details?: unknown;
};

type RequestConfigLike = {
	url?: string;
	params?: unknown;
	headers?: unknown;
};

function readStringProperty(source: unknown, key: string): string | undefined {
	if (!source || typeof source !== "object") return undefined;
	const value = (source as Record<string, unknown>)[key];
	return typeof value === "string" && value ? value : undefined;
}

export function getFailedRequestSessionId(
	config?: RequestConfigLike,
): string | undefined {
	const sessionIdFromParams = readStringProperty(config?.params, "session_id");
	if (sessionIdFromParams) return sessionIdFromParams;

	return (
		readStringProperty(config?.headers, "X-Session-Id") ??
		readStringProperty(config?.headers, "x-session-id")
	);
}

export function safeNavigate(url: string): void {
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

export function isAdminApiRequest(url: string): boolean {
	const trimmed = url.trim();
	if (!trimmed) return false;
	if (trimmed.startsWith("/admin") || trimmed.startsWith("/api/v1/admin")) {
		return true;
	}
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

export function shouldResetAdminSessionOn401(errorCode?: string): boolean {
	// 登入失敗（帳密錯）不應觸發全域 admin token 清理與導轉，避免覆蓋頁面內錯誤提示。
	return errorCode !== "INVALID_CREDENTIALS";
}

export function clearAdminSessionStorage(): void {
	try {
		localStorage.removeItem("admin_token");
		window.sessionStorage.removeItem("admin_token");
		window.dispatchEvent(new Event("admin-token-changed"));
	} catch {
		// 忽略 storage 例外，避免覆蓋原始錯誤處理鏈
	}
}

export function isRecoverableSessionErrorCode(code?: string): boolean {
	return (
		code === "SESSION_EXPIRED" ||
		code === "SESSION_ID_REQUIRED" ||
		code === "INVALID_SESSION_ID"
	);
}

export function getHttpErrorData(data: unknown): HttpErrorData {
	const errBody = data as ApiErrorResponseBody | undefined;
	if (errBody?.error) return errBody.error;
	return typeof data === "object" && data !== null
		? (data as HttpErrorData)
		: {};
}

export function hasSessionCredential(config?: RequestConfigLike): boolean {
	return Boolean(
		readStringProperty(config?.params, "session_id") ??
			readStringProperty(config?.headers, "X-Session-Id") ??
			readStringProperty(config?.headers, "x-session-id"),
	);
}

export function shouldSuppressNotFoundToast(config?: RequestConfigLike): boolean {
	const url = config?.url ?? "";
	if (url.includes("by-session")) return true;
	return url.includes("/cases/") && hasSessionCredential(config);
}

export function shouldSuppressConflictToast(
	config: RequestConfigLike | undefined,
	errorCode?: string,
): boolean {
	return Boolean(
		config?.url?.includes("/judgment") && errorCode === "JUDGMENT_FAILED",
	);
}

export function isUploadRequest(config?: RequestConfigLike): boolean {
	return Boolean(config?.url?.includes("/uploads"));
}
