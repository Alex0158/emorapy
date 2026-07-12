import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { t } from "@/utils/i18n";

export type AdminRoleKey = "super_admin" | "ops" | "marketing" | "support";

export interface AdminUserDraft {
	email: string;
	name: string;
	password: string;
	roleKey: AdminRoleKey;
	isActive: boolean;
}

export const EMPTY_ADMIN_USER_DRAFT: AdminUserDraft = {
	email: "",
	name: "",
	password: "",
	roleKey: "ops",
	isActive: true,
};

const ADMIN_ROLE_KEYS: AdminRoleKey[] = [
	"super_admin",
	"ops",
	"marketing",
	"support",
];

export function AdminUserRoleSelect({
	value,
	onChange,
}: {
	value: AdminRoleKey;
	onChange: (value: AdminRoleKey) => void;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor="admin-role-select">
				{t("admin.settings.adminUsers.role")}
			</Label>
			<Select
				value={value}
				onValueChange={(role: string) => onChange(role as AdminRoleKey)}
			>
				<SelectTrigger id="admin-role-select">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{ADMIN_ROLE_KEYS.map((role) => (
						<SelectItem key={role} value={role}>
							{t(`admin.roles.${role}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<p className="text-xs text-muted-foreground">
				{t(`admin.roles.${value}.hint`)}
			</p>
		</div>
	);
}
