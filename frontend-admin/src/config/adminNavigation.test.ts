import { describe, expect, it } from "vitest";
import {
	getFirstPermittedAdminPath,
	getPermittedAdminRoutes,
	getSafeAdminDestination,
} from "./adminNavigation";

describe("adminNavigation", () => {
	it("routes each role to its first permitted workspace", () => {
		expect(getFirstPermittedAdminPath(["ops:read"])).toBe("/admin/ops/jobs");
		expect(getFirstPermittedAdminPath(["users:read"])).toBe("/admin/users");
		expect(getFirstPermittedAdminPath(["reports:read"])).toBe("/admin/reports");
	});

	it("hides routes outside the permission set while super admin sees every route", () => {
		expect(
			getPermittedAdminRoutes(["users:read"]).map((route) => route.id),
		).toEqual(["users"]);
		expect(getPermittedAdminRoutes(["admin:all"])).toHaveLength(8);
	});

	it("preserves a safe permitted return path and rejects external or forbidden targets", () => {
		expect(getSafeAdminDestination(["users:read"], "/admin/users?q=alex")).toBe(
			"/admin/users?q=alex",
		);
		expect(getSafeAdminDestination(["users:read"], "/admin/settings")).toBe(
			"/admin/users",
		);
		expect(
			getSafeAdminDestination(
				["users:read"],
				"https://example.com/admin/users",
			),
		).toBe("/admin/users");
	});
});
