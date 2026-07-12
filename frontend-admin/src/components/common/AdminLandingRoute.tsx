import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getFirstPermittedAdminPath } from "@/config/adminNavigation";
import { useAdminMe } from "@/hooks/useAdminMe";
import { t } from "@/utils/i18n";

export default function AdminLandingRoute() {
	const adminMeQuery = useAdminMe(true);
	if (adminMeQuery.isLoading) {
		return (
			<div
				className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
				role="status"
			>
				<Loader2 className="size-4 animate-spin" />{" "}
				{t("admin.shell.findingWorkspace")}
			</div>
		);
	}
	if (!adminMeQuery.data) return null;
	const destination = getFirstPermittedAdminPath(
		adminMeQuery.data.admin.permissions,
	);
	if (!destination) {
		return (
			<div
				className="rounded-xl border bg-surface p-6 text-center"
				role="alert"
			>
				<h1 className="text-lg font-semibold">
					{t("admin.shell.noWorkspace")}
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					{t("admin.shell.noWorkspaceHint")}
				</p>
			</div>
		);
	}
	return <Navigate to={destination} replace />;
}
