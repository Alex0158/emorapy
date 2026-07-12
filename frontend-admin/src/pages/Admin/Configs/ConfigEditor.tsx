import { type MouseEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, LockKeyhole } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdminConfigItem } from "@/types/admin";
import { t } from "@/utils/i18n";

type ConfigValueKind = "boolean" | "number" | "text" | "json";

export interface ConfigEditorPayload {
	key: string;
	value: unknown;
	description?: string;
	isRuntime: boolean;
	isSensitive: boolean;
}

function inferValueKind(value: unknown): ConfigValueKind {
	if (typeof value === "boolean") return "boolean";
	if (typeof value === "number") return "number";
	if (typeof value === "string") return "text";
	return "json";
}

function serializeValue(value: unknown, kind: ConfigValueKind): string {
	if (kind === "json") return JSON.stringify(value ?? {}, null, 2);
	return String(value ?? "");
}

export default function ConfigEditor({
	item,
	createMode,
	canWrite,
	saving,
	onSave,
	onCancel,
}: {
	item: AdminConfigItem | null;
	createMode: boolean;
	canWrite: boolean;
	saving: boolean;
	onSave: (payload: ConfigEditorPayload) => void;
	onCancel: () => void;
}) {
	const [key, setKey] = useState("");
	const [description, setDescription] = useState("");
	const [isRuntime, setIsRuntime] = useState(true);
	const [isSensitive, setIsSensitive] = useState(false);
	const [valueKind, setValueKind] = useState<ConfigValueKind>("boolean");
	const [valueText, setValueText] = useState("true");
	const [validationError, setValidationError] = useState("");
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pendingPayload, setPendingPayload] =
		useState<ConfigEditorPayload | null>(null);

	useEffect(() => {
		const kind = item ? inferValueKind(item.value) : "boolean";
		setKey(item?.key ?? "");
		setDescription(item?.description ?? "");
		setIsRuntime(item?.is_runtime ?? true);
		setIsSensitive(item?.is_sensitive ?? false);
		setValueKind(kind);
		setValueText(item ? serializeValue(item.value, kind) : "true");
		setValidationError("");
		setConfirmOpen(false);
		setPendingPayload(null);
	}, [item, createMode]);

	const isMaskedSensitiveItem = Boolean(item?.is_sensitive);

	const prepareSave = () => {
		if (!key.trim()) {
			setValidationError(t("admin.configs.keyRequired"));
			return;
		}
		let value: unknown;
		try {
			if (valueKind === "boolean") value = valueText === "true";
			else if (valueKind === "number") {
				value = Number(valueText);
				if (!Number.isFinite(value)) throw new Error("invalid-number");
			} else if (valueKind === "json") value = JSON.parse(valueText);
			else value = valueText;
		} catch {
			setValidationError(t("admin.configs.valueInvalid"));
			return;
		}
		const payload = {
			key: key.trim(),
			value,
			description: description.trim() || undefined,
			isRuntime,
			isSensitive,
		};
		setValidationError("");
		setPendingPayload(payload);
		setConfirmOpen(true);
	};

	if (isMaskedSensitiveItem) {
		return (
			<div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
				<span className="flex size-10 items-center justify-center rounded-full bg-muted">
					<LockKeyhole className="size-5" />
				</span>
				<h3 className="mt-4 text-base font-semibold">
					{t("admin.configs.sensitiveTitle")}
				</h3>
				<p className="mt-2 max-w-md text-sm text-muted-foreground">
					{t("admin.configs.sensitiveHint")}
				</p>
				<Button asChild variant="outline" className="mt-4">
					<Link to="/admin/settings">{t("admin.configs.openSettings")}</Link>
				</Button>
			</div>
		);
	}

	return (
		<>
			<div className="space-y-5">
				<div className="space-y-2">
					<Label htmlFor="config-key">{t("admin.configs.key")}</Label>
					<Input
						id="config-key"
						value={key}
						onChange={(event) => setKey(event.target.value)}
						disabled={!createMode}
						autoComplete="off"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="config-description">
						{t("admin.configs.description")}
					</Label>
					<Input
						id="config-description"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						autoComplete="off"
					/>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="config-value-kind">
							{t("admin.configs.valueType")}
						</Label>
						<Select
							value={valueKind}
							onValueChange={(value: string) => {
								setValueKind(value as ConfigValueKind);
								setValueText(
									value === "boolean" ? "true" : value === "json" ? "{}" : "",
								);
							}}
						>
							<SelectTrigger id="config-value-kind">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="boolean">
									{t("admin.configs.typeBoolean")}
								</SelectItem>
								<SelectItem value="number">
									{t("admin.configs.typeNumber")}
								</SelectItem>
								<SelectItem value="text">
									{t("admin.configs.typeText")}
								</SelectItem>
								<SelectItem value="json">JSON</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-end gap-6 pb-2">
						<div className="flex items-center gap-2">
							<Switch
								id="config-runtime"
								checked={isRuntime}
								onCheckedChange={setIsRuntime}
							/>
							<Label htmlFor="config-runtime">
								{t("admin.configs.isRuntime")}
							</Label>
						</div>
						{createMode && (
							<div className="flex items-center gap-2">
								<Switch
									id="config-sensitive"
									checked={isSensitive}
									onCheckedChange={setIsSensitive}
								/>
								<Label htmlFor="config-sensitive">
									{t("admin.configs.isSensitive")}
								</Label>
							</div>
						)}
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="config-value">
						{valueKind === "json"
							? t("admin.configs.advancedJson")
							: t("admin.configs.value")}
					</Label>
					{valueKind === "boolean" ? (
						<div className="flex items-center gap-3 rounded-lg border p-3">
							<Switch
								id="config-value"
								checked={valueText === "true"}
								onCheckedChange={(checked: boolean) =>
									setValueText(String(checked))
								}
							/>
							<Label htmlFor="config-value">
								{valueText === "true"
									? t("admin.common.enabled")
									: t("admin.common.disabled")}
							</Label>
						</div>
					) : valueKind === "json" ? (
						<Textarea
							id="config-value"
							rows={9}
							value={valueText}
							onChange={(event) => setValueText(event.target.value)}
							autoComplete="off"
							className="font-mono text-xs"
						/>
					) : (
						<Input
							id="config-value"
							type={valueKind === "number" ? "number" : "text"}
							value={valueText}
							onChange={(event) => setValueText(event.target.value)}
							autoComplete="off"
						/>
					)}
				</div>

				{validationError && (
					<div
						className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
						role="alert"
					>
						<AlertTriangle className="size-4" /> {validationError}
					</div>
				)}

				<div className="flex justify-end gap-2 border-t pt-4">
					<Button variant="outline" onClick={onCancel}>
						{t("common.cancel")}
					</Button>
					<Button disabled={!canWrite || saving} onClick={prepareSave}>
						{t("admin.configs.reviewChange")}
					</Button>
				</div>
			</div>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("admin.configs.confirmTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("admin.configs.confirmHint")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<dl className="divide-y rounded-lg border px-4 text-sm">
						<div className="flex justify-between gap-4 py-3">
							<dt className="text-muted-foreground">
								{t("admin.configs.key")}
							</dt>
							<dd className="font-mono text-xs">{pendingPayload?.key}</dd>
						</div>
						<div className="flex justify-between gap-4 py-3">
							<dt className="text-muted-foreground">
								{t("admin.configs.isRuntime")}
							</dt>
							<dd>
								{pendingPayload?.isRuntime
									? t("admin.common.enabled")
									: t("admin.common.disabled")}
							</dd>
						</div>
					</dl>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={saving}>
							{t("common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={!pendingPayload || saving}
							onClick={(event: MouseEvent<HTMLButtonElement>) => {
								event.preventDefault();
								if (pendingPayload) onSave(pendingPayload);
							}}
						>
							{saving && <Loader2 className="size-4 animate-spin" />}
							{t("admin.configs.confirmSave")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
