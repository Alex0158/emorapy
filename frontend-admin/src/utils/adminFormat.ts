import { getLocale } from "@/utils/i18n";

export function formatAdminDateTime(
	value?: string | number | Date | null,
): string {
	if (!value) return "—";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	return new Intl.DateTimeFormat(getLocale(), {
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).format(date);
}

export function formatAdminNumber(value: number): string {
	return new Intl.NumberFormat(getLocale()).format(value);
}

export function formatAdminPercent(value: number, digits = 1): string {
	return new Intl.NumberFormat(getLocale(), {
		style: "percent",
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(value);
}

export function formatDurationMs(value?: number | null): string {
	if (value === null || value === undefined || !Number.isFinite(value))
		return "—";
	if (value < 1000) return `${Math.round(value)} ms`;
	if (value < 60_000)
		return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} s`;
	return `${Math.floor(value / 60_000)}m ${Math.round((value % 60_000) / 1000)}s`;
}

export function humanizeAdminKey(value?: string | null): string {
	if (!value) return "—";
	return value
		.replace(/[._:-]+/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
