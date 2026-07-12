import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminPanel } from "@/components/common/AdminPage";
import { Button } from "@/components/ui/button";
import { useAdminMe } from "@/hooks/useAdminMe";
import { adminApi } from "@/services/api/admin";
import type { AdminAdminUserItem } from "@/types/admin";
import { t } from "@/utils/i18n";
import { AdminUserCreateDialog } from "./AdminUserCreateDialog";
import { AdminUserEditDialog } from "./AdminUserEditDialog";
import {
	EMPTY_ADMIN_USER_DRAFT,
	type AdminRoleKey,
	type AdminUserDraft,
} from "./AdminUserFormFields";
import {
	type AdminUserConfirmAction,
	AdminUsersTable,
} from "./AdminUsersTable";

export default function AdminUsersSettingsPanel() {
	const queryClient = useQueryClient();
	const adminMeQuery = useAdminMe(true);
	const [createOpen, setCreateOpen] = useState(false);
	const [editingAdmin, setEditingAdmin] = useState<AdminAdminUserItem | null>(
		null,
	);
	const [draft, setDraft] = useState<AdminUserDraft>(EMPTY_ADMIN_USER_DRAFT);
	const [confirmAction, setConfirmAction] =
		useState<AdminUserConfirmAction | null>(null);

	const query = useQuery({
		queryKey: ["admin", "admin-users"],
		queryFn: () => adminApi.listAdminUsers({ limit: 100, offset: 0 }),
	});
	const items = query.data?.items ?? [];
	const resetDraft = () => setDraft(EMPTY_ADMIN_USER_DRAFT);

	const createMutation = useMutation({
		mutationFn: () =>
			adminApi.createAdminUser({
				email: draft.email.trim(),
				name: draft.name.trim(),
				password: draft.password,
				roleKey: draft.roleKey,
			}),
		onSuccess: () => {
			toast.success(t("admin.settings.adminUsers.createSuccess"));
			setCreateOpen(false);
			resetDraft();
			void queryClient.invalidateQueries({
				queryKey: ["admin", "admin-users"],
			});
		},
		onError: () => toast.error(t("admin.settings.adminUsers.createFailed")),
	});

	const updateMutation = useMutation({
		mutationFn: (payload: {
			id: string;
			name?: string;
			roleKey?: AdminRoleKey;
			isActive?: boolean;
			password?: string;
		}) =>
			adminApi.updateAdminUser(payload.id, {
				name: payload.name,
				roleKey: payload.roleKey,
				isActive: payload.isActive,
				password: payload.password,
			}),
		onSuccess: () => {
			toast.success(t("admin.settings.adminUsers.updateSuccess"));
			setEditingAdmin(null);
			setConfirmAction(null);
			resetDraft();
			void queryClient.invalidateQueries({
				queryKey: ["admin", "admin-users"],
			});
		},
		onError: () => toast.error(t("admin.settings.adminUsers.updateFailed")),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => adminApi.deleteAdminUser(id),
		onSuccess: () => {
			toast.success(t("admin.settings.adminUsers.deleteSuccess"));
			setConfirmAction(null);
			void queryClient.invalidateQueries({
				queryKey: ["admin", "admin-users"],
			});
		},
		onError: () => toast.error(t("admin.settings.adminUsers.deleteFailed")),
	});

	const openEditor = (admin: AdminAdminUserItem) => {
		setEditingAdmin(admin);
		setDraft({
			email: admin.email,
			name: admin.name,
			password: "",
			roleKey: admin.role.key as AdminRoleKey,
			isActive: admin.is_active,
		});
	};
	const createIsValid =
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) &&
		draft.name.trim().length >= 2 &&
		draft.password.length >= 10;
	const editIsValid =
		draft.name.trim().length >= 2 &&
		(!draft.password || draft.password.length >= 10);

	return (
		<>
			<AdminPanel
				title={t("admin.settings.adminUsers.title")}
				description={t("admin.settings.adminUsers.panelHint")}
				actions={
					<Button
						size="sm"
						onClick={() => {
							resetDraft();
							setCreateOpen(true);
						}}
					>
						<Plus className="size-4" />
						{t("admin.settings.adminUsers.create")}
					</Button>
				}
			>
				<AdminUsersTable
					items={items}
					loading={query.isLoading}
					hasError={Boolean(query.error)}
					currentAdminId={adminMeQuery.data?.admin.id}
					updatePending={updateMutation.isPending}
					deletePending={deleteMutation.isPending}
					confirmAction={confirmAction}
					onRetry={() => void query.refetch()}
					onEdit={openEditor}
					onConfirmActionChange={setConfirmAction}
					onConfirmAction={(action) => {
						if (action.type === "delete") {
							deleteMutation.mutate(action.admin.id);
							return;
						}
						updateMutation.mutate({
							id: action.admin.id,
							isActive: !action.admin.is_active,
						});
					}}
				/>
			</AdminPanel>

			<AdminUserCreateDialog
				open={createOpen}
				draft={draft}
				isPending={createMutation.isPending}
				isValid={createIsValid}
				onOpenChange={(open) => {
					setCreateOpen(open);
					if (!open) resetDraft();
				}}
				onCancel={() => setCreateOpen(false)}
				onDraftChange={setDraft}
				onSubmit={() => createMutation.mutate()}
			/>

			<AdminUserEditDialog
				admin={editingAdmin}
				draft={draft}
				isPending={updateMutation.isPending}
				isValid={editIsValid}
				onOpenChange={(open) => {
					if (!open) {
						setEditingAdmin(null);
						resetDraft();
					}
				}}
				onCancel={() => setEditingAdmin(null)}
				onDraftChange={setDraft}
				onSubmit={() => {
					if (!editingAdmin) return;
					updateMutation.mutate({
						id: editingAdmin.id,
						name: draft.name.trim(),
						roleKey: draft.roleKey,
						isActive: draft.isActive,
						password: draft.password || undefined,
					});
				}}
			/>
		</>
	);
}
