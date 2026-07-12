import {
	Activity,
	BarChart3,
	FileClock,
	HeartPulse,
	Settings2,
	SlidersHorizontal,
	Users,
	Wrench,
	type LucideIcon,
} from "lucide-react";

export type AdminRouteId =
	| "opsJobs"
	| "health"
	| "reports"
	| "jobs"
	| "users"
	| "configs"
	| "auditLogs"
	| "settings";

export type AdminNavigationGroup = "monitor" | "operate" | "govern";
export type AdminPermissionMode = "any" | "all";

export interface AdminNavigationItem {
	id: AdminRouteId;
	path: string;
	relativePath: string;
	labelKey: string;
	group: AdminNavigationGroup;
	icon: LucideIcon;
	requiredPermissions: string[];
	permissionMode?: AdminPermissionMode;
}

export function hasAdminPermissions(
	permissions: string[],
	requiredPermissions: string[],
	mode: AdminPermissionMode = "any",
): boolean {
	if (requiredPermissions.length === 0) return true;
	if (permissions.includes("admin:all")) return true;
	if (mode === "all") {
		return requiredPermissions.every((permission) =>
			permissions.includes(permission),
		);
	}
	return requiredPermissions.some((permission) =>
		permissions.includes(permission),
	);
}

export const ADMIN_NAVIGATION_ITEMS: AdminNavigationItem[] = [
	{
		id: "opsJobs",
		path: "/admin/ops/jobs",
		relativePath: "ops/jobs",
		labelKey: "admin.nav.ops",
		group: "monitor",
		icon: Activity,
		requiredPermissions: ["ops:read"],
	},
	{
		id: "health",
		path: "/admin/health",
		relativePath: "health",
		labelKey: "admin.nav.health",
		group: "monitor",
		icon: HeartPulse,
		requiredPermissions: ["ops:read"],
	},
	{
		id: "reports",
		path: "/admin/reports",
		relativePath: "reports",
		labelKey: "admin.nav.reports",
		group: "monitor",
		icon: BarChart3,
		requiredPermissions: ["reports:read"],
	},
	{
		id: "jobs",
		path: "/admin/jobs",
		relativePath: "jobs",
		labelKey: "admin.nav.jobs",
		group: "operate",
		icon: Wrench,
		requiredPermissions: ["ops:read"],
	},
	{
		id: "users",
		path: "/admin/users",
		relativePath: "users",
		labelKey: "admin.nav.users",
		group: "operate",
		icon: Users,
		requiredPermissions: ["users:read"],
	},
	{
		id: "configs",
		path: "/admin/configs",
		relativePath: "configs",
		labelKey: "admin.nav.configs",
		group: "govern",
		icon: SlidersHorizontal,
		requiredPermissions: ["config:read"],
	},
	{
		id: "auditLogs",
		path: "/admin/audit-logs",
		relativePath: "audit-logs",
		labelKey: "admin.nav.audit",
		group: "govern",
		icon: FileClock,
		requiredPermissions: ["users:read", "ops:read"],
		permissionMode: "all",
	},
	{
		id: "settings",
		path: "/admin/settings",
		relativePath: "settings",
		labelKey: "admin.nav.settings",
		group: "govern",
		icon: Settings2,
		requiredPermissions: ["admin:all"],
	},
];

export function hasAdminRouteAccess(
	permissions: string[],
	route: Pick<AdminNavigationItem, "requiredPermissions" | "permissionMode">,
): boolean {
	return hasAdminPermissions(
		permissions,
		route.requiredPermissions,
		route.permissionMode,
	);
}

export function getPermittedAdminRoutes(
	permissions: string[],
): AdminNavigationItem[] {
	return ADMIN_NAVIGATION_ITEMS.filter((route) =>
		hasAdminRouteAccess(permissions, route),
	);
}

export function getFirstPermittedAdminPath(
	permissions: string[],
): string | null {
	return getPermittedAdminRoutes(permissions)[0]?.path ?? null;
}

export function getSafeAdminDestination(
	permissions: string[],
	requestedPath?: string | null,
): string {
	const fallback = getFirstPermittedAdminPath(permissions) ?? "/admin/login";
	if (!requestedPath) return fallback;

	try {
		const base = new URL("https://admin.emorapy.local");
		const target = new URL(requestedPath, base);
		if (target.origin !== base.origin || target.pathname === "/admin/login")
			return fallback;
		const route = ADMIN_NAVIGATION_ITEMS.find(
			(item) => item.path === target.pathname,
		);
		if (!route || !hasAdminRouteAccess(permissions, route)) return fallback;
		return `${target.pathname}${target.search}${target.hash}`;
	} catch {
		return fallback;
	}
}
