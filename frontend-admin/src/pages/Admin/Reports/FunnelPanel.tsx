import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { AdminPanel, AdminQueryState } from "@/components/common/AdminPage";
import { adminApi } from "@/services/api/admin";
import {
	formatAdminNumber,
	formatAdminPercent,
	humanizeAdminKey,
} from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

export default function FunnelPanel() {
	const query = useQuery({
		queryKey: ["admin", "reports", "funnel"],
		queryFn: adminApi.getReportFunnel,
	});
	const stages = query.data?.stages ?? [];
	return (
		<div className="space-y-4 pt-4">
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
			<AdminPanel
				title={t("admin.reports.funnel")}
				description={t("admin.reports.funnelHint")}
			>
				<AdminQueryState
					loading={query.isLoading}
					error={Boolean(query.error)}
					empty={stages.length === 0}
					onRetry={() => void query.refetch()}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("admin.reports.stage")}</TableHead>
								<TableHead>{t("admin.reports.stageCount")}</TableHead>
								<TableHead>{t("admin.reports.fromPrevious")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{stages.map((stage, index) => {
								const previous =
									index > 0 ? stages[index - 1].count : stage.count;
								const conversion = previous > 0 ? stage.count / previous : 0;
								return (
									<TableRow key={stage.key}>
										<TableCell className="font-medium">
											{humanizeAdminKey(stage.key)}
										</TableCell>
										<TableCell>{formatAdminNumber(stage.count)}</TableCell>
										<TableCell>
											{index === 0 ? "—" : formatAdminPercent(conversion)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</AdminQueryState>
			</AdminPanel>
		</div>
	);
}
