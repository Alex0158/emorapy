import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, KeyRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SEO from "@/components/common/SEO";
import { AdminPageHeader } from "@/components/common/AdminPage";
import { adminApi } from "@/services/api/admin";
import type {
	AdminMediaProviderCatalogItem,
	AdminMediaProviderTestInput,
	AdminMediaProviderTestResult,
} from "@/types/admin";
import { t } from "@/utils/i18n";
import AdminUsersSettingsPanel from "./AdminUsersSettingsPanel";
import GovernanceSettingsPanel from "./GovernanceSettingsPanel";
import MediaProviderSettingsCard from "./MediaProviderSettingsCard";
import { buildMediaProviderSaveValue } from "./mediaProviderConfig";
import type { MediaProviderFormValues } from "./types";

type SettingsTab = "providers" | "admins" | "governance";

function isConfigObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export default function AdminSettingsPage() {
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
	const [selectedProviderKey, setSelectedProviderKey] = useState("");
	const [formValues, setFormValues] = useState<MediaProviderFormValues>({});
	const [testResult, setTestResult] =
		useState<AdminMediaProviderTestResult | null>(null);
	const configsQuery = useQuery({
		queryKey: ["admin", "configs", "provider-settings"],
		queryFn: () => adminApi.listConfigs({ limit: 100, offset: 0 }),
		enabled: activeTab === "providers",
	});
	const providersQuery = useQuery({
		queryKey: ["admin", "media-providers"],
		queryFn: () => adminApi.listMediaProviders(),
		enabled: activeTab === "providers",
	});
	const catalog: AdminMediaProviderCatalogItem[] =
		providersQuery.data?.items ?? [];
	const selectedProvider = useMemo(
		() =>
			catalog.find((provider) => provider.providerKey === selectedProviderKey),
		[catalog, selectedProviderKey],
	);
	const providerConfigItem = configsQuery.data?.items.find(
		(item) => item.key === `media.provider.${selectedProviderKey}`,
	);
	const configured = providerConfigItem?.secret_configured
		?? Boolean(providerConfigItem && !isConfigObject(providerConfigItem.value));
	const configurationMasked = configured;
	const currentConfig = isConfigObject(providerConfigItem?.value)
		? providerConfigItem.value
		: {};

	useEffect(() => {
		if (!selectedProviderKey && catalog.length > 0)
			setSelectedProviderKey(catalog[0].providerKey);
		else if (
			selectedProviderKey &&
			!catalog.some((provider) => provider.providerKey === selectedProviderKey)
		)
			setSelectedProviderKey(catalog[0]?.providerKey ?? "");
	}, [catalog, selectedProviderKey]);

	useEffect(() => {
		if (!selectedProvider) return;
		setFormValues({
			providerKey: selectedProvider.providerKey,
			apiKey: "",
			baseUrl:
				typeof currentConfig.baseUrl === "string"
					? currentConfig.baseUrl
					: selectedProvider.defaultBaseUrl,
			timeoutMs:
				typeof currentConfig.timeoutMs === "number"
					? currentConfig.timeoutMs
					: 12_000,
			model:
				typeof currentConfig.model === "string"
					? currentConfig.model
					: selectedProvider.defaultModel,
			sourceImageUrl:
				typeof currentConfig.sourceImageUrl === "string"
					? currentConfig.sourceImageUrl
					: "",
			count:
				selectedProvider.providerType === "image"
					? typeof currentConfig.count === "number"
						? currentConfig.count
						: 1
					: undefined,
			durationSeconds:
				selectedProvider.providerType === "video"
					? typeof currentConfig.durationSeconds === "number"
						? currentConfig.durationSeconds
						: 5
					: undefined,
			prompt:
				selectedProvider.providerType === "image"
					? t("admin.settings.mediaProviders.defaultImagePrompt")
					: t("admin.settings.mediaProviders.defaultVideoPrompt"),
		});
		setTestResult(null);
	}, [selectedProvider, providerConfigItem?.id]);

	const saveMutation = useMutation({
		mutationFn: ({
			providerKey,
			value,
		}: {
			providerKey: string;
			value: Record<string, unknown>;
		}) =>
			adminApi.upsertConfig({
				key: `media.provider.${providerKey}`,
				value,
				isRuntime: true,
				isSensitive: true,
			}),
		onSuccess: () => {
			toast.success(t("admin.settings.mediaProviders.saveSuccess"));
			void queryClient.invalidateQueries({ queryKey: ["admin", "configs"] });
		},
		onError: () => toast.error(t("admin.settings.mediaProviders.saveFailed")),
	});
	const testMutation = useMutation({
		mutationFn: ({
			providerKey,
			payload,
		}: {
			providerKey: string;
			payload: AdminMediaProviderTestInput;
		}) => adminApi.testMediaProvider(providerKey, payload),
		onSuccess: (result) => {
			setTestResult(result);
			toast.success(t("admin.settings.mediaProviders.testSuccess"));
		},
		onError: () => {
			setTestResult(null);
			toast.error(t("admin.settings.mediaProviders.testFailed"));
		},
	});

	const handleSave = () => {
		if (!selectedProvider) return;
		const value = buildMediaProviderSaveValue({
			formValues,
			providerType: selectedProvider.providerType,
			secretConfigured: configured,
		});
		if (!value) {
			toast.error(
				t("admin.settings.mediaProviders.apiKeyRequired"),
			);
			return;
		}
		saveMutation.mutate({ providerKey: selectedProvider.providerKey, value });
	};

	const handleTest = () => {
		if (!selectedProvider) return;
		const payload: AdminMediaProviderTestInput = {
			apiKey: formValues.apiKey?.trim() || undefined,
			baseUrl: formValues.baseUrl?.trim() || undefined,
			timeoutMs: formValues.timeoutMs,
			model: formValues.model?.trim() || undefined,
			prompt: formValues.prompt?.trim() || undefined,
		};
		if (selectedProvider.providerType === "image")
			payload.count = formValues.count;
		else {
			payload.durationSeconds = formValues.durationSeconds;
			payload.sourceImageUrl = formValues.sourceImageUrl?.trim() || undefined;
		}
		testMutation.mutate({ providerKey: selectedProvider.providerKey, payload });
	};

	return (
		<>
			<SEO
				title={t("admin.settings.heading")}
				description={t("admin.settings.subtitle")}
			/>
			<div className="space-y-6">
				<AdminPageHeader
					eyebrow={t("admin.nav.group.govern")}
					title={t("admin.settings.heading")}
					description={t("admin.settings.subtitle")}
				/>
				<Tabs
					value={activeTab}
					onValueChange={(value: string) => setActiveTab(value as SettingsTab)}
				>
					<div className="overflow-x-auto border-b">
						<TabsList variant="line" className="min-w-max pb-2">
							<TabsTrigger value="providers">
								<KeyRound className="size-4" />
								{t("admin.settings.tabs.providers")}
							</TabsTrigger>
							<TabsTrigger value="admins">
								<Users className="size-4" />
								{t("admin.settings.tabs.admins")}
							</TabsTrigger>
							<TabsTrigger value="governance">
								<BellRing className="size-4" />
								{t("admin.settings.tabs.governance")}
							</TabsTrigger>
						</TabsList>
					</div>
					<TabsContent value="providers" className="pt-4">
						{activeTab === "providers" && (
							<MediaProviderSettingsCard
								formValues={formValues}
								onFormChange={(partial) =>
									setFormValues((current) => ({ ...current, ...partial }))
								}
								catalog={catalog}
								selectedProvider={selectedProvider}
								selectedProviderKey={selectedProviderKey}
								configured={configured}
								configurationMasked={configurationMasked}
								testResult={testResult}
								saveLoading={saveMutation.isPending}
								testLoading={testMutation.isPending}
								onProviderChange={setSelectedProviderKey}
								onSave={handleSave}
								onTest={handleTest}
							/>
						)}
					</TabsContent>
					<TabsContent value="admins" className="pt-4">
						{activeTab === "admins" && <AdminUsersSettingsPanel />}
					</TabsContent>
					<TabsContent value="governance" className="pt-4">
						{activeTab === "governance" && <GovernanceSettingsPanel />}
					</TabsContent>
				</Tabs>
			</div>
		</>
	);
}
