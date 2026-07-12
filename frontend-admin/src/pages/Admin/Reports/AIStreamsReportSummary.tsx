import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	AdminMetricStrip,
	AdminPanel,
	AdminQueryState,
	AdminStatusBadge,
} from "@/components/common/AdminPage";
import type {
	AdminAIStreamReportData,
	AdminAIStreamSessionListData,
} from "@/types/admin";
import { formatAdminNumber, humanizeAdminKey } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

const STREAM_STATUSES = [
	"created",
	"queued",
	"started",
	"streaming",
	"completed",
	"persisted",
	"failed",
	"cancelled",
];

interface AIStreamsReportSummaryProps {
	days: number;
	source: AdminAIStreamSessionListData["source"];
	status: string | undefined;
	overview: AdminAIStreamReportData | undefined;
	loading: boolean;
	error: boolean;
	refreshing: boolean;
	onDaysChange: (days: number) => void;
	onSourceChange: (source: AdminAIStreamSessionListData["source"]) => void;
	onStatusChange: (status: string | undefined) => void;
	onRefresh: () => void;
	onRetry: () => void;
}

export default function AIStreamsReportSummary({
	days,
	source,
	status,
	overview,
	loading,
	error,
	refreshing,
	onDaysChange,
	onSourceChange,
	onStatusChange,
	onRefresh,
	onRetry,
}: AIStreamsReportSummaryProps) {
	return (
		<>
			<AdminPanel
				title={t("admin.reports.aiStreamsFilters")}
				description={t("admin.reports.aiStreamsFiltersHint")}
				actions={
					<Button
						variant="outline"
						size="sm"
						onClick={onRefresh}
						disabled={refreshing}
					>
						<RefreshCw
							className={refreshing ? "size-4 animate-spin" : "size-4"}
						/>
						{t("admin.common.refresh")}
					</Button>
				}
			>
				<div className="grid gap-4 sm:grid-cols-3">
					<div className="space-y-2">
						<Label htmlFor="stream-days">
							{t("admin.reports.aiStreamsWindowDays")}
						</Label>
						<Select
							value={String(days)}
							onValueChange={(value: string) =>
								onDaysChange(Number(value))
							}
						>
							<SelectTrigger id="stream-days">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{[1, 7, 14, 30, 90].map((value) => (
									<SelectItem key={value} value={String(value)}>
										{t("admin.ops.daysOption", { days: value })}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="stream-source">
							{t("admin.reports.aiStreamsSourceFilter")}
						</Label>
						<Select
							value={source}
							onValueChange={(value: string) =>
								onSourceChange(
									value as AdminAIStreamSessionListData["source"],
								)
							}
						>
							<SelectTrigger id="stream-source">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">
									{t("admin.reports.aiStreamsSourceAll")}
								</SelectItem>
								<SelectItem value="live">
									{t("admin.reports.aiStreamsSourceLive")}
								</SelectItem>
								<SelectItem value="archive">
									{t("admin.reports.aiStreamsSourceArchive")}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="stream-status">
							{t("admin.reports.aiStreamsStatusFilter")}
						</Label>
						<Select
							value={status ?? "__all__"}
							onValueChange={(value: string) =>
								onStatusChange(value === "__all__" ? undefined : value)
							}
						>
							<SelectTrigger id="stream-status">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__all__">
									{t("admin.reports.aiStreamsStatusAll")}
								</SelectItem>
								{STREAM_STATUSES.map((value) => (
									<SelectItem key={value} value={value}>
										{humanizeAdminKey(value)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</AdminPanel>

			<AdminQueryState loading={loading} error={error} onRetry={onRetry}>
				{overview && (
					<>
						<AdminMetricStrip
							items={[
								{
									label: t("admin.reports.aiStreamsRecentSessions"),
									value: formatAdminNumber(overview.totals.recentSessions),
								},
								{
									label: t("admin.reports.aiStreamsActiveSessions"),
									value: formatAdminNumber(overview.totals.activeSessions),
									tone:
										overview.totals.activeSessions > 0
											? "warning"
											: "default",
								},
								{
									label: t("admin.reports.aiStreamsRecentEvents"),
									value: formatAdminNumber(overview.totals.recentEvents),
								},
								{
									label: t("admin.reports.aiStreamsArchivedSessions"),
									value: formatAdminNumber(overview.totals.archivedSessions),
								},
							]}
						/>
						<AdminPanel
							title={t("admin.reports.aiStreamsRetention")}
							description={t("admin.reports.aiStreamsRetentionHint")}
						>
							<dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-4">
								<div className="bg-surface p-4">
									<dt className="text-xs text-muted-foreground">
										{t("admin.reports.aiStreamsBackendMode")}
									</dt>
									<dd className="mt-1 font-medium">
										{humanizeAdminKey(overview.retentionPolicy.backendMode)}
									</dd>
								</div>
								<div className="bg-surface p-4">
									<dt className="text-xs text-muted-foreground">
										{t("admin.reports.aiStreamsArchiveEnabled")}
									</dt>
									<dd className="mt-1">
										<AdminStatusBadge
											status={overview.retentionPolicy.archiveEnabled}
											label={
												overview.retentionPolicy.archiveEnabled
													? t("admin.common.enabled")
													: t("admin.common.disabled")
											}
										/>
									</dd>
								</div>
								<div className="bg-surface p-4">
									<dt className="text-xs text-muted-foreground">
										{t("admin.reports.aiStreamsSessionRetention")}
									</dt>
									<dd className="mt-1 font-medium">
										{t("admin.ops.daysOption", {
											days: overview.retentionPolicy.sessionRetentionDays,
										})}
									</dd>
								</div>
								<div className="bg-surface p-4">
									<dt className="text-xs text-muted-foreground">
										{t("admin.reports.aiStreamsEventRetention")}
									</dt>
									<dd className="mt-1 font-medium">
										{t("admin.ops.daysOption", {
											days: overview.retentionPolicy.eventRetentionDays,
										})}
									</dd>
								</div>
							</dl>
						</AdminPanel>
					</>
				)}
			</AdminQueryState>
		</>
	);
}
