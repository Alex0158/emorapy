import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/utils/i18n";

export interface AuditFilters {
	entityType: string;
	action: string;
	from: string;
	to: string;
}

interface AuditLogFiltersProps {
	value: AuditFilters;
	onChange: (value: AuditFilters) => void;
	onSubmit: (event: React.FormEvent) => void;
	onClear: () => void;
}

export default function AuditLogFilters({
	value,
	onChange,
	onSubmit,
	onClear,
}: AuditLogFiltersProps) {
	return (
		<form
			onSubmit={onSubmit}
			className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_13rem_13rem_auto] xl:items-end"
		>
			<div className="space-y-2">
				<Label htmlFor="admin-audit-entity-type">
					{t("admin.audit.entityType")}
				</Label>
				<Input
					id="admin-audit-entity-type"
					value={value.entityType}
					onChange={(event) =>
						onChange({ ...value, entityType: event.target.value })
					}
					autoComplete="off"
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="admin-audit-action">{t("admin.audit.action")}</Label>
				<Input
					id="admin-audit-action"
					value={value.action}
					onChange={(event) =>
						onChange({ ...value, action: event.target.value })
					}
					autoComplete="off"
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="admin-audit-from">{t("admin.audit.from")}</Label>
					<Input
						id="admin-audit-from"
						type="datetime-local"
						autoComplete="off"
					value={value.from}
					onChange={(event) => onChange({ ...value, from: event.target.value })}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="admin-audit-to">{t("admin.audit.to")}</Label>
					<Input
						id="admin-audit-to"
						type="datetime-local"
						autoComplete="off"
					value={value.to}
					onChange={(event) => onChange({ ...value, to: event.target.value })}
				/>
			</div>
			<div className="flex gap-2">
				<Button type="submit">
					<Search className="size-4" />
					{t("admin.common.applyFilters")}
				</Button>
				<Button type="button" variant="outline" onClick={onClear}>
					{t("admin.common.clear")}
				</Button>
			</div>
		</form>
	);
}
