import { Loader2 } from "lucide-react";
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
import { t } from "@/utils/i18n";
import {
	AdminUserRoleSelect,
	type AdminUserDraft,
} from "./AdminUserFormFields";

interface AdminUserCreateDialogProps {
	open: boolean;
	draft: AdminUserDraft;
	isPending: boolean;
	isValid: boolean;
	onOpenChange: (open: boolean) => void;
	onCancel: () => void;
	onDraftChange: (draft: AdminUserDraft) => void;
	onSubmit: () => void;
}

export function AdminUserCreateDialog({
	open,
	draft,
	isPending,
	isValid,
	onOpenChange,
	onCancel,
	onDraftChange,
	onSubmit,
}: AdminUserCreateDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{t("admin.settings.adminUsers.createTitle")}
					</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						if (isValid && !isPending) onSubmit();
					}}
				>
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label htmlFor="create-admin-email">
								{t("admin.settings.adminUsers.email")}
							</Label>
							<Input
								id="create-admin-email"
								type="email"
								autoComplete="email"
								required
								value={draft.email}
								onChange={(event) =>
									onDraftChange({ ...draft, email: event.target.value })
								}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-admin-name">
								{t("admin.settings.adminUsers.name")}
							</Label>
							<Input
								id="create-admin-name"
								autoComplete="name"
								required
								value={draft.name}
								onChange={(event) =>
									onDraftChange({ ...draft, name: event.target.value })
								}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-admin-password">
								{t("admin.settings.adminUsers.password")}
							</Label>
							<Input
								id="create-admin-password"
								type="password"
								autoComplete="new-password"
								minLength={10}
								required
								value={draft.password}
								onChange={(event) =>
									onDraftChange({ ...draft, password: event.target.value })
								}
							/>
							<p className="text-xs text-muted-foreground">
								{t("admin.settings.adminUsers.passwordMinLength")}
							</p>
						</div>
						<AdminUserRoleSelect
							value={draft.roleKey}
							onChange={(roleKey) => onDraftChange({ ...draft, roleKey })}
						/>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onCancel}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={!isValid || isPending}>
							{isPending && <Loader2 className="size-4 animate-spin" />}
							{t("admin.settings.adminUsers.create")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
