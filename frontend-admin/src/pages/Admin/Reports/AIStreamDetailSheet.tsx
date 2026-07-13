import { AlertCircle, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	AdminPanel,
	AdminQueryState,
	AdminRawDetails,
	AdminStatusBadge,
} from "@/components/common/AdminPage";
import type { AdminAIStreamDetailData } from "@/types/admin";
import { formatAdminDateTime, humanizeAdminKey } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

interface AIStreamDetailSheetProps {
	streamId: string;
	detail: AdminAIStreamDetailData | undefined;
	loading: boolean;
	error: boolean;
	canReadSensitive: boolean;
	showSensitiveText: boolean;
	sensitiveLoading: boolean;
	sensitiveError: boolean;
	onClose: () => void;
	onRetry: () => void;
	onRevealSensitive: () => void;
	onHideSensitive: () => void;
	onRetrySensitive: () => void;
}

export default function AIStreamDetailSheet({
	streamId,
	detail,
	loading,
	error,
	canReadSensitive,
	showSensitiveText,
	sensitiveLoading,
	sensitiveError,
	onClose,
	onRetry,
	onRevealSensitive,
	onHideSensitive,
	onRetrySensitive,
}: AIStreamDetailSheetProps) {
	const sensitiveContentVisible = Boolean(
		showSensitiveText &&
			canReadSensitive &&
			detail?.sensitiveContentIncluded === true,
	);
	const canRequestSensitive = Boolean(canReadSensitive && detail);

	return (
		<Sheet
			open={Boolean(streamId)}
			onOpenChange={(open: boolean) => {
				if (!open) onClose();
			}}
		>
			<SheetContent
				side="right"
				className="w-full overflow-y-auto p-0 sm:max-w-2xl"
			>
				<SheetHeader className="border-b p-5 text-left">
					<SheetTitle>{t("admin.reports.aiStreamsDetail")}</SheetTitle>
					<SheetDescription>{streamId}</SheetDescription>
				</SheetHeader>
				<div className="p-5">
					<AdminQueryState
						loading={loading}
						error={error}
						empty={!detail}
						onRetry={onRetry}
					>
						{detail && (
							<div className="space-y-6">
								<dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
									<div className="bg-surface p-3">
										<dt className="text-xs text-muted-foreground">
											{t("admin.reports.aiStreamsColStatus")}
										</dt>
										<dd className="mt-1">
											<AdminStatusBadge
												status={detail.session.status}
												label={humanizeAdminKey(detail.session.status)}
											/>
										</dd>
									</div>
									<div className="bg-surface p-3">
										<dt className="text-xs text-muted-foreground">
											{t("admin.reports.aiStreamsColSource")}
										</dt>
										<dd className="mt-1 text-sm font-medium">
											{humanizeAdminKey(detail.source)}
										</dd>
									</div>
									<div className="bg-surface p-3">
										<dt className="text-xs text-muted-foreground">
											{t("admin.reports.aiStreamsColScope")}
										</dt>
										<dd className="mt-1 text-sm font-medium break-all">
											{detail.session.scopeType}:{detail.session.scopeId}
										</dd>
									</div>
									<div className="bg-surface p-3">
										<dt className="text-xs text-muted-foreground">
											{t("admin.reports.aiStreamsUpdatedAt")}
										</dt>
										<dd className="mt-1 text-sm font-medium">
											{formatAdminDateTime(detail.session.updatedAt)}
										</dd>
									</div>
								</dl>
								<AdminPanel
									title={t("admin.reports.aiStreamsTextSnapshot")}
									description={t("admin.reports.aiStreamsSensitiveHint")}
									actions={
										canRequestSensitive ? (
											<Button
												variant="outline"
												size="sm"
												onClick={
													sensitiveContentVisible
														? onHideSensitive
														: onRevealSensitive
												}
												disabled={sensitiveLoading}
												aria-busy={sensitiveLoading}
											>
												{sensitiveLoading ? (
													<Loader2
														className="size-4 animate-spin"
														aria-hidden="true"
													/>
												) : sensitiveContentVisible ? (
													<EyeOff className="size-4" />
												) : (
													<Eye className="size-4" />
												)}
												{sensitiveLoading
													? t("common.loading")
													: sensitiveContentVisible
														? t("admin.reports.hideText")
														: t("admin.reports.revealText")}
											</Button>
										) : undefined
									}
								>
									{sensitiveError && canRequestSensitive ? (
										<div
											className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center"
											role="alert"
										>
											<AlertCircle
												className="size-5 text-destructive"
												aria-hidden="true"
											/>
											<p className="text-sm text-muted-foreground">
												{t("admin.common.loadFailed")}
											</p>
											<Button
												variant="outline"
												size="sm"
												onClick={onRetrySensitive}
											>
												<RefreshCw className="size-3.5" aria-hidden="true" />
												{t("common.retry")}
											</Button>
										</div>
									) : sensitiveLoading ? (
										<div
											className="flex min-h-28 items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground"
											role="status"
											aria-live="polite"
										>
											<Loader2
												className="size-4 animate-spin"
												aria-hidden="true"
											/>
											{t("common.loading")}
										</div>
									) : sensitiveContentVisible ? (
										<div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-6">
											{detail.session.text || t("common.noData")}
										</div>
									) : (
										<div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
											{canRequestSensitive
												? t("admin.reports.aiStreamsTextHidden")
												: t("admin.reports.aiStreamsSensitiveForbidden")}
										</div>
									)}
								</AdminPanel>
								<AdminPanel
									title={t("admin.reports.aiStreamsEvents")}
									description={t("admin.reports.aiStreamsEventsHint")}
								>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Seq</TableHead>
												<TableHead>{t("admin.reports.eventType")}</TableHead>
												<TableHead>{t("admin.reports.phase")}</TableHead>
												<TableHead>{t("admin.audit.createdAt")}</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{detail.events.slice(0, 20).map((event) => (
												<TableRow key={`${event.streamId}-${event.seq}`}>
													<TableCell>{event.seq}</TableCell>
													<TableCell>
														{humanizeAdminKey(event.eventType)}
													</TableCell>
													<TableCell>{humanizeAdminKey(event.phase)}</TableCell>
													<TableCell>
														{formatAdminDateTime(event.createdAt)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
									{sensitiveContentVisible ? (
										<div className="mt-3">
											<AdminRawDetails
												value={detail.events}
												sensitive
												summary={t("admin.reports.aiStreamsRawEvents")}
											/>
										</div>
									) : (
										<p className="mt-3 text-xs text-muted-foreground">
											{canRequestSensitive
												? t("admin.reports.aiStreamsTextHidden")
												: t("admin.reports.aiStreamsSensitiveForbidden")}
										</p>
									)}
								</AdminPanel>
							</div>
						)}
					</AdminQueryState>
				</div>
			</SheetContent>
		</Sheet>
	);
}
