import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AdminPermissionRoute from "@/components/common/AdminPermissionRoute";
import AdminSectionLayout from "@/components/common/AdminSectionLayout";
import AdminLandingRoute from "@/components/common/AdminLandingRoute";
import {
	ADMIN_NAVIGATION_ITEMS,
	type AdminRouteId,
} from "@/config/adminNavigation";

const AdminLogin = lazy(() => import("@/pages/Admin/Login"));
const AdminOpsJobs = lazy(() => import("@/pages/Admin/OpsJobs"));
const AdminJobs = lazy(() => import("@/pages/Admin/Jobs"));
const AdminHealth = lazy(() => import("@/pages/Admin/Health"));
const AdminConfigs = lazy(() => import("@/pages/Admin/Configs"));
const AdminUsers = lazy(() => import("@/pages/Admin/Users"));
const AdminAuditLogs = lazy(() => import("@/pages/Admin/AuditLogs"));
const AdminReports = lazy(() => import("@/pages/Admin/Reports"));
const AdminSettings = lazy(() => import("@/pages/Admin/Settings"));

function LazyWrapper({ children }: { children: ReactNode }) {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center py-12">
					<Loader2 className="size-8 animate-spin text-primary" />
				</div>
			}
		>
			{children}
		</Suspense>
	);
}

function RootLayout() {
	return <Outlet />;
}

const adminRouteElements: Record<AdminRouteId, ReactNode> = {
	opsJobs: <AdminOpsJobs />,
	jobs: <AdminJobs />,
	health: <AdminHealth />,
	configs: <AdminConfigs />,
	users: <AdminUsers />,
	auditLogs: <AdminAuditLogs />,
	reports: <AdminReports />,
	settings: <AdminSettings />,
};

export const router = createBrowserRouter([
	{
		path: "/",
		element: <RootLayout />,
		children: [
			{
				index: true,
				element: <Navigate to="/admin/login" replace />,
			},
			{
				path: "admin",
				element: <AdminSectionLayout />,
				children: [
					{
						index: true,
						element: <AdminLandingRoute />,
					},
					...ADMIN_NAVIGATION_ITEMS.map((route) => ({
						path: route.relativePath,
						element: (
							<LazyWrapper>
								<AdminPermissionRoute
									requiredPermissions={route.requiredPermissions}
									permissionMode={route.permissionMode}
								>
									{adminRouteElements[route.id]}
								</AdminPermissionRoute>
							</LazyWrapper>
						),
					})),
				],
			},
			{
				path: "admin/login",
				element: (
					<LazyWrapper>
						<AdminLogin />
					</LazyWrapper>
				),
			},
			{
				path: "*",
				element: <Navigate to="/admin" replace />,
			},
		],
	},
]);
