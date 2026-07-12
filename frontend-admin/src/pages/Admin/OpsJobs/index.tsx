import { useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import SEO from "@/components/common/SEO";
import {
	AdminPageHeader,
	AdminPanel,
	AdminQueryState,
} from "@/components/common/AdminPage";
import { useAdminJobStats } from "@/hooks/useAdminJobStats";
import type { AdminJobStatsQuery } from "@/types/admin";
import { DEFAULT_ADMIN_JOB_STATS_QUERY } from "@/utils/adminJobStatsQuery";
import { t } from "@/utils/i18n";
import JobStatsDailyTable from "./JobStatsDailyTable";
import JobStatsSummary from "./JobStatsSummary";
import JobStatsTable from "./JobStatsTable";

export default function OpsJobsStatsPage() {
	const [query, setQuery] = useState<Required<AdminJobStatsQuery>>(
		DEFAULT_ADMIN_JOB_STATS_QUERY,
	);
	const [draftQuery, setDraftQuery] = useState<Required<AdminJobStatsQuery>>(
		DEFAULT_ADMIN_JOB_STATS_QUERY,
	);
	const statsQuery = useAdminJobStats(query, true);
	const data = statsQuery.data;

	return (
		<>
			<SEO title={t("admin.ops.title")} description={t("admin.ops.subtitle")} />
			<div className="space-y-6">
				<AdminPageHeader
					eyebrow={t("admin.nav.group.monitor")}
					title={t("admin.ops.heading")}
					description={t("admin.ops.subtitle")}
					updatedAt={statsQuery.dataUpdatedAt || undefined}
					actions={
						<Button
							variant="outline"
							size="sm"
							disabled={statsQuery.isFetching}
							onClick={() => void statsQuery.refetch()}
						>
							<RefreshCw
								className={
									statsQuery.isFetching ? "size-4 animate-spin" : "size-4"
								}
							/>
							{t("admin.common.refresh")}
						</Button>
					}
				/>

				<AdminPanel
					title={t("admin.ops.filterTitle")}
					description={t("admin.ops.filterHint")}
				>
					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[10rem_15rem_11rem_auto] xl:items-end">
						<div className="space-y-2">
							<Label htmlFor="admin-ops-days">{t("admin.ops.days")}</Label>
							<Select
								value={String(draftQuery.days)}
								onValueChange={(value: string) =>
									setDraftQuery((current) => ({
										...current,
										days: Number(value),
									}))
								}
							>
								<SelectTrigger id="admin-ops-days">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[1, 7, 14, 30, 90].map((days) => (
										<SelectItem key={days} value={String(days)}>
											{t("admin.ops.daysOption", { days })}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="admin-ops-rate-base">
								{t("admin.ops.rateBase")}
							</Label>
							<Select
								value={draftQuery.includeRunning ? "total" : "completed"}
								onValueChange={(value: string) =>
									setDraftQuery((current) => ({
										...current,
										includeRunning: value === "total",
									}))
								}
							>
								<SelectTrigger id="admin-ops-rate-base">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="total">
										{t("admin.ops.rateModeTotal")}
									</SelectItem>
									<SelectItem value="completed">
										{t("admin.ops.rateModeCompleted")}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="admin-ops-max-rows">
								{t("admin.ops.sampleSize")}
							</Label>
							<Select
								value={String(draftQuery.maxRows)}
								onValueChange={(value: string) =>
									setDraftQuery((current) => ({
										...current,
										maxRows: Number(value),
									}))
								}
							>
								<SelectTrigger id="admin-ops-max-rows">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[1000, 5000, 10000, 20000].map((rows) => (
										<SelectItem key={rows} value={String(rows)}>
											{rows.toLocaleString()}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<Button
							onClick={() => setQuery(draftQuery)}
							disabled={statsQuery.isFetching}
						>
							{t("admin.common.applyFilters")}
						</Button>
					</div>
				</AdminPanel>

				<AdminQueryState
					loading={statsQuery.isLoading}
					error={Boolean(statsQuery.error)}
					onRetry={() => void statsQuery.refetch()}
				>
					{data && (
						<>
							{data.statsMeta.sampled && (
								<div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
									<Info className="mt-0.5 size-4 shrink-0 text-primary" />
									<p>
										{t("admin.ops.sampledHint").replace(
											"{rows}",
											String(data.statsMeta.returnedRows),
										)}
									</p>
								</div>
							)}
							<JobStatsSummary data={data} />
							<AdminPanel
								title={t("admin.ops.attentionTableTitle")}
								description={t("admin.ops.attentionTableHint")}
							>
								<AdminQueryState empty={data.perJob.length === 0}>
									<JobStatsTable rows={data.perJob} />
								</AdminQueryState>
							</AdminPanel>
							<AdminPanel
								title={t("admin.ops.dailyTitle")}
								description={t("admin.ops.dailyHint")}
							>
								<AdminQueryState empty={data.dailyBuckets.length === 0}>
									<JobStatsDailyTable rows={data.dailyBuckets} />
								</AdminQueryState>
							</AdminPanel>
						</>
					)}
				</AdminQueryState>
			</div>
		</>
	);
}
