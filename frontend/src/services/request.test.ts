/**
 * request 單元測試
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockRequest,
	mockInterceptorsRequestUse,
	mockInterceptorsResponseUse,
	mockSessionGet,
	mockMessageError,
	mockMessageWarning,
	mockSessionStoreState,
	mockTriggerRequestLogout,
} = vi.hoisted(() => ({
	mockRequest: vi.fn(),
	mockInterceptorsRequestUse: vi.fn(),
	mockInterceptorsResponseUse: vi.fn(),
	mockSessionGet: vi.fn(() => null),
	mockMessageError: vi.fn(),
	mockMessageWarning: vi.fn(),
	mockSessionStoreState: {
		clearSession: vi.fn(),
		refreshSession: vi.fn(),
	},
	mockTriggerRequestLogout: vi.fn(),
}));

vi.mock("axios", () => ({
	default: {
		create: vi.fn(() => {
			const instance = ((config: unknown) =>
				mockRequest(config)) as unknown as {
				request: typeof mockRequest;
				interceptors: {
					request: { use: typeof mockInterceptorsRequestUse };
					response: { use: typeof mockInterceptorsResponseUse };
				};
			};
			instance.request = mockRequest;
			instance.interceptors = {
				request: { use: mockInterceptorsRequestUse },
				response: { use: mockInterceptorsResponseUse },
			};
			return instance;
		}),
		isCancel: vi.fn(
			(e: unknown) => (e as { __cancel?: boolean })?.__cancel === true,
		),
	},
}));

vi.mock("@/config/env", () => ({
	env: { apiBaseURL: "http://api.test" },
}));
vi.mock("@/utils/i18n", () => ({
	t: (key: string) => key,
	getLocale: () => "zh-TW",
}));

vi.mock("@/utils/storage", () => ({
	sessionStorage: { get: mockSessionGet },
}));

vi.mock("@/utils/retry", () => ({
	requestWithRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));
vi.mock("@/store/sessionStore", () => ({
	useSessionStore: {
		getState: () => mockSessionStoreState,
	},
}));
vi.mock("@/services/requestAuthBridge", () => ({
	triggerRequestLogout: () => mockTriggerRequestLogout(),
}));

vi.mock("antd", () => ({
	message: {
		error: (...args: unknown[]) => mockMessageError(...args),
		warning: (...args: unknown[]) => mockMessageWarning(...args),
	},
}));

import {
	cancelAllRequests,
	cancelRequest,
	requestWithRetryWrapper,
} from "./request";

const originalAdminLoginUrl = import.meta.env.VITE_ADMIN_LOGIN_URL;
const onRequest = mockInterceptorsRequestUse.mock.calls[0]?.[0];
const onResponse = mockInterceptorsResponseUse.mock.calls[0]?.[0];
const onError = mockInterceptorsResponseUse.mock.calls[0]?.[1];

describe("request", () => {
	beforeEach(() => {
		mockRequest.mockReset();
		mockSessionGet.mockReset();
		mockSessionGet.mockReturnValue(null);
		mockMessageError.mockClear();
		mockMessageWarning.mockClear();
		mockSessionStoreState.clearSession.mockClear();
		mockSessionStoreState.refreshSession.mockClear();
		mockTriggerRequestLogout.mockClear();
		localStorage.clear();
		window.sessionStorage.clear();
		mockSessionStoreState.refreshSession.mockResolvedValue(true);
		(import.meta.env as { VITE_ADMIN_LOGIN_URL?: string }).VITE_ADMIN_LOGIN_URL =
			originalAdminLoginUrl;
	});

	describe("cancelRequest", () => {
		it("應能調用且不拋錯（無對應 controller 時）", () => {
			expect(() => cancelRequest("non-existent")).not.toThrow();
		});

		it("有對應 controller 時應可正常取消", async () => {
			await onRequest({
				method: "get",
				url: "/cancel-me",
				headers: {},
				metadata: { requestId: "req-cancel-1" },
			});
			expect(() => cancelRequest("req-cancel-1")).not.toThrow();
		});
	});

	describe("cancelAllRequests", () => {
		it("應能調用且不拋錯", () => {
			expect(() => cancelAllRequests()).not.toThrow();
		});

		it("存在活躍請求時應可全部取消", async () => {
			await onRequest({
				method: "get",
				url: "/cancel-all",
				headers: {},
				metadata: { requestId: "req-cancel-all-1" },
			});
			expect(() => cancelAllRequests()).not.toThrow();
		});
	});

	describe("requestWithRetryWrapper", () => {
		it("應調用 requestWithRetry 並傳入 request 調用", async () => {
			const { requestWithRetry } = await import("@/utils/retry");
			mockRequest.mockResolvedValueOnce({
				data: { success: true, data: { x: 1 } },
			});
			(requestWithRetry as ReturnType<typeof vi.fn>).mockImplementation(
				(fn: () => Promise<unknown>) => fn(),
			);
			const result = await requestWithRetryWrapper({
				method: "GET",
				url: "/test",
			});
			expect(requestWithRetry).toHaveBeenCalled();
			expect(result.data).toEqual({ success: true, data: { x: 1 } });
		});

		it("shouldRetry 應僅對網路錯誤與 5xx 返回 true", async () => {
			const { requestWithRetry } = await import("@/utils/retry");
			mockRequest.mockResolvedValueOnce({ data: { success: true, data: {} } });
			await requestWithRetryWrapper({ method: "GET", url: "/test2" });
			const options = (requestWithRetry as ReturnType<typeof vi.fn>).mock
				.calls[0][1];
			expect(options.shouldRetry({ code: "NETWORK_ERROR" })).toBe(true);
			expect(options.shouldRetry({})).toBe(true);
			expect(options.shouldRetry({ response: { status: 503 } })).toBe(true);
			expect(options.shouldRetry({ response: { status: 400 } })).toBe(false);
		});
	});

	describe("interceptors", () => {
		it("request interceptor 的 error handler 應原樣拒絕", async () => {
			const onRequestError = mockInterceptorsRequestUse.mock.calls[0]?.[1];
			await expect(
				onRequestError(new Error("req-fail")),
			).rejects.toBeInstanceOf(Error);
		});

		it("request interceptor 應附加 token 與 X-Session-Id", async () => {
			mockSessionGet.mockReturnValueOnce("session-1");
			localStorage.setItem("token", "token-1");
			const config = await onRequest({
				method: "get",
				url: "/x",
				headers: {},
			});
			expect(config.headers.Authorization).toBe("Bearer token-1");
			expect(config.headers["X-Session-Id"]).toBe("session-1");
			expect(config.metadata.requestId).toBeTruthy();
			expect(config.signal).toBeTruthy();
		});

		it("request interceptor 對 admin 路徑不應自動附加前台 user token", async () => {
			localStorage.setItem("token", "front-user-token");
			const config = await onRequest({
				method: "get",
				url: "/api/v1/admin/users",
				headers: {},
			});
			expect(config.headers.Authorization).toBeUndefined();
		});

		it("request interceptor 已有 X-Session-Id 時不應覆蓋", async () => {
			mockSessionGet.mockReturnValueOnce("session-override-attempt");
			const config = await onRequest({
				method: "get",
				url: "/x",
				headers: { "X-Session-Id": "pre-set-session" },
			});
			expect(config.headers["X-Session-Id"]).toBe("pre-set-session");
		});

		it("request interceptor 已有 Authorization 時不應被 user token 覆蓋", async () => {
			localStorage.setItem("token", "user-token");
			const config = await onRequest({
				method: "get",
				url: "/admin/jobs/stats",
				headers: { Authorization: "Bearer admin-token" },
			});
			expect(config.headers.Authorization).toBe("Bearer admin-token");
		});

		it("response success=false 應轉為拒絕錯誤", async () => {
			await expect(
				onResponse({
					data: { success: false, error: { code: "E1", message: "bad" } },
					config: {},
				}),
			).rejects.toMatchObject({ code: "E1", message: "bad" });
		});

		it("response success=true 且帶 requestId 應返回原 response 並清理 metadata 分支", async () => {
			const response = await onResponse({
				data: { success: true, data: { ok: true } },
				config: { metadata: { requestId: "resp-rid-1" } },
			});
			expect(response.data).toEqual({ success: true, data: { ok: true } });
		});

		it("response success=false 且缺少錯誤欄位時應使用 fallback", async () => {
			await expect(
				onResponse({
					data: { success: false, error: {} },
					config: {},
				}),
			).rejects.toMatchObject({
				code: "API_ERROR",
				message: "common.requestFail",
			});
		});

		it("response 非 ApiResponse 應兼容包裝為 success=true", async () => {
			const result = await onResponse({
				data: { x: 1 },
				config: {},
			});
			expect(result.data).toEqual({ success: true, data: { x: 1 } });
		});

		it("error interceptor 遇到取消請求應返回 REQUEST_CANCELED", async () => {
			await expect(
				onError({ __cancel: true, name: "CanceledError" }),
			).rejects.toMatchObject({
				code: "REQUEST_CANCELED",
				isCanceled: true,
			});
		});

		it("400 + INVALID_SESSION_ID 應 clear + refresh 並 warning", async () => {
			await expect(
				onError({
					response: {
						status: 400,
						data: {
							error: { code: "INVALID_SESSION_ID", message: "session-bad" },
						},
						config: { url: "/cases/x", headers: {}, params: {} },
					},
					config: {},
					message: "bad",
				}),
			).rejects.toMatchObject({ code: "INVALID_SESSION_ID" });
			expect(mockSessionStoreState.clearSession).toHaveBeenCalled();
			expect(mockSessionStoreState.refreshSession).toHaveBeenCalledWith(true);
			expect(mockMessageWarning).toHaveBeenCalled();
		});

		it("400 + SESSION_ID_REQUIRED 刷新成功且無 message 時應使用 fallback warning", async () => {
			await expect(
				onError({
					response: {
						status: 400,
						data: { error: { code: "SESSION_ID_REQUIRED" } },
						config: { url: "/cases/x", headers: {}, params: {} },
					},
					config: { metadata: { requestId: "err-rid-400" } },
					message: "bad",
				}),
			).rejects.toMatchObject({ code: "SESSION_ID_REQUIRED" });
			expect(mockMessageWarning).toHaveBeenCalledWith(
				"common.sessionExpiredRefreshed",
			);
		});

		it("400 + INVALID_SESSION_ID 當 refresh 拋錯時應走 catch 顯示 error", async () => {
			mockSessionStoreState.refreshSession.mockRejectedValueOnce(
				new Error("refresh failed"),
			);
			await expect(
				onError({
					response: {
						status: 400,
						data: { error: { code: "INVALID_SESSION_ID", message: "" } },
						config: { url: "/cases/x", headers: {}, params: {} },
					},
					config: {},
					message: "bad",
				}),
			).rejects.toMatchObject({ code: "INVALID_SESSION_ID" });
			expect(mockMessageError).toHaveBeenCalledWith(
				"error.session.expiredHint",
			);
		});

		it("400 + INVALID_SESSION_ID 當 refresh 返回 null 時應顯示 error.session.expiredHint", async () => {
			mockSessionStoreState.refreshSession.mockResolvedValueOnce(null);
			await expect(
				onError({
					response: {
						status: 400,
						data: { error: { code: "INVALID_SESSION_ID", message: "" } },
						config: { url: "/cases/x", headers: {}, params: {} },
					},
					config: {},
					message: "bad",
				}),
			).rejects.toMatchObject({ code: "INVALID_SESSION_ID" });
			expect(mockMessageError).toHaveBeenCalledWith(
				"error.session.expiredHint",
			);
		});

		it("400 一般錯誤應顯示 validationError", async () => {
			await expect(
				onError({
					response: {
						status: 400,
						data: { error: { code: "VALIDATION_ERROR", message: "" } },
						config: { url: "/cases/x", headers: {}, params: {} },
					},
					config: {},
					message: "bad",
				}),
			).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
			expect(mockMessageError).toHaveBeenCalledWith("common.validationError");
		});

		it("401 + SESSION_EXPIRED 且 refresh 失敗應 error", async () => {
			mockSessionStoreState.refreshSession.mockResolvedValueOnce(false);
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "SESSION_EXPIRED", message: "expired" } },
						config: { url: "/cases/x", headers: {}, params: {} },
					},
					config: {},
					message: "expired",
				}),
			).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
			expect(mockMessageError).toHaveBeenCalled();
		});

		it("401 + SESSION_EXPIRED refresh 失敗且無 message 時應顯示 expiredHint", async () => {
			mockSessionStoreState.refreshSession.mockResolvedValueOnce(false);
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "SESSION_EXPIRED" } },
						config: { url: "/cases/x", headers: {}, params: {} },
					},
					config: {},
					message: "expired",
				}),
			).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
			expect(mockMessageError).toHaveBeenCalledWith(
				"error.session.expiredHint",
			);
		});

		it("401 + INVALID_SESSION_ID 刷新成功且無 message 時應使用 fallback warning", async () => {
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "INVALID_SESSION_ID" } },
						config: { url: "/cases/x", headers: {}, params: {} },
					},
					config: {},
					message: "expired",
				}),
			).rejects.toMatchObject({ code: "INVALID_SESSION_ID" });
			expect(mockMessageWarning).toHaveBeenCalledWith(
				"common.sessionExpiredRefreshed",
			);
		});

		it("401 + SESSION_EXPIRED 當 refresh 拋錯時應走 catch 顯示 error", async () => {
			mockSessionStoreState.refreshSession.mockRejectedValueOnce(
				new Error("refresh explode"),
			);
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "SESSION_EXPIRED", message: "" } },
						config: { url: "/cases/x", headers: {}, params: {} },
					},
					config: {},
					message: "expired",
				}),
			).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
			expect(mockMessageError).toHaveBeenCalledWith(
				"error.session.expiredHint",
			);
		});

		it("401 非 session 錯誤應清 token 並調用 logout", async () => {
			localStorage.setItem("token", "token-x");
			history.pushState({}, "", "/auth/login");
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "UNAUTHORIZED", message: "" } },
						config: { url: "/auth/me", headers: {}, params: {} },
					},
					config: {},
					message: "unauth",
				}),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await Promise.resolve();
			expect(localStorage.getItem("token")).toBeNull();
			expect(mockTriggerRequestLogout).toHaveBeenCalled();
			history.pushState({}, "", "/");
		});

		it("401 admin API 應清理 admin token，且不清理前台 user token", async () => {
			localStorage.setItem("token", "front-user-token");
			localStorage.setItem("admin_token", "admin-token-local");
			window.sessionStorage.setItem("admin_token", "admin-token-session");
			const dispatchSpy = vi.spyOn(window, "dispatchEvent");
			history.pushState({}, "", "/admin/login");
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "UNAUTHORIZED", message: "" } },
						config: { url: "/admin/users", headers: {}, params: {} },
					},
					config: {},
					message: "unauth",
				}),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await Promise.resolve();
			expect(localStorage.getItem("admin_token")).toBeNull();
			expect(window.sessionStorage.getItem("admin_token")).toBeNull();
			expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
			expect(localStorage.getItem("token")).toBe("front-user-token");
			expect(mockTriggerRequestLogout).not.toHaveBeenCalled();
			dispatchSpy.mockRestore();
			history.pushState({}, "", "/");
		});

		it("401 admin API（絕對 URL）也應清理 admin token", async () => {
			localStorage.setItem("token", "front-user-token");
			localStorage.setItem("admin_token", "admin-token-local");
			window.sessionStorage.setItem("admin_token", "admin-token-session");
			const dispatchSpy = vi.spyOn(window, "dispatchEvent");
			history.pushState({}, "", "/admin/ops/jobs");
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "UNAUTHORIZED", message: "" } },
						config: {
							url: "https://api.example.com/api/v1/admin/users",
							headers: {},
							params: {},
						},
					},
					config: {},
					message: "unauth",
				}),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await Promise.resolve();
			expect(localStorage.getItem("admin_token")).toBeNull();
			expect(window.sessionStorage.getItem("admin_token")).toBeNull();
			expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
			expect(localStorage.getItem("token")).toBe("front-user-token");
			expect(mockTriggerRequestLogout).not.toHaveBeenCalled();
			dispatchSpy.mockRestore();
			history.pushState({}, "", "/");
		});

		it("401 admin API（/api/v1/admin 相對路徑）也應清理 admin token", async () => {
			localStorage.setItem("token", "front-user-token");
			localStorage.setItem("admin_token", "admin-token-local");
			window.sessionStorage.setItem("admin_token", "admin-token-session");
			const dispatchSpy = vi.spyOn(window, "dispatchEvent");
			history.pushState({}, "", "/admin/health");
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "UNAUTHORIZED", message: "" } },
						config: { url: "/api/v1/admin/users", headers: {}, params: {} },
					},
					config: {},
					message: "unauth",
				}),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await Promise.resolve();
			expect(localStorage.getItem("admin_token")).toBeNull();
			expect(window.sessionStorage.getItem("admin_token")).toBeNull();
			expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
			expect(localStorage.getItem("token")).toBe("front-user-token");
			expect(mockTriggerRequestLogout).not.toHaveBeenCalled();
			dispatchSpy.mockRestore();
			history.pushState({}, "", "/");
		});

		it("401 admin API 在缺少 admin URL 配置時應提示 urlMissing", async () => {
			(import.meta.env as { VITE_ADMIN_LOGIN_URL?: string }).VITE_ADMIN_LOGIN_URL = "";
			localStorage.setItem("admin_token", "admin-token-local");
			window.sessionStorage.setItem("admin_token", "admin-token-session");
			const dispatchSpy = vi.spyOn(window, "dispatchEvent");
			history.pushState({}, "", "/admin/reports");
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "UNAUTHORIZED", message: "" } },
						config: { url: "/api/v1/admin/reports", headers: {}, params: {} },
					},
					config: {},
					message: "unauth",
				}),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await Promise.resolve();
			expect(localStorage.getItem("admin_token")).toBeNull();
			expect(window.sessionStorage.getItem("admin_token")).toBeNull();
			expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
			expect(mockTriggerRequestLogout).not.toHaveBeenCalled();
			expect(mockMessageError).toHaveBeenCalledWith("admin.login.urlMissing");
			dispatchSpy.mockRestore();
		});

		it("401 admin login INVALID_CREDENTIALS 不應清理 admin token 或觸發導轉流程", async () => {
			localStorage.setItem("admin_token", "admin-token-local");
			window.sessionStorage.setItem("admin_token", "admin-token-session");
			const dispatchSpy = vi.spyOn(window, "dispatchEvent");
			history.pushState({}, "", "/admin/login");
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "INVALID_CREDENTIALS", message: "帳號或密碼錯誤" } },
						config: { url: "/admin/login", headers: {}, params: {} },
					},
					config: {},
					message: "invalid credentials",
				}),
			).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
			await Promise.resolve();
			expect(localStorage.getItem("admin_token")).toBe("admin-token-local");
			expect(window.sessionStorage.getItem("admin_token")).toBe("admin-token-session");
			expect(dispatchSpy).not.toHaveBeenCalled();
			expect(mockMessageError).not.toHaveBeenCalledWith("admin.login.urlMissing");
			dispatchSpy.mockRestore();
		});

		it("403 應提示 forbidden", async () => {
			await expect(
				onError({
					response: {
						status: 403,
						data: { error: { code: "FORBIDDEN", message: "" } },
						config: { url: "/forbidden", headers: {}, params: {} },
					},
					config: {},
					message: "forbidden",
				}),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			expect(mockMessageError).toHaveBeenCalledWith("common.forbidden");
		});

		it("404 by-session 應抑制全域錯誤提示", async () => {
			await expect(
				onError({
					response: {
						status: 404,
						data: { error: { code: "NOT_FOUND", message: "n/a" } },
						config: { url: "/cases/by-session", headers: {}, params: {} },
					},
					config: {},
					message: "not found",
				}),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			expect(mockMessageError).not.toHaveBeenCalled();
		});

		it("404 cases/:id 且帶 session 應抑制全域錯誤提示", async () => {
			await expect(
				onError({
					response: {
						status: 404,
						data: { error: { code: "NOT_FOUND", message: "" } },
						config: {
							url: "/cases/case-1",
							headers: { "X-Session-Id": "sid-1" },
							params: {},
						},
					},
					config: {},
					message: "not found",
				}),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			expect(mockMessageError).not.toHaveBeenCalled();
		});

		it("404 一般路徑應顯示 notFound 錯誤", async () => {
			await expect(
				onError({
					response: {
						status: 404,
						data: { error: { code: "NOT_FOUND", message: "" } },
						config: { url: "/other", headers: {}, params: {} },
					},
					config: {},
					message: "not found",
				}),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			expect(mockMessageError).toHaveBeenCalled();
		});

		it("404 缺少 errorData.code 時應回退為 HTTP_404", async () => {
			await expect(
				onError({
					response: {
						status: 404,
						data: {},
						config: { headers: {}, params: {} },
					},
					config: {},
					message: "not found",
				}),
			).rejects.toMatchObject({ code: "HTTP_404" });
		});

		it("409 + judgment_failed 應抑制全域錯誤提示", async () => {
			await expect(
				onError({
					response: {
						status: 409,
						data: { error: { code: "JUDGMENT_FAILED", message: "fail" } },
						config: { url: "/judgment/1", headers: {}, params: {} },
					},
					config: {},
					message: "conflict",
				}),
			).rejects.toMatchObject({ code: "JUDGMENT_FAILED" });
			expect(mockMessageError).not.toHaveBeenCalled();
		});

		it("409 一般衝突應提示 conflict", async () => {
			await expect(
				onError({
					response: {
						status: 409,
						data: { error: { code: "CONFLICT", message: "" } },
						config: { url: "/other", headers: {}, params: {} },
					},
					config: {},
					message: "conflict",
				}),
			).rejects.toMatchObject({ code: "CONFLICT" });
			expect(mockMessageError).toHaveBeenCalledWith("common.conflict");
		});

		it("409 缺少 config.url 時仍應走 conflict 分支", async () => {
			await expect(
				onError({
					response: {
						status: 409,
						data: { error: { code: "CONFLICT" } },
						config: { headers: {}, params: {} },
					},
					config: {},
					message: "conflict",
				}),
			).rejects.toMatchObject({ code: "CONFLICT" });
			expect(mockMessageError).toHaveBeenCalledWith("common.conflict");
		});

		it("422 應提示 validationError", async () => {
			await expect(
				onError({
					response: {
						status: 422,
						data: { error: { code: "VALIDATION_ERROR", message: "" } },
						config: { url: "/validation", headers: {}, params: {} },
					},
					config: {},
					message: "validation",
				}),
			).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
			expect(mockMessageError).toHaveBeenCalledWith("common.validationError");
		});

		it("429 /uploads 應走 fileRateLimit 分支", async () => {
			await expect(
				onError({
					response: {
						status: 429,
						data: { error: { code: "RATE_LIMIT", message: "" } },
						config: { url: "/uploads/file", headers: {}, params: {} },
					},
					config: {},
					message: "rate",
				}),
			).rejects.toMatchObject({ code: "RATE_LIMIT" });
			expect(mockMessageError).toHaveBeenCalledWith("common.fileRateLimit");
		});

		it("429 非 uploads 應走 rateLimit 分支", async () => {
			await expect(
				onError({
					response: {
						status: 429,
						data: { error: { code: "RATE_LIMIT", message: "" } },
						config: { url: "/api/other", headers: {}, params: {} },
					},
					config: {},
					message: "rate",
				}),
			).rejects.toMatchObject({ code: "RATE_LIMIT" });
			expect(mockMessageError).toHaveBeenCalledWith("common.rateLimit");
		});

		it("429 缺少 config.url 時也應走 rateLimit 分支", async () => {
			await expect(
				onError({
					response: {
						status: 429,
						data: { error: { code: "RATE_LIMIT" } },
						config: { headers: {}, params: {} },
					},
					config: {},
					message: "rate",
				}),
			).rejects.toMatchObject({ code: "RATE_LIMIT" });
			expect(mockMessageError).toHaveBeenCalledWith("common.rateLimit");
		});

		it("500 應提示 serverError", async () => {
			await expect(
				onError({
					response: {
						status: 500,
						data: { error: { code: "SERVER_ERROR", message: "" } },
						config: { url: "/server", headers: {}, params: {} },
					},
					config: {},
					message: "server",
				}),
			).rejects.toMatchObject({ code: "SERVER_ERROR" });
			expect(mockMessageError).toHaveBeenCalledWith("common.serverError");
		});

		it("500 且 response data 非 object 時應返回 HTTP_500", async () => {
			await expect(
				onError({
					response: {
						status: 500,
						data: "fatal",
						config: { url: "/server", headers: {}, params: {} },
					},
					config: {},
					message: "server",
				}),
			).rejects.toMatchObject({ code: "HTTP_500" });
		});

		it("401 非 session 錯誤且不在 login 頁時應嘗試跳轉 login", async () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			history.pushState({}, "", "/protected");
			await expect(
				onError({
					response: {
						status: 401,
						data: { error: { code: "UNAUTHORIZED", message: "" } },
						config: { url: "/auth/me", headers: {}, params: {} },
					},
					config: {},
					message: "unauth",
				}),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			expect(mockMessageError).toHaveBeenCalledWith("common.unauthorized");
			history.pushState({}, "", "/");
			consoleSpy.mockRestore();
		});

		it("網絡錯誤應返回 NETWORK_ERROR", async () => {
			await expect(
				onError({ request: {}, message: "network down" }),
			).rejects.toMatchObject({
				code: "NETWORK_ERROR",
			});
		});

		it("未知錯誤應返回 UNKNOWN_ERROR", async () => {
			await expect(onError({ message: "boom" })).rejects.toMatchObject({
				code: "UNKNOWN_ERROR",
				message: "boom",
			});
		});
	});
});
