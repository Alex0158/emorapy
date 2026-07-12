import { Eye, EyeOff } from "lucide-react";
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
	onClose: () => void;
	onRetry: () => void;
	onToggleSensitiveText: () => void;
}

export default function AIStreamDetailSheet({
	streamId,
	detail,
	loading,
	error,
	canReadSensitive,
	showSensitiveText,
	onClose,
	onRetry,
	onToggleSensitiveText,
}: AIStreamDetailSheetProps) {
	const canRevealSensitive =
		canReadSensitive && detail?.sensitiveContentIncluded === true;

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
										canRevealSensitive ? (
											<Button
												variant="outline"
												size="sm"
												onClick={onToggleSensitiveText}
											>
												{showSensitiveText ? (
													<EyeOff className="size-4" />
												) : (
													<Eye className="size-4" />
												)}
												{showSensitiveText
													? t("admin.reports.hideText")
													: t("admin.reports.revealText")}
											</Button>
										) : undefined
									}
								>
									{canRevealSensitive && showSensitiveText ? (
										<div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-6">
											{detail.session.text || t("common.noData")}
										</div>
									) : (
										<div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
											{canRevealSensitive
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
													<TableCell>{formatAdminDateTime(event.createdAt)}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
									{canRevealSensitive ? (
										<div className="mt-3">
											<AdminRawDetails
												value={detail.events}
												sensitive
												summary={t("admin.reports.aiStreamsRawEvents")}
											/>
										</div>
									) : (
										<p className="mt-3 text-xs text-muted-foreground">
											{t("admin.reports.aiStreamsSensitiveForbidden")}
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
