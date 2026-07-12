import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	AdminMetricStrip,
	AdminPanel,
	AdminQueryState,
} from "@/components/common/AdminPage";
import { adminApi } from "@/services/api/admin";
import {
	formatAdminNumber,
	formatAdminPercent,
	humanizeAdminKey,
} from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

const AVAILABLE_METRICS = ["dau", "mau", "judgment_failed"] as const;

export default function OverviewPanel() {
	const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
		...AVAILABLE_METRICS,
	]);
	const [exporting, setExporting] = useState(false);
	const overviewQuery = useQuery({
		queryKey: ["admin", "reports", "overview"],
		queryFn: adminApi.getReportOverview,
	});
	const customMutation = useMutation({
		mutationFn: (metrics: string[]) => adminApi.getCustomReport(metrics),
	});
	const overview = overviewQuery.data;

	const exportOverview = async () => {
		setExporting(true);
		try {
			const blob = await adminApi.downloadReportOverviewCsv();
			const url = window.URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `admin-overview-${dayjs().format("YYYYMMDD-HHmmss")}.csv`;
			anchor.click();
			window.URL.revokeObjectURL(url);
		} catch {
			toast.error(t("admin.reports.loadFailed"));
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="space-y-6 pt-4">
			<div className="flex justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={overviewQuery.isFetching}
					onClick={() => void overviewQuery.refetch()}
				>
					<RefreshCw
						className={
							overviewQuery.isFetching ? "size-4 animate-spin" : "size-4"
						}
					/>
					{t("admin.common.refresh")}
				</Button>
				<Button size="sm" disabled={exporting} onClick={exportOverview}>
					{exporting ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Download className="size-4" />
					)}
					{t("admin.reports.exportCsv")}
				</Button>
			</div>
			<AdminQueryState
				loading={overviewQuery.isLoading}
				error={Boolean(overviewQuery.error)}
				onRetry={() => void overviewQuery.refetch()}
			>
				{overview && (
					<>
						<AdminMetricStrip
							items={[
								{
									label: t("admin.reports.users"),
									value: formatAdminNumber(overview.totals.users),
								},
								{
									label: t("admin.reports.activePairings"),
									value: formatAdminNumber(overview.totals.activePairings),
								},
								{
									label: t("admin.reports.cases"),
									value: formatAdminNumber(overview.totals.cases),
								},
								{
									label: t("admin.reports.judgments"),
									value: formatAdminNumber(overview.totals.judgments),
								},
							]}
						/>
						<AdminPanel
							title={t("admin.reports.conversionTitle")}
							description={t("admin.reports.conversionHint")}
						>
							<dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-4">
								{[
									[
										t("admin.reports.pairingRate"),
										overview.conversion.pairingRate,
									],
									[
										t("admin.reports.caseCreationRate"),
										overview.conversion.caseCreationRate,
									],
									[
										t("admin.reports.judgmentCompletionRate"),
										overview.conversion.judgmentCompletionRate,
									],
									[
										t("admin.reports.caseCompletionRate"),
										overview.conversion.caseCompletionRate,
									],
								].map(([label, value]) => (
									<div key={String(label)} className="bg-surface p-4">
										<dt className="text-xs text-muted-foreground">
											{String(label)}
										</dt>
										<dd className="mt-1 text-xl font-semibold">
											{formatAdminPercent(Number(value))}
										</dd>
									</div>
								))}
							</dl>
						</AdminPanel>
					</>
				)}
			</AdminQueryState>

			<AdminPanel
				title={t("admin.reports.custom")}
				description={t("admin.reports.customHint")}
			>
				<div className="flex flex-wrap gap-2">
					{AVAILABLE_METRICS.map((metric) => {
						const selected = selectedMetrics.includes(metric);
						return (
							<Button
								key={metric}
								type="button"
								variant={selected ? "default" : "outline"}
								size="sm"
								aria-pressed={selected}
								onClick={() =>
									setSelectedMetrics((current) =>
										selected
											? current.filter((item) => item !== metric)
											: [...current, metric],
									)
								}
							>
								{humanizeAdminKey(metric)}
							</Button>
						);
					})}
					<Button
						variant="outline"
						size="sm"
						disabled={selectedMetrics.length === 0 || customMutation.isPending}
						onClick={() => customMutation.mutate(selectedMetrics)}
					>
						{customMutation.isPending && (
							<Loader2 className="size-4 animate-spin" />
						)}
						{t("admin.reports.runCustom")}
					</Button>
				</div>
				{customMutation.error && (
					<p className="mt-3 text-sm text-destructive" role="alert">
						{t("admin.reports.customFailed")}
					</p>
				)}
				{customMutation.data && (
					<dl className="mt-5 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
						{Object.entries(customMutation.data.metrics).map(([key, value]) => (
							<div key={key} className="bg-surface p-4">
								<dt className="text-xs text-muted-foreground">
									{humanizeAdminKey(key)}
								</dt>
								<dd className="mt-1 text-xl font-semibold">
									{formatAdminNumber(value)}
								</dd>
							</div>
						))}
					</dl>
				)}
			</AdminPanel>
		</div>
	);
}
