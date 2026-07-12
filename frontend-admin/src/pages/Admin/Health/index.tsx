import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	AdminMetricStrip,
	AdminPageHeader,
	AdminPanel,
	AdminQueryState,
	AdminRawDetails,
	AdminStatusBadge,
} from "@/components/common/AdminPage";
import { adminApi } from "@/services/api/admin";
import { formatAdminDateTime, humanizeAdminKey } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

export default function AdminHealthPage() {
	const healthQuery = useQuery({
		queryKey: ["admin", "health", "detailed"],
		queryFn: adminApi.getHealthDetailed,
		refetchInterval: 30_000,
	});
	const health = healthQuery.data;
	const performanceEntries = Object.entries(health?.performance ?? {});

	return (
		<div className="space-y-6">
			<AdminPageHeader
				eyebrow={t("admin.nav.group.monitor")}
				title={t("admin.health.heading")}
				description={t("admin.health.subtitle")}
				updatedAt={healthQuery.dataUpdatedAt || undefined}
				actions={
					<Button
						variant="outline"
						size="sm"
						disabled={healthQuery.isFetching}
						onClick={() => void healthQuery.refetch()}
					>
						<RefreshCw
							className={
								healthQuery.isFetching ? "size-4 animate-spin" : "size-4"
							}
						/>
						{t("admin.common.refresh")}
					</Button>
				}
			/>

			<AdminQueryState
				loading={healthQuery.isLoading}
				error={Boolean(healthQuery.error)}
				onRetry={() => void healthQuery.refetch()}
			>
				{health && (
					<>
						<AdminPanel className="border-l-4 border-l-success">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
										{t("admin.health.currentState")}
									</p>
									<div className="mt-2 flex items-center gap-3">
										<AdminStatusBadge
											status={health.status}
											label={humanizeAdminKey(health.status)}
										/>
										<p className="text-sm text-muted-foreground">
											{t("admin.health.autoRefreshHint")}
										</p>
									</div>
								</div>
								<p className="text-sm text-muted-foreground">
									{t("admin.health.observedAt")}:{" "}
									{formatAdminDateTime(health.timestamp)}
								</p>
							</div>
						</AdminPanel>

						<AdminMetricStrip
							items={[
								{
									label: t("admin.health.cronStarted"),
									value: health.cronStarted
										? t("admin.common.enabled")
										: t("admin.common.disabled"),
									tone: health.cronStarted ? "success" : "warning",
								},
								{
									label: t("admin.health.activeJobCount"),
									value: health.activeJobCount,
								},
								{ label: t("admin.health.userCount"), value: health.userCount },
								{
									label: t("admin.health.adminCount"),
									value: health.adminCount,
								},
							]}
						/>

						<div className="grid gap-6 xl:grid-cols-2">
							<AdminPanel
								title={t("admin.health.runtimeContext")}
								description={t("admin.health.runtimeContextHint")}
							>
								<dl className="divide-y">
									<div className="flex items-center justify-between gap-4 py-3 first:pt-0">
										<dt className="text-sm text-muted-foreground">
											{t("admin.health.environment")}
										</dt>
										<dd className="text-sm font-medium">
											{health.env.nodeEnv}
										</dd>
									</div>
									<div className="flex items-center justify-between gap-4 py-3 last:pb-0">
										<dt className="text-sm text-muted-foreground">
											{t("admin.health.scheduledJobsEnabled")}
										</dt>
										<dd>
											<AdminStatusBadge
												status={health.env.scheduledJobsEnabled}
												label={
													health.env.scheduledJobsEnabled
														? t("admin.common.enabled")
														: t("admin.common.disabled")
												}
											/>
										</dd>
									</div>
								</dl>
							</AdminPanel>

							<AdminPanel
								title={t("admin.health.performance")}
								description={t("admin.health.performanceHint")}
							>
								{performanceEntries.length > 0 ? (
									<dl className="divide-y">
										{performanceEntries.slice(0, 6).map(([key, value]) => (
											<div
												key={key}
												className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
											>
												<dt className="text-sm text-muted-foreground">
													{humanizeAdminKey(key)}
												</dt>
												<dd className="max-w-[60%] text-right text-sm font-medium break-all">
													{typeof value === "object"
														? JSON.stringify(value)
														: String(value)}
												</dd>
											</div>
										))}
									</dl>
								) : (
									<p className="text-sm text-muted-foreground">
										{t("common.noData")}
									</p>
								)}
								<div className="mt-3">
									<AdminRawDetails
										summary={t("admin.common.advancedDetails")}
										value={health.performance}
									/>
								</div>
							</AdminPanel>
						</div>
					</>
				)}
			</AdminQueryState>
		</div>
	);
}
