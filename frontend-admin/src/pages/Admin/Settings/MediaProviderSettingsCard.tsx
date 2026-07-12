import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	AdminPanel,
	AdminRawDetails,
	AdminStatusBadge,
} from "@/components/common/AdminPage";
import type {
	AdminMediaProviderCatalogItem,
	AdminMediaProviderTestResult,
} from "@/types/admin";
import { t } from "@/utils/i18n";
import type { MediaProviderFormValues } from "./types";

interface MediaProviderSettingsCardProps {
	formValues: MediaProviderFormValues;
	onFormChange: (values: Partial<MediaProviderFormValues>) => void;
	catalog: AdminMediaProviderCatalogItem[];
	selectedProvider?: AdminMediaProviderCatalogItem;
	selectedProviderKey: string;
	configured: boolean;
	configurationMasked: boolean;
	testResult: AdminMediaProviderTestResult | null;
	saveLoading: boolean;
	testLoading: boolean;
	onProviderChange: (providerKey: string) => void;
	onSave: () => void | Promise<void>;
	onTest: () => void | Promise<void>;
}

export default function MediaProviderSettingsCard(
	props: MediaProviderSettingsCardProps,
) {
	const {
		formValues,
		onFormChange,
		catalog,
		selectedProvider,
		selectedProviderKey,
		configured,
		configurationMasked,
		testResult,
		saveLoading,
		testLoading,
		onProviderChange,
		onSave,
		onTest,
	} = props;
	return (
		<AdminPanel
			title={t("admin.settings.mediaProviders.title")}
			description={t("admin.settings.mediaProviders.subtitle")}
		>
			<div className="space-y-6">
				<div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
					<div className="space-y-2">
						<Label htmlFor="media-provider-select">
							{t("admin.settings.mediaProviders.provider")}
						</Label>
						<Select
							value={selectedProviderKey}
							onValueChange={onProviderChange}
						>
							<SelectTrigger id="media-provider-select">
								<SelectValue
									placeholder={t(
										"admin.settings.mediaProviders.selectProvider",
									)}
								/>
							</SelectTrigger>
							<SelectContent>
								{catalog.map((provider) => (
									<SelectItem
										key={provider.providerKey}
										value={provider.providerKey}
									>
										{provider.displayName} · {provider.providerType}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{selectedProvider && (
						<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/25 p-3">
							<Badge variant="outline">{selectedProvider.providerType}</Badge>
							<code className="text-xs">
								{selectedProvider.defaultModel || "—"}
							</code>
							<AdminStatusBadge
								status={configured}
								label={
									configured
										? t("admin.settings.mediaProviders.configured")
										: t("admin.settings.mediaProviders.notConfigured")
								}
							/>
							<p className="basis-full text-xs text-muted-foreground">
								{selectedProvider.description}
							</p>
						</div>
					)}
				</div>

				{selectedProvider && (
					<>
						{configurationMasked && (
							<div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
								<KeyRound className="mt-0.5 size-4 shrink-0 text-warning" />
								<div>
									<p className="text-sm font-medium">
										{t("admin.settings.mediaProviders.secretStoredTitle")}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{t("admin.settings.mediaProviders.secretStoredHint")}
									</p>
								</div>
							</div>
						)}
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="admin-media-provider-api-key">
									{selectedProvider.secretLabel ||
										t("admin.settings.mediaProviders.apiKey")}
								</Label>
								<Input
									id="admin-media-provider-api-key"
									type="password"
									placeholder={
										configured
											? t(
													"admin.settings.mediaProviders.rotateSecretPlaceholder",
												)
											: "sk-…"
									}
									autoComplete="new-password"
									value={formValues.apiKey ?? ""}
									onChange={(event) =>
										onFormChange({ apiKey: event.target.value })
									}
								/>
								<p className="text-xs text-muted-foreground">
									{configured
										? t("admin.settings.mediaProviders.rotateSecretHelp")
										: t("admin.settings.mediaProviders.apiKeyHelp")}
								</p>
							</div>
							<div className="space-y-2">
								<Label htmlFor="admin-media-provider-base-url">
									{t("admin.settings.mediaProviders.baseUrl")}
								</Label>
								<Input
									id="admin-media-provider-base-url"
									placeholder={selectedProvider.defaultBaseUrl || ""}
									autoComplete="url"
									value={formValues.baseUrl ?? ""}
									onChange={(event) =>
										onFormChange({ baseUrl: event.target.value })
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="admin-media-provider-model">
									{t("admin.settings.mediaProviders.model")}
								</Label>
								<Input
									id="admin-media-provider-model"
									placeholder={selectedProvider.defaultModel || ""}
									autoComplete="off"
									value={formValues.model ?? ""}
									onChange={(event) =>
										onFormChange({ model: event.target.value })
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="admin-media-provider-timeout">
									{t("admin.settings.mediaProviders.timeoutMs")}
								</Label>
								<Input
									id="admin-media-provider-timeout"
									type="number"
									autoComplete="off"
									min={500}
									max={120000}
									value={formValues.timeoutMs ?? ""}
									onChange={(event) =>
										onFormChange({
											timeoutMs: Number(event.target.value) || undefined,
										})
									}
								/>
							</div>
							{selectedProvider.providerType === "video" && (
								<div className="space-y-2 md:col-span-2">
									<Label htmlFor="admin-media-provider-source-image">
										{t("admin.settings.mediaProviders.sourceImage")}
									</Label>
									<Input
										id="admin-media-provider-source-image"
										autoComplete="url"
										value={formValues.sourceImageUrl ?? ""}
										onChange={(event) =>
											onFormChange({ sourceImageUrl: event.target.value })
										}
									/>
								</div>
							)}
						</div>

						<div className="rounded-xl border bg-muted/20 p-4">
							<p className="text-sm font-semibold">
								{t("admin.settings.mediaProviders.testTitle")}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{t("admin.settings.mediaProviders.testHint")}
							</p>
							<div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_9rem]">
								<div className="space-y-2">
									<Label htmlFor="admin-media-provider-prompt">
										{t("admin.settings.mediaProviders.prompt")}
									</Label>
									<Textarea
										id="admin-media-provider-prompt"
										rows={3}
										autoComplete="off"
										value={formValues.prompt ?? ""}
										onChange={(event) =>
											onFormChange({ prompt: event.target.value })
										}
									/>
								</div>
								{selectedProvider.providerType === "image" ? (
									<div className="space-y-2">
										<Label htmlFor="admin-media-provider-count">
											{t("admin.settings.mediaProviders.count")}
										</Label>
										<Input
											id="admin-media-provider-count"
											type="number"
											autoComplete="off"
											min={1}
											max={20}
											value={formValues.count ?? ""}
											onChange={(event) =>
												onFormChange({
													count: Number(event.target.value) || undefined,
												})
											}
										/>
									</div>
								) : (
									<div className="space-y-2">
										<Label htmlFor="admin-media-provider-duration">
											{t("admin.settings.mediaProviders.duration")}
										</Label>
										<Input
											id="admin-media-provider-duration"
											type="number"
											autoComplete="off"
											min={1}
											max={240}
											value={formValues.durationSeconds ?? ""}
											onChange={(event) =>
												onFormChange({
													durationSeconds:
														Number(event.target.value) || undefined,
												})
											}
										/>
									</div>
								)}
							</div>
						</div>

						<div className="flex flex-wrap gap-2">
							<Button disabled={saveLoading} onClick={onSave}>
								{saveLoading && <Loader2 className="size-4 animate-spin" />}
								{t("admin.settings.mediaProviders.save")}
							</Button>
							<Button variant="outline" disabled={testLoading} onClick={onTest}>
								{testLoading && <Loader2 className="size-4 animate-spin" />}
								{t("admin.settings.mediaProviders.test")}
							</Button>
						</div>

						{testResult && (
							<div className="space-y-3">
								<div
									className={
										testResult.success
											? "flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm"
											: "flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
									}
								>
									{testResult.success ? (
										<CheckCircle2 className="mt-0.5 size-4 text-success" />
									) : (
										<AlertCircle className="mt-0.5 size-4 text-destructive" />
									)}
									<div>
										<p className="font-medium">{testResult.message}</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{t("admin.settings.mediaProviders.latency")}:{" "}
											{testResult.latencyMs} ms
										</p>
									</div>
								</div>
								{testResult.detail !== undefined && (
									<AdminRawDetails
										value={testResult.detail}
										summary={t("admin.common.advancedDetails")}
									/>
								)}
							</div>
						)}
					</>
				)}
			</div>
		</AdminPanel>
	);
}
