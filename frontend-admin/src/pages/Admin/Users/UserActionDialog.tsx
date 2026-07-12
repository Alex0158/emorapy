import type { MouseEvent } from "react";
import { Loader2 } from "lucide-react";
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
import { t } from "@/utils/i18n";
import type { PendingUserAction } from "./UserDirectoryTable";

interface UserActionDialogProps {
	pendingAction: PendingUserAction | null;
	isPending: boolean;
	onClose: () => void;
	onConfirm: (action: PendingUserAction) => void;
}

export default function UserActionDialog({
	pendingAction,
	isPending,
	onClose,
	onConfirm,
}: UserActionDialogProps) {
	const actionTitle = pendingAction
		? t(
				{
					lock: "admin.users.confirmLock30m",
					unlock: "admin.users.confirmUnlock",
					deactivate: "admin.users.confirmDeactivate",
					activate: "admin.users.confirmActivate",
				}[pendingAction.action],
			)
		: "";

	return (
		<AlertDialog
			open={Boolean(pendingAction)}
			onOpenChange={(open: boolean) => {
				if (!open && !isPending) onClose();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{actionTitle}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("admin.users.actionImpactHint")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				{pendingAction && (
					<dl className="divide-y rounded-lg border px-4 text-sm">
						<div className="flex justify-between gap-4 py-3">
							<dt className="text-muted-foreground">
								{t("admin.users.identity")}
							</dt>
							<dd className="text-right">
								<p className="font-medium">
									{pendingAction.row.nickname || "—"}
								</p>
								<p className="text-xs text-muted-foreground">
									{pendingAction.row.email}
								</p>
							</dd>
						</div>
						<div className="flex justify-between gap-4 py-3">
							<dt className="text-muted-foreground">
								{t("admin.users.audit")}
							</dt>
							<dd>{t("admin.users.auditHint")}</dd>
						</div>
					</dl>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>
						{t("common.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						disabled={!pendingAction || isPending}
						onClick={(event: MouseEvent<HTMLButtonElement>) => {
							event.preventDefault();
							if (pendingAction) onConfirm(pendingAction);
						}}
					>
						{isPending && <Loader2 className="size-4 animate-spin" />}
						{t("common.confirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
