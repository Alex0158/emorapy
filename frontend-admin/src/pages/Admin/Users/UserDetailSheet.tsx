import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	AdminQueryState,
	AdminRawDetails,
} from "@/components/common/AdminPage";
import { formatAdminDateTime } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

interface UserDetailSheetProps {
	open: boolean;
	detail: unknown;
	loading: boolean;
	error: boolean;
	onClose: () => void;
	onRetry: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function detailArrayLength(
	detail: Record<string, unknown>,
	key: string,
): number {
	const value = detail[key];
	return Array.isArray(value) ? value.length : 0;
}

export default function UserDetailSheet({
	open,
	detail,
	loading,
	error,
	onClose,
	onRetry,
}: UserDetailSheetProps) {
	const userDetail = isRecord(detail) ? detail : null;

	return (
		<Sheet
			open={open}
			onOpenChange={(nextOpen: boolean) => {
				if (!nextOpen) onClose();
			}}
		>
			<SheetContent
				side="right"
				className="w-full overflow-y-auto p-0 sm:max-w-xl"
			>
				<SheetHeader className="border-b p-5 text-left">
					<SheetTitle>{t("admin.users.detail")}</SheetTitle>
					<SheetDescription>{t("admin.users.detailHint")}</SheetDescription>
				</SheetHeader>
				<div className="p-5">
					<AdminQueryState
						loading={loading}
						error={error}
						empty={!userDetail}
						onRetry={onRetry}
					>
						{userDetail && (
							<div className="space-y-6">
								<dl className="divide-y rounded-xl border px-4">
									{[
										[t("admin.users.email"), userDetail.email],
										[t("admin.users.nickname"), userDetail.nickname],
										[
											t("admin.users.active"),
											userDetail.is_active
												? t("admin.users.activeYes")
												: t("admin.users.activeNo"),
										],
										[
											t("admin.users.lastLogin"),
											formatAdminDateTime(
												userDetail.last_login_at as string | null,
											),
										],
										["ID", userDetail.id],
									].map(([label, value]) => (
										<div
											key={String(label)}
											className="flex items-start justify-between gap-4 py-3 text-sm"
										>
											<dt className="text-muted-foreground">{String(label)}</dt>
											<dd className="max-w-[65%] text-right break-all">
												{String(value ?? "—")}
											</dd>
										</div>
									))}
								</dl>
								<div className="grid grid-cols-2 gap-3">
									<div className="rounded-xl border p-4">
										<p className="text-xs text-muted-foreground">
											{t("admin.users.pairings")}
										</p>
										<p className="mt-1 text-2xl font-semibold">
											{detailArrayLength(userDetail, "pairings_as_user1") +
												detailArrayLength(userDetail, "pairings_as_user2")}
										</p>
									</div>
									<div className="rounded-xl border p-4">
										<p className="text-xs text-muted-foreground">
											{t("admin.users.cases")}
										</p>
										<p className="mt-1 text-2xl font-semibold">
											{detailArrayLength(userDetail, "cases_as_plaintiff") +
												detailArrayLength(userDetail, "cases_as_defendant")}
										</p>
									</div>
								</div>
								<AdminRawDetails
									value={userDetail}
									sensitive
									summary={t("admin.users.advancedRecord")}
								/>
							</div>
						)}
					</AdminQueryState>
				</div>
			</SheetContent>
		</Sheet>
	);
}
