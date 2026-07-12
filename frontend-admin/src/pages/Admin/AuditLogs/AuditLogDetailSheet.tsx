import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { AdminRawDetails } from "@/components/common/AdminPage";
import type { AdminAuditLogItem } from "@/types/admin";
import { formatAdminDateTime, humanizeAdminKey } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

interface AuditLogDetailSheetProps {
	log: AdminAuditLogItem | null;
	onClose: () => void;
}

export default function AuditLogDetailSheet({
	log,
	onClose,
}: AuditLogDetailSheetProps) {
	return (
		<Sheet
			open={Boolean(log)}
			onOpenChange={(open: boolean) => {
				if (!open) onClose();
			}}
		>
			<SheetContent
				side="right"
				className="w-full overflow-y-auto p-0 sm:max-w-xl"
			>
				<SheetHeader className="border-b p-5 text-left">
					<SheetTitle>{t("admin.audit.eventTitle")}</SheetTitle>
					<SheetDescription>
						{log
							? `${humanizeAdminKey(log.action)} · ${formatAdminDateTime(log.created_at)}`
							: ""}
					</SheetDescription>
				</SheetHeader>
				{log && (
					<div className="space-y-5 p-5">
						<dl className="divide-y rounded-xl border px-4 text-sm">
							<div className="flex justify-between gap-4 py-3">
								<dt className="text-muted-foreground">
									{t("admin.audit.actor")}
								</dt>
								<dd className="max-w-[65%] text-right break-all">
									{log.actor_id ?? "—"}
								</dd>
							</div>
							<div className="flex justify-between gap-4 py-3">
								<dt className="text-muted-foreground">
									{t("admin.audit.entityType")}
								</dt>
								<dd>{humanizeAdminKey(log.entity_type)}</dd>
							</div>
							<div className="flex justify-between gap-4 py-3">
								<dt className="text-muted-foreground">
									{t("admin.audit.action")}
								</dt>
								<dd>{humanizeAdminKey(log.action)}</dd>
							</div>
							<div className="flex justify-between gap-4 py-3">
								<dt className="text-muted-foreground">Entity ID</dt>
								<dd className="max-w-[65%] text-right break-all">
									{log.entity_id ?? "—"}
								</dd>
							</div>
						</dl>
						<AdminRawDetails
							value={log.detail}
							sensitive
							summary={t("admin.audit.rawDetail")}
						/>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
