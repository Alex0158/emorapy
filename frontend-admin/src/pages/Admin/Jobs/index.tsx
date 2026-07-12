import { type MouseEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
	AdminPageHeader,
	AdminPanel,
	AdminQueryState,
	AdminStatusBadge,
} from "@/components/common/AdminPage";
import type { AdminJobListItem } from "@/types/admin";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { adminApi } from "@/services/api/admin";
import {
	formatAdminDateTime,
	formatDurationMs,
	humanizeAdminKey,
} from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

export default function AdminJobsPage() {
	const queryClient = useQueryClient();
	const { hasPermission: canExecuteJobs } = useAdminAccess(
		["ops:execute"],
		true,
	);
	const [selectedJob, setSelectedJob] = useState<AdminJobListItem | null>(null);
	const jobsQuery = useQuery({
		queryKey: ["admin", "jobs", "list"],
		queryFn: adminApi.listJobs,
	});
	const triggerMutation = useMutation({
		mutationFn: (job: AdminJobListItem) => adminApi.triggerJob(job.key),
		onSuccess: () => {
			toast.success(t("admin.jobs.triggerSuccess"));
			setSelectedJob(null);
			void queryClient.invalidateQueries({ queryKey: ["admin", "jobs"] });
		},
		onError: (error: unknown) => {
			const err = error as { code?: string } | null;
			toast.error(
				err?.code === "FORBIDDEN"
					? t("admin.ops.accessDenied")
					: t("admin.jobs.triggerFailed"),
			);
		},
	});
	const jobs = jobsQuery.data?.jobs ?? [];

	return (
		<div className="space-y-6">
			<AdminPageHeader
				eyebrow={t("admin.nav.group.operate")}
				title={t("admin.jobs.heading")}
				description={t("admin.jobs.subtitle")}
				updatedAt={jobsQuery.dataUpdatedAt || undefined}
				actions={
					<Button
						variant="outline"
						size="sm"
						disabled={jobsQuery.isFetching}
						onClick={() => void jobsQuery.refetch()}
					>
						<RefreshCw
							className={
								jobsQuery.isFetching ? "size-4 animate-spin" : "size-4"
							}
						/>
						{t("admin.common.refresh")}
					</Button>
				}
			/>

			{!canExecuteJobs && (
				<div
					className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4"
					role="note"
				>
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
					<div>
						<p className="text-sm font-medium">
							{t("admin.jobs.readOnlyTitle")}
						</p>
						<p className="mt-0.5 text-xs text-muted-foreground">
							{t("admin.jobs.executeDenied")}
						</p>
					</div>
				</div>
			)}

			<AdminPanel
				title={t("admin.jobs.catalogTitle")}
				description={t("admin.jobs.catalogHint")}
			>
				<AdminQueryState
					loading={jobsQuery.isLoading}
					error={Boolean(jobsQuery.error)}
					empty={jobs.length === 0}
					onRetry={() => void jobsQuery.refetch()}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("admin.jobs.key")}</TableHead>
								<TableHead>{t("admin.jobs.schedule")}</TableHead>
								<TableHead>{t("admin.jobs.latestStatus")}</TableHead>
								<TableHead>{t("admin.jobs.latestAt")}</TableHead>
								<TableHead>{t("admin.jobs.duration")}</TableHead>
								<TableHead>{t("admin.jobs.affected")}</TableHead>
								<TableHead className="text-right">
									{t("admin.jobs.actions")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{jobs.map((job) => (
								<TableRow key={job.key}>
									<TableCell>
										<p className="font-medium text-foreground">
											{humanizeAdminKey(job.key)}
										</p>
										<code className="text-[11px] text-muted-foreground">
											{job.key}
										</code>
									</TableCell>
									<TableCell>
										<code className="text-xs">{job.schedule}</code>
									</TableCell>
									<TableCell>
										<AdminStatusBadge
											status={job.latestRun?.status ?? "unknown"}
											label={
												job.latestRun
													? humanizeAdminKey(job.latestRun.status)
													: t("admin.jobs.neverRun")
											}
										/>
									</TableCell>
									<TableCell>
										{formatAdminDateTime(job.latestRun?.started_at)}
									</TableCell>
									<TableCell>
										{formatDurationMs(job.latestRun?.duration_ms)}
									</TableCell>
									<TableCell>{job.latestRun?.affected_count ?? "—"}</TableCell>
									<TableCell className="text-right">
										<Button
											variant="outline"
											size="sm"
											disabled={!canExecuteJobs || triggerMutation.isPending}
											onClick={() => setSelectedJob(job)}
										>
											<Play className="size-3.5" /> {t("admin.jobs.trigger")}
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</AdminQueryState>
			</AdminPanel>

			<AlertDialog
				open={Boolean(selectedJob)}
				onOpenChange={(open: boolean) => {
					if (!open && !triggerMutation.isPending) setSelectedJob(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("admin.jobs.confirmTriggerTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("admin.jobs.confirmTriggerHint")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{selectedJob && (
						<dl className="divide-y rounded-lg border px-4">
							<div className="flex justify-between gap-4 py-3 text-sm">
								<dt className="text-muted-foreground">{t("admin.jobs.key")}</dt>
								<dd className="font-medium">
									{humanizeAdminKey(selectedJob.key)}
								</dd>
							</div>
							<div className="flex justify-between gap-4 py-3 text-sm">
								<dt className="text-muted-foreground">
									{t("admin.jobs.latestStatus")}
								</dt>
								<dd>
									{selectedJob.latestRun?.status
										? humanizeAdminKey(selectedJob.latestRun.status)
										: t("admin.jobs.neverRun")}
								</dd>
							</div>
							<div className="flex justify-between gap-4 py-3 text-sm">
								<dt className="text-muted-foreground">
									{t("admin.jobs.latestAt")}
								</dt>
								<dd>
									{formatAdminDateTime(selectedJob.latestRun?.started_at)}
								</dd>
							</div>
						</dl>
					)}
					<p className="text-xs text-muted-foreground">
						{t("admin.jobs.auditHint")}
					</p>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={triggerMutation.isPending}>
							{t("common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={!selectedJob || triggerMutation.isPending}
							onClick={(event: MouseEvent<HTMLButtonElement>) => {
								event.preventDefault();
								if (selectedJob) triggerMutation.mutate(selectedJob);
							}}
						>
							{triggerMutation.isPending && (
								<Loader2 className="size-4 animate-spin" />
							)}
							{t("admin.jobs.confirmTrigger")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
