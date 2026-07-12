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
	AdminPanel,
	AdminQueryState,
	AdminStatusBadge,
} from "@/components/common/AdminPage";
import type { AdminAIStreamSessionItem } from "@/types/admin";
import {
	formatAdminDateTime,
	formatAdminNumber,
	humanizeAdminKey,
} from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

interface AIStreamSessionsPanelProps {
	sessions: AdminAIStreamSessionItem[];
	total: number;
	offset: number;
	pageSize: number;
	loading: boolean;
	error: boolean;
	onRetry: () => void;
	onSelect: (streamId: string) => void;
	onPrevious: () => void;
	onNext: () => void;
}

export default function AIStreamSessionsPanel({
	sessions,
	total,
	offset,
	pageSize,
	loading,
	error,
	onRetry,
	onSelect,
	onPrevious,
	onNext,
}: AIStreamSessionsPanelProps) {
	const currentPage = Math.floor(offset / pageSize) + 1;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	return (
		<AdminPanel
			title={t("admin.reports.aiStreamsSessionsTitle")}
			description={t("admin.reports.aiStreamsSessionsHint")}
		>
			<AdminQueryState
				loading={loading}
				error={error}
				empty={sessions.length === 0}
				onRetry={onRetry}
			>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("admin.reports.aiStreamsColStream")}</TableHead>
							<TableHead>{t("admin.reports.aiStreamsColScope")}</TableHead>
							<TableHead>{t("admin.reports.aiStreamsColStatus")}</TableHead>
							<TableHead>{t("admin.reports.aiStreamsColSource")}</TableHead>
							<TableHead>{t("admin.reports.aiStreamsColSeq")}</TableHead>
							<TableHead>
								{t("admin.reports.aiStreamsColUpdatedAt")}
							</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{sessions.map((record) => (
							<TableRow key={`${record.source}-${record.streamId}`}>
								<TableCell>
									<code className="text-xs">
										{record.streamId.slice(0, 12)}…
									</code>
								</TableCell>
								<TableCell>
									<p className="font-medium">
										{humanizeAdminKey(record.scopeType)}
									</p>
									<code className="text-[11px] text-muted-foreground">
										{record.scopeId.slice(0, 12)}…
									</code>
								</TableCell>
								<TableCell>
									<AdminStatusBadge
										status={record.status}
										label={humanizeAdminKey(record.status)}
									/>
								</TableCell>
								<TableCell>{humanizeAdminKey(record.source)}</TableCell>
								<TableCell>{record.lastSeq}</TableCell>
								<TableCell>{formatAdminDateTime(record.updatedAt)}</TableCell>
								<TableCell className="text-right">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => onSelect(record.streamId)}
									>
										{t("admin.audit.inspect")}
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				<div className="mt-4 flex items-center justify-between border-t pt-4">
					<p className="text-xs text-muted-foreground">
						{t("admin.reports.aiStreamsResultCount", {
							count: formatAdminNumber(total),
						})}{" "}
						·{" "}
						{t("admin.common.pageOf", {
							page: currentPage,
							total: totalPages,
						})}
					</p>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={offset === 0}
							onClick={onPrevious}
						>
							{t("admin.common.previous")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={offset + pageSize >= total}
							onClick={onNext}
						>
							{t("admin.common.next")}
						</Button>
					</div>
				</div>
			</AdminQueryState>
		</AdminPanel>
	);
}
