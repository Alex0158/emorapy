import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
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
	AdminMetricStrip,
	AdminPanel,
	AdminQueryState,
	AdminStatusBadge,
} from "@/components/common/AdminPage";
import { adminApi } from "@/services/api/admin";
import { formatAdminDateTime, formatAdminNumber } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

export default function CostsPanel() {
	const query = useQuery({
		queryKey: ["admin", "reports", "costs"],
		queryFn: adminApi.getReportCosts,
	});
	const costs = query.data;
	const dates = Array.from(
		new Set([
			...(costs?.railway.dailyEgressGb ?? []).map((item) => item.date),
			...(costs?.openai.dailyCostUsd ?? []).map((item) => item.date),
		]),
	)
		.sort()
		.reverse();
	return (
		<div className="space-y-6 pt-4">
			<div className="flex justify-end">
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
			</div>
			<AdminQueryState
				loading={query.isLoading}
				error={Boolean(query.error)}
				onRetry={() => void query.refetch()}
			>
				{costs && (
					<>
						{costs.partial && (
							<div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
								<AlertTriangle className="mt-0.5 size-4 text-warning" />
								<div>
									<p className="text-sm font-medium">
										{t("admin.reports.costsPartial")}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{costs.reasons.join("; ") ||
											t("admin.reports.partialUnknown")}
									</p>
								</div>
							</div>
						)}
						<AdminMetricStrip
							items={[
								{
									label: t("admin.reports.openaiCost24h"),
									value: `$${costs.summary.openaiCostUsd24h.toFixed(2)}`,
								},
								{
									label: t("admin.reports.openaiCost7d"),
									value: `$${costs.summary.openaiCostUsd7d.toFixed(2)}`,
								},
								{
									label: t("admin.reports.railwayEgress24h"),
									value: `${costs.summary.railwayEgressGb24h.toFixed(2)} GB`,
								},
								{
									label: t("admin.reports.redisMemoryMb"),
									value: `${costs.summary.redisMemoryMb.toFixed(1)} MB`,
								},
							]}
						/>
						<AdminPanel
							title={t("admin.reports.providerHealth")}
							description={`${t("admin.reports.generatedAt")}: ${formatAdminDateTime(costs.generatedAt)}`}
						>
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="flex items-center justify-between rounded-lg border p-3">
									<span className="text-sm">Redis</span>
									<AdminStatusBadge status={costs.redis.status} />
								</div>
								<div className="flex items-center justify-between rounded-lg border p-3">
									<span className="text-sm">Railway</span>
									<AdminStatusBadge status={costs.railway.status} />
								</div>
								<div className="flex items-center justify-between rounded-lg border p-3">
									<span className="text-sm">OpenAI</span>
									<AdminStatusBadge status={costs.openai.status} />
								</div>
							</div>
						</AdminPanel>
						<AdminPanel
							title={t("admin.reports.dailyCosts")}
							description={t("admin.reports.dailyCostsHint")}
						>
							<AdminQueryState empty={dates.length === 0}>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t("admin.ops.date")}</TableHead>
											<TableHead>{t("admin.reports.railwayEgress")}</TableHead>
											<TableHead>{t("admin.reports.openaiCost")}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{dates.map((date) => {
											const egress = costs.railway.dailyEgressGb.find(
												(item) => item.date === date,
											)?.value;
											const ai = costs.openai.dailyCostUsd.find(
												(item) => item.date === date,
											)?.value;
											return (
												<TableRow key={date}>
													<TableCell className="font-medium">{date}</TableCell>
													<TableCell>
														{egress === undefined
															? "—"
															: `${egress.toFixed(3)} GB`}
													</TableCell>
													<TableCell>
														{ai === undefined ? "—" : `$${ai.toFixed(4)}`}
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</AdminQueryState>
							<p className="mt-4 text-xs text-muted-foreground">
								{t("admin.reports.tokenUsage24h", {
									count: formatAdminNumber(
										costs.summary.openaiInputTokens24h +
											costs.summary.openaiOutputTokens24h,
									),
								})}
							</p>
						</AdminPanel>
					</>
				)}
			</AdminQueryState>
		</div>
	);
}
