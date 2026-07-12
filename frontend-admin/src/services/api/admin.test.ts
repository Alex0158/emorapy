import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
	put: vi.fn(),
	patch: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("../request", () => ({ default: requestMock }));
vi.mock("@/utils/i18n", () => ({ t: (key: string) => key }));
vi.mock("../adminSession", () => ({
	clearAdminToken: vi.fn(),
	getAdminAuthHeaders: () => ({ Authorization: "Bearer test-admin-token" }),
	getAdminToken: vi.fn(),
	getAdminTokenFingerprint: vi.fn(),
	isAdminTokenExpired: vi.fn(),
	isLikelyAdminJwt: vi.fn(),
	setAdminToken: vi.fn(),
	subscribeAdminTokenChanges: vi.fn(),
}));

import { adminApi } from "./admin";

const auth = { Authorization: "Bearer test-admin-token" };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("adminApi critical mutations", () => {
	it("rejects malformed login responses instead of persisting an unusable session", async () => {
		requestMock.post.mockResolvedValueOnce({
			data: { success: true, data: { token: "", admin: {} } },
		});

		await expect(
			adminApi.login({ email: "ops@example.com", password: "secret" }),
		).rejects.toThrow("adminApi.error.invalidAdminLoginResponse");
	});

	it("sends app-user lock actions to the scoped status endpoint", async () => {
		const payload = { action: "lock" as const, lockMinutes: 30 };
		const response = { user: { id: "user-1" } };
		requestMock.patch.mockResolvedValueOnce({
			data: { success: true, data: response },
		});

		await expect(adminApi.updateUserStatus("user-1", payload)).resolves.toBe(
			response,
		);
		expect(requestMock.patch).toHaveBeenCalledWith(
			"/admin/users/user-1/status",
			payload,
			{ headers: auth },
		);
	});

	it("preserves config value types when confirming a runtime config mutation", async () => {
		const payload = {
			key: "runtime.jobs",
			value: { enabled: false, concurrency: 2 },
			description: "jobs switch",
			isRuntime: true,
			isSensitive: false,
		};
		const response = {
			item: { key: payload.key, value: payload.value },
			runtime: { jobsEnabled: false },
		};
		requestMock.put.mockResolvedValueOnce({
			data: { success: true, data: response },
		});

		await expect(adminApi.upsertConfig(payload)).resolves.toBe(response);
		expect(requestMock.put).toHaveBeenCalledWith("/admin/configs", payload, {
			headers: auth,
		});
	});

	it("routes admin-user create, update, and delete through distinct mutation contracts", async () => {
		const created = { item: { id: "admin-2" } };
		const updated = { item: { id: "admin-2", isActive: false } };
		const deleted = { item: { id: "admin-2" } };
		requestMock.post.mockResolvedValueOnce({
			data: { success: true, data: created },
		});
		requestMock.patch.mockResolvedValueOnce({
			data: { success: true, data: updated },
		});
		requestMock.delete.mockResolvedValueOnce({
			data: { success: true, data: deleted },
		});

		const createPayload = {
			email: "new-admin@example.com",
			password: "LongEnoughPassword",
			name: "New Admin",
			roleKey: "support" as const,
		};
		await expect(adminApi.createAdminUser(createPayload)).resolves.toBe(created);
		await expect(
			adminApi.updateAdminUser("admin-2", { isActive: false }),
		).resolves.toBe(updated);
		await expect(adminApi.deleteAdminUser("admin-2")).resolves.toBe(deleted);

		expect(requestMock.post).toHaveBeenCalledWith(
			"/admin/admin-users",
			createPayload,
			{ headers: auth },
		);
		expect(requestMock.patch).toHaveBeenCalledWith(
			"/admin/admin-users/admin-2",
			{ isActive: false },
			{ headers: auth },
		);
		expect(requestMock.delete).toHaveBeenCalledWith(
			"/admin/admin-users/admin-2",
			{ headers: auth },
		);
	});
});
