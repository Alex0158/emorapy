import { describe, expect, it, vi } from "vitest";

describe("requestAuthBridge", () => {
	it("handler 已註冊時應立即觸發 logout", async () => {
		const { registerRequestLogoutHandler, triggerRequestLogout } = await import(
			"./requestAuthBridge"
		);
		const onLogout = vi.fn();
		registerRequestLogoutHandler(onLogout);
		triggerRequestLogout();
		expect(onLogout).toHaveBeenCalledTimes(1);
	});

	it("trigger 早於 register 時，應在 register 後補償執行一次", async () => {
		vi.resetModules();
		const { registerRequestLogoutHandler, triggerRequestLogout } = await import(
			"./requestAuthBridge"
		);
		const onLogout = vi.fn();
		triggerRequestLogout();
		expect(onLogout).not.toHaveBeenCalled();
		registerRequestLogoutHandler(onLogout);
		expect(onLogout).toHaveBeenCalledTimes(1);
	});

	it("多次早觸發只應補償一次，避免重複登出副作用", async () => {
		vi.resetModules();
		const { registerRequestLogoutHandler, triggerRequestLogout } = await import(
			"./requestAuthBridge"
		);
		const onLogout = vi.fn();
		triggerRequestLogout();
		triggerRequestLogout();
		registerRequestLogoutHandler(onLogout);
		expect(onLogout).toHaveBeenCalledTimes(1);
	});
});
