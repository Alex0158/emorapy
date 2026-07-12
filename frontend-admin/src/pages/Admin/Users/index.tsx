import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPageHeader, AdminPanel } from "@/components/common/AdminPage";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { adminApi } from "@/services/api/admin";
import { t } from "@/utils/i18n";
import UserActionDialog from "./UserActionDialog";
import UserDetailSheet from "./UserDetailSheet";
import UserDirectoryTable, {
	type PendingUserAction,
	type UserAction,
} from "./UserDirectoryTable";

const PAGE_SIZE = 25;

export default function AdminUsersPage() {
	const queryClient = useQueryClient();
	const { hasPermission: canWriteUsers } = useAdminAccess(
		["users:write"],
		true,
	);
	const [searchInput, setSearchInput] = useState("");
	const [query, setQuery] = useState("");
	const [offset, setOffset] = useState(0);
	const [selectedUserId, setSelectedUserId] = useState("");
	const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(
		null,
	);

	const usersQuery = useQuery({
		queryKey: ["admin", "users", query, offset],
		queryFn: () => adminApi.listUsers({ q: query, limit: PAGE_SIZE, offset }),
	});
	const detailQuery = useQuery({
		queryKey: ["admin", "users", "detail", selectedUserId],
		queryFn: () => adminApi.getUserDetail(selectedUserId),
		enabled: Boolean(selectedUserId),
	});
	const statusMutation = useMutation({
		mutationFn: ({
			userId,
			action,
			lockMinutes,
		}: {
			userId: string;
			action: UserAction;
			lockMinutes?: number;
		}) => adminApi.updateUserStatus(userId, { action, lockMinutes }),
		onSuccess: () => {
			toast.success(t("admin.users.updateSuccess"));
			setPendingAction(null);
			void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
		},
		onError: (error: unknown) => {
			const err = error as { code?: string } | null;
			toast.error(
				err?.code === "FORBIDDEN"
					? t("admin.ops.accessDenied")
					: t("admin.users.updateFailed"),
			);
		},
	});

	const users = usersQuery.data?.items ?? [];
	const total = usersQuery.data?.total ?? 0;
	const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const submitSearch = (event: React.FormEvent) => {
		event.preventDefault();
		setOffset(0);
		setQuery(searchInput.trim());
	};

	return (
		<div className="space-y-6">
			<AdminPageHeader
				eyebrow={t("admin.nav.group.operate")}
				title={t("admin.users.heading")}
				description={t("admin.users.subtitle")}
				updatedAt={usersQuery.dataUpdatedAt || undefined}
				actions={
					<Button
						variant="outline"
						size="sm"
						disabled={usersQuery.isFetching}
						onClick={() => void usersQuery.refetch()}
					>
						<RefreshCw
							className={
								usersQuery.isFetching ? "size-4 animate-spin" : "size-4"
							}
						/>
						{t("admin.common.refresh")}
					</Button>
				}
			/>

			{!canWriteUsers && (
				<div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
					<AlertTriangle className="mt-0.5 size-4 text-warning" />
					<div>
						<p className="text-sm font-medium">
							{t("admin.users.readOnlyTitle")}
						</p>
						<p className="text-xs text-muted-foreground">
							{t("admin.users.writeDenied")}
						</p>
					</div>
				</div>
			)}

			<AdminPanel
				title={t("admin.users.directoryTitle")}
				description={t("admin.users.directoryHint")}
			>
				<form
					onSubmit={submitSearch}
					className="mb-5 flex flex-col gap-2 sm:flex-row"
				>
					<div className="relative flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label={t("admin.users.search")}
							autoComplete="off"
							value={searchInput}
							onChange={(event) => setSearchInput(event.target.value)}
							placeholder={t("admin.users.search")}
							className="pl-9"
						/>
					</div>
					<Button type="submit">{t("admin.users.searchAction")}</Button>
					{(query || searchInput) && (
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								setSearchInput("");
								setQuery("");
								setOffset(0);
							}}
						>
							{t("admin.common.clear")}
						</Button>
					)}
				</form>

				<UserDirectoryTable
					users={users}
					total={total}
					currentPage={currentPage}
					totalPages={totalPages}
					offset={offset}
					pageSize={PAGE_SIZE}
					loading={usersQuery.isLoading}
					error={Boolean(usersQuery.error)}
					statusPending={statusMutation.isPending}
					canWrite={canWriteUsers}
					onRetry={() => void usersQuery.refetch()}
					onSelectUser={setSelectedUserId}
					onAction={setPendingAction}
					onPreviousPage={() =>
						setOffset((current) => Math.max(0, current - PAGE_SIZE))
					}
					onNextPage={() => setOffset((current) => current + PAGE_SIZE)}
				/>
			</AdminPanel>

			<UserDetailSheet
				open={Boolean(selectedUserId)}
				detail={detailQuery.data?.user}
				loading={detailQuery.isLoading}
				error={Boolean(detailQuery.error)}
				onClose={() => setSelectedUserId("")}
				onRetry={() => void detailQuery.refetch()}
			/>
			<UserActionDialog
				pendingAction={pendingAction}
				isPending={statusMutation.isPending}
				onClose={() => setPendingAction(null)}
				onConfirm={(action) =>
					statusMutation.mutate({
						userId: action.row.id,
						action: action.action,
						lockMinutes: action.lockMinutes,
					})
				}
			/>
		</div>
	);
}
