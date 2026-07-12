import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	AdminMetricStrip,
	AdminPageHeader,
	AdminPanel,
	AdminQueryState,
	AdminStatusBadge,
} from "@/components/common/AdminPage";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { adminApi } from "@/services/api/admin";
import type { AdminConfigItem } from "@/types/admin";
import { formatAdminDateTime, humanizeAdminKey } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";
import ConfigEditor, { type ConfigEditorPayload } from "./ConfigEditor";

function summarizeConfigValue(item: AdminConfigItem): string {
	if (item.is_sensitive) return t("admin.configs.maskedValue");
	if (typeof item.value === "boolean")
		return item.value ? t("admin.common.enabled") : t("admin.common.disabled");
	if (Array.isArray(item.value))
		return t("admin.configs.itemCount", { count: item.value.length });
	if (item.value && typeof item.value === "object")
		return t("admin.configs.fieldCount", {
			count: Object.keys(item.value).length,
		});
	return String(item.value ?? "—");
}

export default function AdminConfigsPage() {
	const queryClient = useQueryClient();
	const { hasPermission: canWriteConfigs } = useAdminAccess(
		["config:write"],
		true,
	);
	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState("");
	const [createMode, setCreateMode] = useState(false);
	const listQuery = useQuery({
		queryKey: ["admin", "configs"],
		queryFn: () => adminApi.listConfigs({ limit: 100, offset: 0 }),
	});
	const runtimeQuery = useQuery({
		queryKey: ["admin", "runtime", "interview"],
		queryFn: adminApi.getInterviewRuntimeConfig,
	});
	const upsertMutation = useMutation({
		mutationFn: (values: ConfigEditorPayload) => adminApi.upsertConfig(values),
		onSuccess: () => {
			toast.success(t("admin.configs.saveSuccess"));
			setCreateMode(false);
			setSelectedId("");
			void queryClient.invalidateQueries({ queryKey: ["admin", "configs"] });
			void queryClient.invalidateQueries({
				queryKey: ["admin", "runtime", "interview"],
			});
		},
		onError: (error: unknown) => {
			const err = error as { code?: string } | null;
			toast.error(
				err?.code === "FORBIDDEN"
					? t("admin.ops.accessDenied")
					: t("admin.configs.saveFailed"),
			);
		},
	});
	const items = listQuery.data?.items ?? [];
	const filteredItems = useMemo(() => {
		const normalized = search.trim().toLowerCase();
		if (!normalized) return items;
		return items.filter(
			(item) =>
				item.key.toLowerCase().includes(normalized) ||
				item.description?.toLowerCase().includes(normalized),
		);
	}, [items, search]);
	const selectedItem = items.find((item) => item.id === selectedId) ?? null;
	const runtime = runtimeQuery.data?.runtime;

	return (
		<div className="space-y-6">
			<AdminPageHeader
				eyebrow={t("admin.nav.group.govern")}
				title={t("admin.configs.heading")}
				description={t("admin.configs.subtitle")}
				updatedAt={listQuery.dataUpdatedAt || undefined}
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							disabled={listQuery.isFetching}
							onClick={() => void listQuery.refetch()}
						>
							<RefreshCw
								className={
									listQuery.isFetching ? "size-4 animate-spin" : "size-4"
								}
							/>
							{t("admin.common.refresh")}
						</Button>
						<Button
							size="sm"
							disabled={!canWriteConfigs}
							onClick={() => {
								setCreateMode(true);
								setSelectedId("");
							}}
						>
							<Plus className="size-4" />
							{t("admin.configs.newConfig")}
						</Button>
					</>
				}
			/>

			{!canWriteConfigs && (
				<div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
					<AlertTriangle className="mt-0.5 size-4 text-warning" />
					<div>
						<p className="text-sm font-medium">
							{t("admin.configs.readOnlyTitle")}
						</p>
						<p className="text-xs text-muted-foreground">
							{t("admin.configs.writeDenied")}
						</p>
					</div>
				</div>
			)}

			{runtime && (
				<AdminMetricStrip
					items={[
						{
							label: t("admin.configs.runtimeMaxTurns"),
							value: runtime.maxTurns,
						},
						{
							label: t("admin.configs.runtimeSoftTarget"),
							value: runtime.softTarget,
						},
						{
							label: t("admin.configs.runtimeInterval"),
							value: `${runtime.turnIntervalMs} ms`,
						},
						{
							label: t("admin.configs.runtimeDailyLimit"),
							value: runtime.dailySessionLimit,
						},
					]}
				/>
			)}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
				<AdminPanel
					title={t("admin.configs.catalogTitle")}
					description={t("admin.configs.catalogHint")}
					>
						<div className="relative mb-4">
							<label htmlFor="admin-config-search" className="sr-only">
								{t("admin.configs.search")}
							</label>
							<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="admin-config-search"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t("admin.configs.search")}
							className="pl-9"
							autoComplete="off"
						/>
					</div>
					<AdminQueryState
						loading={listQuery.isLoading}
						error={Boolean(listQuery.error)}
						empty={filteredItems.length === 0}
						onRetry={() => void listQuery.refetch()}
					>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("admin.configs.key")}</TableHead>
									<TableHead>{t("admin.configs.value")}</TableHead>
									<TableHead>{t("admin.configs.scope")}</TableHead>
									<TableHead>{t("admin.configs.updatedAt")}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredItems.map((item) => (
									<TableRow
										key={item.id}
										data-state={selectedId === item.id ? "selected" : undefined}
									>
										<TableCell>
											<button
												type="button"
												aria-pressed={selectedId === item.id}
												className="min-h-11 w-full rounded-md text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
												onClick={() => {
													setSelectedId(item.id);
													setCreateMode(false);
												}}
											>
												<span className="block font-medium">
													{humanizeAdminKey(item.key)}
												</span>
												<code className="block text-[11px] text-muted-foreground">
													{item.key}
												</code>
											</button>
										</TableCell>
										<TableCell className="max-w-72 truncate">
											{summarizeConfigValue(item)}
										</TableCell>
										<TableCell>
											<AdminStatusBadge
												status={item.is_runtime}
												label={
													item.is_runtime
														? t("admin.configs.runtime")
														: t("admin.configs.stored")
												}
											/>
										</TableCell>
										<TableCell>
											{formatAdminDateTime(item.updated_at)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</AdminQueryState>
				</AdminPanel>

				<AdminPanel
					title={
						createMode
							? t("admin.configs.newConfig")
							: selectedItem
								? humanizeAdminKey(selectedItem.key)
								: t("admin.configs.editorTitle")
					}
					description={
						createMode
							? t("admin.configs.createHint")
							: (selectedItem?.description ?? t("admin.configs.selectHint"))
					}
				>
					{createMode || selectedItem ? (
						<ConfigEditor
							item={selectedItem}
							createMode={createMode}
							canWrite={canWriteConfigs}
							saving={upsertMutation.isPending}
							onSave={(payload) => upsertMutation.mutate(payload)}
							onCancel={() => {
								setCreateMode(false);
								setSelectedId("");
							}}
						/>
					) : (
						<div className="flex min-h-72 items-center justify-center text-center text-sm text-muted-foreground">
							{t("admin.configs.selectHint")}
						</div>
					)}
				</AdminPanel>
			</div>
		</div>
	);
}
