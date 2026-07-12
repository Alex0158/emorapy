import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminAdminUserItem } from "@/types/admin";
import { t } from "@/utils/i18n";
import {
	AdminUserRoleSelect,
	type AdminUserDraft,
} from "./AdminUserFormFields";

interface AdminUserEditDialogProps {
	admin: AdminAdminUserItem | null;
	draft: AdminUserDraft;
	isPending: boolean;
	isValid: boolean;
	onOpenChange: (open: boolean) => void;
	onCancel: () => void;
	onDraftChange: (draft: AdminUserDraft) => void;
	onSubmit: () => void;
}

export function AdminUserEditDialog({
	admin,
	draft,
	isPending,
	isValid,
	onOpenChange,
	onCancel,
	onDraftChange,
	onSubmit,
}: AdminUserEditDialogProps) {
	return (
		<Dialog open={Boolean(admin)} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{t("admin.settings.adminUsers.editTitle")}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="rounded-lg border bg-muted/30 p-3">
						<p className="text-sm font-medium">{admin?.email}</p>
						<p className="text-xs text-muted-foreground">
							{t("admin.settings.adminUsers.editImpactHint")}
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-admin-name">
							{t("admin.settings.adminUsers.name")}
						</Label>
						<Input
							id="edit-admin-name"
							autoComplete="name"
							value={draft.name}
							onChange={(event) =>
								onDraftChange({ ...draft, name: event.target.value })
							}
						/>
					</div>
					<AdminUserRoleSelect
						value={draft.roleKey}
						onChange={(roleKey) => onDraftChange({ ...draft, roleKey })}
					/>
					<div className="flex items-center gap-3 rounded-lg border p-3">
						<Switch
							id="edit-admin-active"
							checked={draft.isActive}
							onCheckedChange={(isActive: boolean) =>
								onDraftChange({ ...draft, isActive })
							}
						/>
						<Label htmlFor="edit-admin-active">
							{t("admin.settings.adminUsers.activeLabel")}
						</Label>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-admin-password">
							{t("admin.settings.adminUsers.resetPasswordLabel")}
						</Label>
						<div className="relative">
							<KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="edit-admin-password"
								type="password"
								autoComplete="new-password"
								value={draft.password}
								onChange={(event) =>
									onDraftChange({ ...draft, password: event.target.value })
								}
								className="pl-9"
							/>
						</div>
						<p className="text-xs text-muted-foreground">
							{t("admin.settings.adminUsers.passwordOptionalHint")}
						</p>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel}>
						{t("common.cancel")}
					</Button>
					<Button disabled={!admin || !isValid || isPending} onClick={onSubmit}>
						{isPending && <Loader2 className="size-4 animate-spin" />}
						{t("common.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
