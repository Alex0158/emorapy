import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "@/services/api/admin";
import { t } from "@/utils/i18n";
import JsonConfigCard from "./JsonConfigCard";

export default function GovernanceSettingsPanel() {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: ["admin", "configs", "governance-settings"],
		queryFn: () => adminApi.listConfigs({ limit: 100, offset: 0 }),
	});
	const [alertRulesValue, setAlertRulesValue] = useState("[]");
	const [featureFlagsValue, setFeatureFlagsValue] = useState("{}");

	useEffect(() => {
		const items = query.data?.items ?? [];
		setAlertRulesValue(
			JSON.stringify(
				items.find((item) => item.key === "admin.alert.rules")?.value ?? [],
				null,
				2,
			),
		);
		setFeatureFlagsValue(
			JSON.stringify(
				items.find((item) => item.key === "feature.flags")?.value ?? {},
				null,
				2,
			),
		);
	}, [query.data]);

	const alertMutation = useMutation({
		mutationFn: (rules: unknown[]) => adminApi.upsertAlertRules(rules),
		onSuccess: () => {
			toast.success(t("admin.settings.alerts.saveSuccess"));
			void queryClient.invalidateQueries({ queryKey: ["admin", "configs"] });
		},
		onError: () => toast.error(t("admin.settings.alerts.saveFailed")),
	});
	const flagMutation = useMutation({
		mutationFn: (flags: Record<string, unknown>) =>
			adminApi.setFeatureFlags(flags),
		onSuccess: () => {
			toast.success(t("admin.settings.flags.saveSuccess"));
			void queryClient.invalidateQueries({ queryKey: ["admin", "configs"] });
		},
		onError: () => toast.error(t("admin.settings.flags.saveFailed")),
	});

	return (
		<div className="grid gap-6 xl:grid-cols-2">
			<JsonConfigCard
				title={t("admin.settings.alerts.title")}
				subtitle={t("admin.settings.alerts.panelHint")}
				fieldName="alert-rules"
				requiredMessage={t("admin.settings.alerts.rulesJsonArrayRequired")}
				placeholder='[{"key":"jobs.failure_rate","threshold":0.2}]'
				loading={alertMutation.isPending}
				valueKind="array"
				saveLabel={t("admin.settings.alerts.save")}
				onSave={(value) => alertMutation.mutate(value as unknown[])}
				initialValue={alertRulesValue}
			/>
			<JsonConfigCard
				title={t("admin.settings.flags.title")}
				subtitle={t("admin.settings.flags.panelHint")}
				fieldName="feature-flags"
				requiredMessage={t("admin.settings.flags.flagsJsonObjectRequired")}
				placeholder='{"adminOpsBeta": true}'
				loading={flagMutation.isPending}
				valueKind="object"
				saveLabel={t("admin.settings.flags.save")}
				onSave={(value) =>
					flagMutation.mutate(value as Record<string, unknown>)
				}
				initialValue={featureFlagsValue}
			/>
		</div>
	);
}
