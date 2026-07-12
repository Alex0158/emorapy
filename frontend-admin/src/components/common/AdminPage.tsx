import { useState, type ReactNode } from "react";
import { AlertCircle, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { formatAdminDateTime } from "@/utils/adminFormat";
import { t } from "@/utils/i18n";

export function AdminPageHeader({
	eyebrow,
	title,
	description,
	actions,
	updatedAt,
}: {
	eyebrow?: string;
	title: string;
	description?: string;
	actions?: ReactNode;
	updatedAt?: number | string | Date;
}) {
	return (
		<header className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
			<div className="max-w-3xl">
				{eyebrow && (
					<p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
						{eyebrow}
					</p>
				)}
				<h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[1.75rem]">
					{title}
				</h1>
				{description && (
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						{description}
					</p>
				)}
				{updatedAt && (
					<p className="mt-2 text-xs text-muted-foreground">
						{t("admin.common.lastUpdated")}: {formatAdminDateTime(updatedAt)}
					</p>
				)}
			</div>
			{actions && (
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{actions}
				</div>
			)}
		</header>
	);
}

export function AdminPanel({
	title,
	description,
	actions,
	children,
	className,
}: {
	title?: string;
	description?: string;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn("rounded-xl border bg-surface", className)}>
			{(title || description || actions) && (
				<div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
					<div>
						{title && (
							<h2 className="text-base font-semibold text-foreground">
								{title}
							</h2>
						)}
						{description && (
							<p className="mt-0.5 text-sm text-muted-foreground">
								{description}
							</p>
						)}
					</div>
					{actions && (
						<div className="flex shrink-0 flex-wrap items-center gap-2">
							{actions}
						</div>
					)}
				</div>
			)}
			<div className="p-4 sm:p-5">{children}</div>
		</section>
	);
}

export function AdminMetricStrip({
	items,
}: {
	items: Array<{
		label: string;
		value: ReactNode;
		note?: string;
		tone?: "default" | "success" | "warning" | "danger";
	}>;
}) {
	return (
		<dl className="grid overflow-hidden rounded-xl border bg-surface sm:grid-cols-2 xl:grid-cols-4">
			{items.map((item, index) => (
				<div
					key={`${item.label}-${index}`}
					className="border-b p-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2n)]:border-r xl:last:border-r-0"
				>
					<dt className="text-xs font-medium text-muted-foreground">
						{item.label}
					</dt>
					<dd
						className={cn(
							"mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground",
							item.tone === "success" && "text-success",
							item.tone === "warning" && "text-warning",
							item.tone === "danger" && "text-destructive",
						)}
					>
						{item.value}
					</dd>
					{item.note && (
						<p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
					)}
				</div>
			))}
		</dl>
	);
}

export function AdminStatusBadge({
	status,
	label,
}: {
	status?: string | boolean | null;
	label?: string;
}) {
	const normalized = String(status ?? "unknown").toLowerCase();
	const success = [
		"healthy",
		"success",
		"ok",
		"completed",
		"persisted",
		"active",
		"enabled",
		"true",
	].includes(normalized);
	const danger = [
		"failed",
		"error",
		"unavailable",
		"disabled",
		"cancelled",
		"false",
	].includes(normalized);
	const warning = [
		"running",
		"queued",
		"started",
		"streaming",
		"partial",
		"pending",
	].includes(normalized);
	return (
		<Badge
			variant="outline"
			className={cn(
				"rounded-md font-medium",
				success && "border-success/30 bg-success/10 text-success",
				warning && "border-warning/40 bg-warning/10 text-warning-foreground",
				danger && "border-destructive/30 bg-destructive/10 text-destructive",
			)}
		>
			{label ?? String(status ?? t("admin.common.unknown"))}
		</Badge>
	);
}

export function AdminQueryState({
	loading,
	error,
	empty,
	emptyMessage,
	onRetry,
	children,
}: {
	loading?: boolean;
	error?: boolean;
	empty?: boolean;
	emptyMessage?: string;
	onRetry?: () => void;
	children: ReactNode;
}) {
	if (loading) {
		return (
			<div
				className="flex min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground"
				role="status"
			>
				<Loader2 className="size-4 animate-spin" />
				{t("common.loading")}
			</div>
		);
	}
	if (error) {
		return (
			<div
				className="flex min-h-44 flex-col items-center justify-center gap-3 text-center"
				role="alert"
			>
				<AlertCircle className="size-5 text-destructive" />
				<p className="text-sm text-muted-foreground">
					{t("admin.common.loadFailed")}
				</p>
				{onRetry && (
					<Button variant="outline" size="sm" onClick={onRetry}>
						<RefreshCw className="size-3.5" /> {t("common.retry")}
					</Button>
				)}
			</div>
		);
	}
	if (empty) {
		return (
			<div className="flex min-h-36 items-center justify-center text-sm text-muted-foreground">
				{emptyMessage ?? t("common.noData")}
			</div>
		);
	}
	return <>{children}</>;
}

export function AdminRawDetails({
	summary,
	value,
	sensitive = false,
}: {
	summary?: string;
	value: unknown;
	sensitive?: boolean;
}) {
	const [open, setOpen] = useState(false);
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="px-0 text-muted-foreground"
				>
					<ChevronDown
						className={cn("size-4 transition-transform", open && "rotate-180")}
					/>
					{summary ?? t("admin.common.advancedDetails")}
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				{sensitive && (
					<p className="mb-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-foreground">
						{t("admin.common.sensitiveDetailHint")}
					</p>
				)}
				<pre className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs leading-5 whitespace-pre-wrap break-all">
					{typeof value === "string" ? value : JSON.stringify(value, null, 2)}
				</pre>
			</CollapsibleContent>
		</Collapsible>
	);
}
