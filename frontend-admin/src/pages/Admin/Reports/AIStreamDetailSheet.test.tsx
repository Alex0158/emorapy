import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdminAIStreamDetailData } from "@/types/admin";

vi.mock("@/utils/i18n", () => ({
	getLocale: () => "en-US",
	t: (key: string) => key,
}));

vi.mock("@/components/ui/sheet", () => ({
	Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SheetContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SheetDescription: ({ children }: { children: React.ReactNode }) => (
		<p>{children}</p>
	),
	SheetHeader: ({ children }: { children: React.ReactNode }) => (
		<header>{children}</header>
	),
	SheetTitle: ({ children }: { children: React.ReactNode }) => (
		<h2>{children}</h2>
	),
}));

import AIStreamDetailSheet from "./AIStreamDetailSheet";

const detail: AdminAIStreamDetailData = {
	source: "live",
	sensitiveContentIncluded: true,
	session: {
		streamId: "stream-1",
		requestId: "request-1",
		scopeType: "chat_room",
		scopeId: "room-1",
		status: "persisted",
		lastSeq: 1,
		lastEventType: "stream.persisted",
		text: "private relationship text",
		createdAt: "2026-07-12T10:00:00.000Z",
		updatedAt: "2026-07-12T10:00:01.000Z",
	},
	events: [
		{
			streamId: "stream-1",
			requestId: "request-1",
			scopeType: "chat_room",
			scopeId: "room-1",
			seq: 1,
			eventType: "stream.delta",
			deltaText: "private event canary",
			createdAt: "2026-07-12T10:00:00.000Z",
			source: "live",
		},
	],
};

const renderDetail = ({
	canReadSensitive,
	sensitiveContentIncluded = true,
	showSensitiveText = false,
	sensitiveLoading = false,
	sensitiveError = false,
}: {
	canReadSensitive: boolean;
	sensitiveContentIncluded?: boolean;
	showSensitiveText?: boolean;
	sensitiveLoading?: boolean;
	sensitiveError?: boolean;
}) =>
	renderToStaticMarkup(
		<AIStreamDetailSheet
			streamId="stream-1"
			detail={{ ...detail, sensitiveContentIncluded }}
			loading={false}
			error={false}
			canReadSensitive={canReadSensitive}
			showSensitiveText={showSensitiveText}
			sensitiveLoading={sensitiveLoading}
			sensitiveError={sensitiveError}
			onClose={vi.fn()}
			onRetry={vi.fn()}
			onRevealSensitive={vi.fn()}
			onHideSensitive={vi.fn()}
			onRetrySensitive={vi.fn()}
		/>,
	);

describe("AIStreamDetailSheet sensitive content", () => {
	it("無敏感報表權限時不顯示 reveal 或用戶原文", () => {
		const html = renderDetail({ canReadSensitive: false });

		expect(html).not.toContain("admin.reports.hideText");
		expect(html).not.toContain("admin.reports.revealText");
		expect(html).not.toContain("private relationship text");
		expect(html).not.toContain("private event canary");
		expect(html).not.toContain("admin.reports.aiStreamsRawEvents");
		expect(html).toContain("admin.reports.aiStreamsSensitiveForbidden");
	});

	it("有權限但尚未 explicit fetch 時顯示 Reveal，且 redacted detail 不含原文或 raw event", () => {
		const html = renderDetail({
			canReadSensitive: true,
			sensitiveContentIncluded: false,
		});

		expect(html).not.toContain("admin.reports.hideText");
		expect(html).toContain("admin.reports.revealText");
		expect(html).not.toContain("private relationship text");
		expect(html).not.toContain("private event canary");
		expect(html).not.toContain("admin.reports.aiStreamsRawEvents");
		expect(html).toContain("admin.reports.aiStreamsTextHidden");
	});

	it("explicit sensitive response 與顯示狀態都通過時才顯示原文與 raw event", () => {
		const html = renderDetail({
			canReadSensitive: true,
			showSensitiveText: true,
		});

		expect(html).toContain("admin.reports.hideText");
		expect(html).toContain("private relationship text");
		expect(html).toContain("admin.reports.aiStreamsRawEvents");
	});

	it("sensitive fetch 期間提供 accessible loading 狀態", () => {
		const html = renderDetail({
			canReadSensitive: true,
			sensitiveContentIncluded: false,
			sensitiveLoading: true,
		});

		expect(html).toContain('role="status"');
		expect(html).toContain('aria-live="polite"');
		expect(html).toContain("common.loading");
	});

	it("sensitive fetch 失敗時提供 alert 與 retry action，不殘留原文", () => {
		const html = renderDetail({
			canReadSensitive: true,
			sensitiveContentIncluded: false,
			sensitiveError: true,
		});

		expect(html).toContain('role="alert"');
		expect(html).toContain("admin.common.loadFailed");
		expect(html).toContain("common.retry");
		expect(html).not.toContain("private relationship text");
	});
});
