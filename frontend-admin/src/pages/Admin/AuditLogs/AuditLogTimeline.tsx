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
import type { AdminAuditLogItem } from "@/types/admin";
import {
	formatAdminDateTime,
	formatAdminNumber,
	humanizeAdminKey,
} from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

interface AuditLogTimelineProps {
	items: AdminAuditLogItem[];
	total: number;
	currentPage: number;
	totalPages: number;
	offset: number;
	pageSize: number;
	loading: boolean;
	error: boolean;
	onRetry: () => void;
	onInspect: (item: AdminAuditLogItem) => void;
	onPreviousPage: () => void;
	onNextPage: () => void;
}

function detailSummary(detail: unknown): string {
	if (!detail || typeof detail !== "object" || Array.isArray(detail))
		return detail ? String(detail) : "—";
	const keys = Object.keys(detail);
	return keys.length === 0
		? "—"
		: keys.slice(0, 3).map(humanizeAdminKey).join(", ");
}

export default function AuditLogTimeline({
	items,
	total,
	currentPage,
	totalPages,
	offset,
	pageSize,
	loading,
	error,
	onRetry,
	onInspect,
	onPreviousPage,
	onNextPage,
}: AuditLogTimelineProps) {
	return (
		<AdminQueryState
			loading={loading}
			error={error}
			empty={items.length === 0}
			onRetry={onRetry}
		>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t("admin.audit.createdAt")}</TableHead>
						<TableHead>{t("admin.audit.actor")}</TableHead>
						<TableHead>{t("admin.audit.entityType")}</TableHead>
						<TableHead>{t("admin.audit.action")}</TableHead>
						<TableHead>{t("admin.audit.detail")}</TableHead>
						<TableHead />
					</TableRow>
				</TableHeader>
				<TableBody>
					{items.map((row) => (
						<TableRow key={row.id}>
							<TableCell>{formatAdminDateTime(row.created_at)}</TableCell>
							<TableCell>
								<p className="font-medium">
									{humanizeAdminKey(row.actor_type)}
								</p>
								<code className="text-[11px] text-muted-foreground">
									{row.actor_id ? `${row.actor_id.slice(0, 8)}…` : "—"}
								</code>
							</TableCell>
							<TableCell>
								<AdminStatusBadge
									status="neutral"
									label={humanizeAdminKey(row.entity_type)}
								/>
							</TableCell>
							<TableCell>{humanizeAdminKey(row.action)}</TableCell>
							<TableCell className="max-w-56 truncate text-muted-foreground">
								{detailSummary(row.detail)}
							</TableCell>
							<TableCell className="text-right">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => onInspect(row)}
								>
									{t("admin.audit.inspect")}
								</Button>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<div className="mt-4 flex items-center justify-between border-t pt-4">
				<p className="text-xs text-muted-foreground">
					{t("admin.audit.resultCount", {
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
