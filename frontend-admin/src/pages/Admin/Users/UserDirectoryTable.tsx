import { Lock, UserRound, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	AdminQueryState,
	AdminStatusBadge,
} from "@/components/common/AdminPage";
import type { AdminAppUserItem } from "@/types/admin";
import { formatAdminDateTime, formatAdminNumber } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

export type UserAction = "lock" | "unlock" | "deactivate" | "activate";

export interface PendingUserAction {
	row: AdminAppUserItem;
	action: UserAction;
	lockMinutes?: number;
}

interface UserDirectoryTableProps {
	users: AdminAppUserItem[];
	total: number;
	currentPage: number;
	totalPages: number;
	offset: number;
	pageSize: number;
	loading: boolean;
	error: boolean;
	statusPending: boolean;
	canWrite: boolean;
	onRetry: () => void;
	onSelectUser: (userId: string) => void;
	onAction: (action: PendingUserAction) => void;
	onPreviousPage: () => void;
	onNextPage: () => void;
}

function isUserCurrentlyLocked(
	lockedUntil: string | null | undefined,
): boolean {
	if (!lockedUntil) return false;
	const time = new Date(lockedUntil).getTime();
	return Number.isFinite(time) && time > Date.now();
}

export default function UserDirectoryTable({
	users,
	total,
	currentPage,
	totalPages,
	offset,
	pageSize,
	loading,
	error,
	statusPending,
	canWrite,
	onRetry,
	onSelectUser,
	onAction,
	onPreviousPage,
	onNextPage,
}: UserDirectoryTableProps) {
	return (
		<AdminQueryState
			loading={loading}
			error={error}
			empty={users.length === 0}
			onRetry={onRetry}
		>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t("admin.users.identity")}</TableHead>
						<TableHead>{t("admin.users.active")}</TableHead>
						<TableHead>{t("admin.users.verified")}</TableHead>
						<TableHead>{t("admin.users.lastLogin")}</TableHead>
						<TableHead>{t("admin.users.createdAt")}</TableHead>
						<TableHead className="text-right">
							{t("admin.users.actions")}
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{users.map((row) => {
						const locked = isUserCurrentlyLocked(row.locked_until);
						return (
							<TableRow key={row.id}>
								<TableCell>
									<p className="font-medium">
										{row.nickname || t("admin.users.noNickname")}
									</p>
									<p className="text-xs text-muted-foreground">{row.email}</p>
								</TableCell>
								<TableCell>
									<AdminStatusBadge
										status={
											row.is_active
												? locked
													? "pending"
													: "active"
												: "disabled"
										}
										label={
											locked
												? t("admin.users.locked")
												: row.is_active
													? t("admin.users.activeYes")
													: t("admin.users.activeNo")
										}
									/>
								</TableCell>
								<TableCell>
									<AdminStatusBadge
										status={row.email_verified}
										label={
											row.email_verified
												? t("admin.users.verifiedYes")
												: t("admin.users.verifiedNo")
										}
									/>
								</TableCell>
								<TableCell>{formatAdminDateTime(row.last_login_at)}</TableCell>
								<TableCell>{formatAdminDateTime(row.created_at)}</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-1.5">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onSelectUser(row.id)}
										>
											<UserRound className="size-3.5" />
											{t("admin.users.detail")}
										</Button>
										<Button
											variant="outline"
											size="sm"
											disabled={!canWrite || statusPending}
											onClick={() =>
												onAction({
													row,
													action: locked ? "unlock" : "lock",
													lockMinutes: 30,
												})
											}
										>
											<Lock className="size-3.5" />
											{locked
												? t("admin.users.unlock")
												: t("admin.users.lock30m")}
										</Button>
										<Button
											variant={row.is_active ? "destructive" : "outline"}
											size="sm"
											disabled={!canWrite || statusPending}
											onClick={() =>
												onAction({
													row,
													action: row.is_active ? "deactivate" : "activate",
												})
											}
										>
											<UserX className="size-3.5" />
											{row.is_active
												? t("admin.users.deactivate")
												: t("admin.users.activate")}
										</Button>
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
			<div className="mt-4 flex items-center justify-between border-t pt-4">
				<p className="text-xs text-muted-foreground">
					{t("admin.users.resultCount", {
						count: formatAdminNumber(total),
					})}{" "}
					· {t("admin.common.pageOf", { page: currentPage, total: totalPages })}
				</p>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={offset === 0}
						onClick={onPreviousPage}
					>
						{t("admin.common.previous")}
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={offset + pageSize >= total}
						onClick={onNextPage}
					>
						{t("admin.common.next")}
					</Button>
				</div>
			</div>
		</AdminQueryState>
	);
}
