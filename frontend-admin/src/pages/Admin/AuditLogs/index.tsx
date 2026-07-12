import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdminPageHeader, AdminPanel } from "@/components/common/AdminPage";
import { adminApi } from "@/services/api/admin";
import type { AdminAuditLogItem } from "@/types/admin";
import { t } from "@/utils/i18n";
import AuditLogDetailSheet from "./AuditLogDetailSheet";
import AuditLogFilters, { type AuditFilters } from "./AuditLogFilters";
import AuditLogTimeline from "./AuditLogTimeline";

const PAGE_SIZE = 25;
const EMPTY_FILTERS: AuditFilters = {
	entityType: "",
	action: "",
	from: "",
	to: "",
};

export default function AdminAuditLogsPage() {
	const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS);
	const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
	const [offset, setOffset] = useState(0);
	const [exporting, setExporting] = useState(false);
	const [selectedLog, setSelectedLog] = useState<AdminAuditLogItem | null>(
		null,
	);
	const query = useQuery({
		queryKey: ["admin", "audit-logs", filters, offset],
		queryFn: () =>
			adminApi.listAuditLogs({
				entityType: filters.entityType || undefined,
				action: filters.action || undefined,
				from: filters.from ? dayjs(filters.from).toISOString() : undefined,
				to: filters.to ? dayjs(filters.to).toISOString() : undefined,
				limit: PAGE_SIZE,
				offset,
			}),
	});
	const items = query.data?.items ?? [];
	const total = query.data?.total ?? 0;
	const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const applyFilters = (event: React.FormEvent) => {
		event.preventDefault();
		if (draft.from && draft.to && dayjs(draft.from).isAfter(dayjs(draft.to))) {
			toast.error(t("admin.audit.invalidRange"));
			return;
		}
		setOffset(0);
		setFilters(draft);
	};

	const clearFilters = () => {
		setDraft(EMPTY_FILTERS);
		setFilters(EMPTY_FILTERS);
		setOffset(0);
	};

	const downloadCsv = async () => {
		setExporting(true);
		try {
			const blob = await adminApi.downloadAuditLogsCsv({
				entityType: filters.entityType || undefined,
				action: filters.action || undefined,
				from: filters.from ? dayjs(filters.from).toISOString() : undefined,
				to: filters.to ? dayjs(filters.to).toISOString() : undefined,
			});
			const url = window.URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `admin-audit-logs-${dayjs().format("YYYYMMDD-HHmmss")}.csv`;
			anchor.click();
			window.URL.revokeObjectURL(url);
		} catch {
			toast.error(t("admin.audit.exportFailed"));
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="space-y-6">
			<AdminPageHeader
				eyebrow={t("admin.nav.group.govern")}
				title={t("admin.audit.heading")}
				description={t("admin.audit.subtitle")}
				updatedAt={query.dataUpdatedAt || undefined}
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							disabled={query.isFetching}
							onClick={() => void query.refetch()}
						>
							<RefreshCw
								className={query.isFetching ? "size-4 animate-spin" : "size-4"}
							/>
							{t("admin.common.refresh")}
						</Button>
						<Button size="sm" disabled={exporting} onClick={downloadCsv}>
							{exporting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Download className="size-4" />
							)}
							{t("admin.audit.exportCsv")}
						</Button>
					</>
				}
			/>

			<AdminPanel
				title={t("admin.audit.filterTitle")}
				description={t("admin.audit.filterHint")}
			>
				<AuditLogFilters
					value={draft}
					onChange={setDraft}
					onSubmit={applyFilters}
					onClear={clearFilters}
				/>
			</AdminPanel>

			<AdminPanel
				title={t("admin.audit.timelineTitle")}
				description={t("admin.audit.timelineHint")}
			>
				<AuditLogTimeline
					items={items}
					total={total}
					currentPage={currentPage}
					totalPages={totalPages}
					offset={offset}
					pageSize={PAGE_SIZE}
					loading={query.isLoading}
					error={Boolean(query.error)}
					onRetry={() => void query.refetch()}
					onInspect={setSelectedLog}
					onPreviousPage={() =>
						setOffset((current) => Math.max(0, current - PAGE_SIZE))
					}
					onNextPage={() => setOffset((current) => current + PAGE_SIZE)}
				/>
			</AdminPanel>
			<AuditLogDetailSheet
				log={selectedLog}
				onClose={() => setSelectedLog(null)}
			/>
		</div>
	);
}
