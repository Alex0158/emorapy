import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";
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
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminPanel } from "@/components/common/AdminPage";
import { cn } from "@/lib/utils";
import { humanizeAdminKey } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

type JsonValueKind = "array" | "object";

interface JsonConfigCardProps {
	title: string;
	subtitle: string;
	fieldName: string;
	requiredMessage: string;
	placeholder: string;
	loading: boolean;
	valueKind: JsonValueKind;
	saveLabel: string;
	onSave: (value: unknown) => void;
	initialValue?: string;
}

function parseJsonByKind(raw: string, kind: JsonValueKind): unknown {
	const parsed = JSON.parse(raw);
	if (kind === "array") {
		if (!Array.isArray(parsed)) throw new Error("not-array");
		return parsed;
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
		throw new Error("not-object");
	return parsed;
}

function summarize(value: unknown): string {
	if (typeof value === "boolean")
		return value ? t("admin.common.enabled") : t("admin.common.disabled");
	if (typeof value === "number" || typeof value === "string")
		return String(value);
	if (Array.isArray(value))
		return t("admin.configs.itemCount", { count: value.length });
	if (value && typeof value === "object")
		return t("admin.configs.fieldCount", { count: Object.keys(value).length });
	return "—";
}

export default function JsonConfigCard(props: JsonConfigCardProps) {
	const {
		title,
		subtitle,
		fieldName,
		requiredMessage,
		placeholder,
		loading,
		valueKind,
		saveLabel,
		onSave,
		initialValue,
	} = props;
	const [value, setValue] = useState(initialValue ?? "");
	const [editing, setEditing] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pendingValue, setPendingValue] = useState<unknown>(null);

	useEffect(() => setValue(initialValue ?? ""), [initialValue]);
	const preview = useMemo(() => {
		try {
			return parseJsonByKind(
				value || (valueKind === "array" ? "[]" : "{}"),
				valueKind,
			);
		} catch {
			return valueKind === "array" ? [] : {};
		}
	}, [value, valueKind]);
	const rows =
		valueKind === "array"
			? (preview as unknown[]).map(
					(item, index) => [String(index + 1), item] as const,
				)
			: Object.entries(preview as Record<string, unknown>);

	const prepareSave = () => {
		if (!value.trim()) {
			toast.error(requiredMessage);
			return;
		}
		try {
			setPendingValue(parseJsonByKind(value, valueKind));
			setConfirmOpen(true);
		} catch {
			toast.error(requiredMessage);
		}
	};

	return (
		<>
			<AdminPanel title={title} description={subtitle}>
				{rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{t("admin.settings.noRulesConfigured")}
					</p>
				) : (
					<div className="divide-y rounded-lg border">
						{rows.slice(0, 20).map(([key, item]) => {
							const record =
								item && typeof item === "object" && !Array.isArray(item)
									? (item as Record<string, unknown>)
									: null;
							const label = record
								? String(record.key ?? record.name ?? record.metric ?? key)
								: humanizeAdminKey(key);
							return (
								<div
									key={`${key}-${label}`}
									className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
								>
									<div>
										<p className="font-medium">{humanizeAdminKey(label)}</p>
										{record && (
											<p className="mt-0.5 text-xs text-muted-foreground">
												{Object.keys(record)
													.slice(0, 4)
													.map(humanizeAdminKey)
													.join(" · ")}
											</p>
										)}
									</div>
									<span className="max-w-[45%] truncate text-right text-muted-foreground">
										{summarize(record ?? item)}
									</span>
								</div>
							);
						})}
					</div>
				)}
				<Collapsible open={editing} onOpenChange={setEditing} className="mt-4">
					<CollapsibleTrigger asChild>
						<Button variant="outline" size="sm">
							<PencilLine className="size-4" />
							{t("admin.settings.editAdvanced")}
							<ChevronDown
								className={cn(
									"size-4 transition-transform",
									editing && "rotate-180",
								)}
							/>
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="mt-4 space-y-3 border-t pt-4">
						<p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
							{t("admin.settings.advancedJsonHint")}
						</p>
						<div className="space-y-2">
							<Label htmlFor={fieldName}>{title}</Label>
								<Textarea
									id={fieldName}
									aria-label={title}
								rows={10}
								autoComplete="off"
								placeholder={placeholder}
								value={value}
								onChange={(event) => setValue(event.target.value)}
								className="font-mono text-xs"
							/>
						</div>
						<Button disabled={loading} onClick={prepareSave}>
							{loading && <Loader2 className="size-4 animate-spin" />}
							{saveLabel || t("common.save")}
						</Button>
					</CollapsibleContent>
				</Collapsible>
			</AdminPanel>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("admin.settings.confirmGovernanceChange")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("admin.settings.confirmGovernanceHint")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>
							{t("common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={loading}
							onClick={() => {
								onSave(pendingValue);
								setConfirmOpen(false);
							}}
						>
							{loading && <Loader2 className="size-4 animate-spin" />}
							{t("common.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
