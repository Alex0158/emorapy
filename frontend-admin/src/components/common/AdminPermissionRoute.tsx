import { AlertCircle, AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useAdminToken } from "@/hooks/useAdminToken";
import { deriveAdminTokenStatus } from "@/utils/adminTokenState";
import { getFirstPermittedAdminPath } from "@/config/adminNavigation";
import { t } from "@/utils/i18n";

interface AdminPermissionRouteProps {
	children: React.ReactNode;
	requiredPermissions: string[];
	allowMissingToken?: boolean;
	permissionMode?: "any" | "all";
}

function GuardMessage({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon: typeof AlertCircle;
	title: string;
	description?: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="mx-auto flex min-h-[22rem] max-w-xl items-center justify-center">
			<div
				className="w-full rounded-xl border bg-surface p-6 text-center"
				role="alert"
			>
				<span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<Icon className="size-5" />
				</span>
				<h1 className="mt-4 text-lg font-semibold text-foreground">{title}</h1>
				{description && (
					<p className="mt-2 text-sm text-muted-foreground">{description}</p>
				)}
				{action && <div className="mt-5 flex justify-center">{action}</div>}
			</div>
		</div>
	);
}

export default function AdminPermissionRoute({
	children,
	requiredPermissions,
	allowMissingToken = false,
	permissionMode = "any",
}: AdminPermissionRouteProps) {
	const adminToken = useAdminToken();
	const { tokenPresent, tokenReady } = deriveAdminTokenStatus(adminToken);
	const { adminMeQuery, permissions, hasPermission, missingPermissions } =
		useAdminAccess(requiredPermissions, tokenReady, permissionMode);

	if (!tokenPresent || !tokenReady) {
		if (allowMissingToken) return <>{children}</>;
		return (
			<GuardMessage icon={AlertTriangle} title={t("admin.ops.tokenRequired")} />
		);
	}

	if (adminMeQuery.isLoading) {
		return (
			<div
				className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"
				role="status"
			>
				<Loader2 className="size-4 animate-spin" />{" "}
				{t("admin.ops.verifyingAccess")}
			</div>
		);
	}

	if (adminMeQuery.error) {
		const queryError = adminMeQuery.error as {
			code?: string;
			message?: string;
		} | null;
		if (queryError?.code === "NETWORK_ERROR") {
			return (
				<GuardMessage
					icon={WifiOff}
					title={t("common.networkError")}
					description={t("admin.shell.networkRecovery")}
				/>
			);
		}
		return (
			<GuardMessage
				icon={AlertCircle}
				title={t("admin.ops.identityFailed")}
				description={queryError?.message}
			/>
		);
	}

	if (!hasPermission) {
		const destination = getFirstPermittedAdminPath(permissions);
		const requiredLabel =
			missingPermissions.length > 0
				? missingPermissions.join(", ")
				: requiredPermissions.join(", ");
		return (
			<GuardMessage
				icon={AlertTriangle}
				title={t("admin.ops.accessDenied")}
				description={t("admin.ops.accessDeniedWithPermissions", {
					permissions: requiredLabel,
				})}
				action={
					destination ? (
						<Button asChild>
							<Link to={destination}>{t("admin.shell.backToWorkspace")}</Link>
						</Button>
					) : undefined
				}
			/>
		);
	}

	return <>{children}</>;
}
