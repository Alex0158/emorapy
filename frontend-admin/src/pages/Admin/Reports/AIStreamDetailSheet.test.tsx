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
	events: [],
};

const renderDetail = (
	canReadSensitive: boolean,
	sensitiveContentIncluded = true,
) =>
	renderToStaticMarkup(
		<AIStreamDetailSheet
			streamId="stream-1"
			detail={{ ...detail, sensitiveContentIncluded }}
			loading={false}
			error={false}
			canReadSensitive={canReadSensitive}
			showSensitiveText
			onClose={vi.fn()}
			onRetry={vi.fn()}
			onToggleSensitiveText={vi.fn()}
		/>,
	);

describe("AIStreamDetailSheet sensitive content", () => {
	it("無敏感報表權限時不顯示 reveal 或用戶原文", () => {
		const html = renderDetail(false);

		expect(html).not.toContain("admin.reports.hideText");
		expect(html).not.toContain("admin.reports.revealText");
		expect(html).not.toContain("private relationship text");
		expect(html).toContain("admin.reports.aiStreamsSensitiveForbidden");
	});

	it("只有前端 permission 但 backend 未包含敏感內容時仍維持隱藏", () => {
		const html = renderDetail(true, false);

		expect(html).not.toContain("admin.reports.hideText");
		expect(html).not.toContain("private relationship text");
	});

	it("permission 與 backend 標記都通過時才顯示原文", () => {
		const html = renderDetail(true);

		expect(html).toContain("admin.reports.hideText");
		expect(html).toContain("private relationship text");
	});
});
