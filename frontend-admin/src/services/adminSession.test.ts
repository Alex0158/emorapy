import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getAdminAuthHeaders,
	getAdminToken,
	getAdminTokenFingerprint,
	isAdminTokenExpired,
	isLikelyAdminJwt,
	setAdminToken,
} from "./adminSession";

function createStorage(initial: Record<string, string> = {}): Storage {
	const values = new Map(Object.entries(initial));
	return {
		get length() {
			return values.size;
		},
		clear: () => values.clear(),
		getItem: (key) => values.get(key) ?? null,
		key: (index) => [...values.keys()][index] ?? null,
		removeItem: (key) => values.delete(key),
		setItem: (key, value) => values.set(key, value),
	};
}

function encodePayload(payload: Record<string, unknown>): string {
	return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function jwt(payload: Record<string, unknown> = {}): string {
	return `header.${encodePayload(payload)}.signature`;
}

function installWindow(options: {
	session?: Storage;
	local?: Storage;
} = {}) {
	const dispatched: string[] = [];
	vi.stubGlobal("window", {
		sessionStorage: options.session ?? createStorage(),
		localStorage: options.local ?? createStorage(),
		dispatchEvent: (event: Event) => {
			dispatched.push(event.type);
			return true;
		},
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	});
	return dispatched;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("adminSession", () => {
	it("stores new tokens in sessionStorage and removes the legacy persistent copy", () => {
		const session = createStorage();
		const local = createStorage({ admin_token: "legacy.token.value" });
		const dispatched = installWindow({ session, local });
		const token = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 });

		expect(setAdminToken(token)).toBe(true);
		expect(session.getItem("admin_token")).toBe(token);
		expect(local.getItem("admin_token")).toBeNull();
		expect(dispatched).toEqual(["admin-token-changed"]);
	});

	it("migrates a readable legacy localStorage token into the current session", () => {
		const token = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
		const session = createStorage();
		const local = createStorage({ admin_token: token });
		installWindow({ session, local });

		expect(getAdminToken()).toBe(token);
		expect(session.getItem("admin_token")).toBe(token);
		expect(local.getItem("admin_token")).toBeNull();
	});

	it("clears expired tokens from both stores before an authenticated request", () => {
		const expired = jwt({ exp: Math.floor(Date.now() / 1000) - 1 });
		const session = createStorage({ admin_token: expired });
		const local = createStorage({ admin_token: expired });
		const dispatched = installWindow({ session, local });

		expect(isAdminTokenExpired(expired)).toBe(true);
		expect(getAdminToken()).toBe("");
		expect(session.getItem("admin_token")).toBeNull();
		expect(local.getItem("admin_token")).toBeNull();
		expect(dispatched).toEqual(["admin-token-changed"]);
	});

	it("only emits an Authorization header for a JWT-shaped token", () => {
		const session = createStorage();
		installWindow({ session });

		session.setItem("admin_token", "not-a-jwt");
		expect(isLikelyAdminJwt("not-a-jwt")).toBe(false);
		expect(getAdminAuthHeaders()).toBeUndefined();

		const token = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
		session.setItem("admin_token", token);
		expect(getAdminAuthHeaders()).toEqual({ Authorization: `Bearer ${token}` });
	});

	it("uses a one-way fingerprint instead of exposing the raw token in query keys", () => {
		const token = jwt({ exp: 42, role: "ops" });
		const fingerprint = getAdminTokenFingerprint(token);

		expect(fingerprint).toMatch(/^h:[0-9a-f]+$/);
		expect(fingerprint).not.toContain(token);
		expect(getAdminTokenFingerprint(token)).toBe(fingerprint);
	});
});
