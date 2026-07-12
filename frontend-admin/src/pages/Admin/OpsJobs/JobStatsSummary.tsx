import type { AdminJobStatsData } from "@/types/admin";
import { AdminMetricStrip } from "@/components/common/AdminPage";
import {
	formatAdminNumber,
	formatAdminPercent,
	formatDurationMs,
} from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

export default function JobStatsSummary({ data }: { data: AdminJobStatsData }) {
	const failureTone =
		data.totals.failedRuns > 0 ? ("danger" as const) : ("success" as const);
	return (
		<AdminMetricStrip
			items={[
				{
					label: t("admin.ops.totalRuns"),
					value: formatAdminNumber(data.totals.totalRuns),
					note: t("admin.ops.windowNote", { days: data.days }),
				},
				{
					label: t("admin.ops.failedRuns"),
					value: formatAdminNumber(data.totals.failedRuns),
					note: formatAdminPercent(data.totals.failureRate),
					tone: failureTone,
				},
				{
					label: t("admin.ops.successRate"),
					value: formatAdminPercent(data.totals.successRate),
					note: t(
						data.rateBase === "completed_runs"
							? "admin.ops.rateModeCompleted"
							: "admin.ops.rateModeTotal",
					),
					tone: "success",
				},
				{
					label: t("admin.ops.avgDurationMs"),
					value: formatDurationMs(data.totals.avgDurationMs),
					note: `${formatAdminNumber(data.totals.runningRuns)} ${t("admin.ops.runningRuns").toLowerCase()}`,
				},
			]}
		/>
	);
}
