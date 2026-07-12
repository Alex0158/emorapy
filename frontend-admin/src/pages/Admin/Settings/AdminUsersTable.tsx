import type { MouseEvent } from "react";
import { Loader2, Pencil, Power, Trash2 } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { AdminQueryState, AdminStatusBadge } from "@/components/common/AdminPage";
import type { AdminAdminUserItem } from "@/types/admin";
import { formatAdminDateTime, humanizeAdminKey } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

export interface AdminUserConfirmAction {
	type: "toggle" | "delete";
	admin: AdminAdminUserItem;
}

interface AdminUsersTableProps {
	items: AdminAdminUserItem[];
	loading: boolean;
	hasError: boolean;
	currentAdminId?: string;
	updatePending: boolean;
	deletePending: boolean;
	confirmAction: AdminUserConfirmAction | null;
	onRetry: () => void;
	onEdit: (admin: AdminAdminUserItem) => void;
	onConfirmActionChange: (action: AdminUserConfirmAction | null) => void;
	onConfirmAction: (action: AdminUserConfirmAction) => void;
}

export function AdminUsersTable({
	items,
	loading,
	hasError,
	currentAdminId,
	updatePending,
	deletePending,
	confirmAction,
	onRetry,
	onEdit,
	onConfirmActionChange,
	onConfirmAction,
}: AdminUsersTableProps) {
	const actionPending = updatePending || deletePending;

	return (
		<>
			<AdminQueryState
				loading={loading}
				error={hasError}
				empty={items.length === 0}
				onRetry={onRetry}
			>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("admin.settings.adminUsers.identity")}</TableHead>
							<TableHead>{t("admin.settings.adminUsers.role")}</TableHead>
							<TableHead>{t("admin.settings.adminUsers.active")}</TableHead>
							<TableHead>{t("admin.settings.adminUsers.lastLogin")}</TableHead>
							<TableHead className="text-right">
								{t("admin.users.actions")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((admin) => (
							<TableRow key={admin.id}>
								<TableCell>
									<p className="font-medium">{admin.name}</p>
									<p className="text-xs text-muted-foreground">{admin.email}</p>
								</TableCell>
								<TableCell>
									<p className="font-medium">{t(`admin.roles.${admin.role.key}`)}</p>
									<p className="text-xs text-muted-foreground">
										{humanizeAdminKey(admin.role.key)}
									</p>
								</TableCell>
								<TableCell>
									<AdminStatusBadge
										status={admin.is_active}
										label={admin.is_active ? t("admin.common.enabled") : t("admin.common.disabled")}
									/>
								</TableCell>
								<TableCell>{formatAdminDateTime(admin.last_login_at)}</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-1.5">
										<Button variant="ghost" size="sm" onClick={() => onEdit(admin)}>
											<Pencil className="size-3.5" />
											{t("admin.settings.adminUsers.edit")}
										</Button>
										<Button
											variant="outline"
											size="sm"
											disabled={admin.id === currentAdminId || updatePending}
											onClick={() => onConfirmActionChange({ type: "toggle", admin })}
										>
											<Power className="size-3.5" />
											{admin.is_active
												? t("admin.settings.adminUsers.deactivate")
												: t("admin.settings.adminUsers.activate")}
										</Button>
										<Button
											variant="destructive"
											size="sm"
											disabled={admin.id === currentAdminId || deletePending}
											onClick={() => onConfirmActionChange({ type: "delete", admin })}
										>
											<Trash2 className="size-3.5" />
											{t("admin.settings.adminUsers.delete")}
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</AdminQueryState>

			<AlertDialog
				open={Boolean(confirmAction)}
				onOpenChange={(open: boolean) => {
					if (!open && !actionPending) onConfirmActionChange(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{confirmAction?.type === "delete"
								? t("admin.settings.adminUsers.confirmDelete")
								: confirmAction?.admin.is_active
									? t("admin.settings.adminUsers.confirmDeactivate")
									: t("admin.settings.adminUsers.confirmActivate")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("admin.settings.adminUsers.highRiskHint")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{confirmAction && (
						<div className="rounded-lg border p-4">
							<p className="font-medium">{confirmAction.admin.name}</p>
							<p className="text-sm text-muted-foreground">
								{confirmAction.admin.email} · {t(`admin.roles.${confirmAction.admin.role.key}`)}
							</p>
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							disabled={!confirmAction || actionPending}
							onClick={(event: MouseEvent<HTMLButtonElement>) => {
								event.preventDefault();
								if (confirmAction) onConfirmAction(confirmAction);
							}}
						>
							{actionPending && <Loader2 className="size-4 animate-spin" />}
							{t("common.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
