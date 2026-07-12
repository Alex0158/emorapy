import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { AdminStatusBadge } from "@/components/common/AdminPage";
import type { AdminJobStatsPerJob } from "@/types/admin";
import {
	formatAdminDateTime,
	formatAdminNumber,
	formatAdminPercent,
	formatDurationMs,
	humanizeAdminKey,
} from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

const PAGE_SIZE = 12;

export default function JobStatsTable({
	rows,
}: {
	rows: AdminJobStatsPerJob[];
}) {
	const [page, setPage] = useState(1);
	const sortedRows = useMemo(
		() =>
			[...rows].sort(
				(left, right) =>
					right.failedRuns - left.failedRuns ||
					right.failureRate - left.failureRate,
			),
		[rows],
	);
	const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
	const visibleRows = sortedRows.slice(
		(page - 1) * PAGE_SIZE,
		page * PAGE_SIZE,
	);

	useEffect(() => {
		setPage((current) => Math.min(current, pageCount));
	}, [pageCount]);

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t("admin.ops.jobKey")}</TableHead>
						<TableHead>{t("admin.ops.totalRuns")}</TableHead>
						<TableHead>{t("admin.ops.failedRuns")}</TableHead>
						<TableHead>{t("admin.ops.failureRate")}</TableHead>
						<TableHead>{t("admin.ops.avgDurationMs")}</TableHead>
						<TableHead>{t("admin.ops.affected")}</TableHead>
						<TableHead>{t("admin.ops.lastRun")}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{visibleRows.map((row) => (
						<TableRow key={row.jobKey}>
							<TableCell>
								<p className="font-medium">{humanizeAdminKey(row.jobKey)}</p>
								<code className="text-[11px] text-muted-foreground">
									{row.jobKey}
								</code>
							</TableCell>
							<TableCell>{formatAdminNumber(row.totalRuns)}</TableCell>
							<TableCell>
								<AdminStatusBadge
									status={row.failedRuns > 0 ? "failed" : "success"}
									label={formatAdminNumber(row.failedRuns)}
								/>
							</TableCell>
							<TableCell>{formatAdminPercent(row.failureRate)}</TableCell>
							<TableCell>{formatDurationMs(row.avgDurationMs)}</TableCell>
							<TableCell>{formatAdminNumber(row.totalAffectedCount)}</TableCell>
							<TableCell>{formatAdminDateTime(row.lastRunAt)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{pageCount > 1 && (
				<div className="mt-4 flex items-center justify-between border-t pt-4">
					<p className="text-xs text-muted-foreground">
						{t("admin.common.pageOf", { page, total: pageCount })}
					</p>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onClick={() => setPage((current) => current - 1)}
						>
							{t("admin.common.previous")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={page >= pageCount}
							onClick={() => setPage((current) => current + 1)}
						>
							{t("admin.common.next")}
						</Button>
					</div>
				</div>
			)}
		</>
	);
}
