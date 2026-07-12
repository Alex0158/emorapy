import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { AdminStatusBadge } from "@/components/common/AdminPage";
import type { AdminJobStatsDailyBucket } from "@/types/admin";
import { formatAdminNumber, formatAdminPercent } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

export default function JobStatsDailyTable({
	rows,
}: {
	rows: AdminJobStatsDailyBucket[];
}) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t("admin.ops.date")}</TableHead>
					<TableHead>{t("admin.ops.totalRuns")}</TableHead>
					<TableHead>{t("admin.ops.successRuns")}</TableHead>
					<TableHead>{t("admin.ops.failedRuns")}</TableHead>
					<TableHead>{t("admin.ops.failureRate")}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{[...rows]
					.reverse()
					.slice(0, 14)
					.map((row) => (
						<TableRow key={row.date}>
							<TableCell className="font-medium">{row.date}</TableCell>
							<TableCell>{formatAdminNumber(row.totalRuns)}</TableCell>
							<TableCell>{formatAdminNumber(row.successRuns)}</TableCell>
							<TableCell>
								<AdminStatusBadge
									status={row.failedRuns > 0 ? "failed" : "success"}
									label={formatAdminNumber(row.failedRuns)}
								/>
							</TableCell>
							<TableCell>{formatAdminPercent(row.failureRate)}</TableCell>
						</TableRow>
					))}
			</TableBody>
		</Table>
	);
}
