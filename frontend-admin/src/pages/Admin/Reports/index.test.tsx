import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/utils/i18n", () => ({
	t: (key: string) => key,
}));
vi.mock("@/components/common/SEO", () => ({ default: () => null }));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({
		data: undefined,
		error: null,
		isLoading: false,
		isFetching: false,
		dataUpdatedAt: 0,
		refetch: vi.fn(),
	}),
	useMutation: () => ({
		mutate: vi.fn(),
		isPending: false,
		data: undefined,
		error: null,
	}),
}));

vi.mock("@/services/api/admin", () => ({
	adminApi: {
		getReportOverview: vi.fn(),
		getReportFunnel: vi.fn(),
		getCustomReport: vi.fn(),
		getReportCosts: vi.fn(),
		getReportAIStreams: vi.fn(),
		listReportAIStreamSessions: vi.fn(),
		getReportAIStreamDetail: vi.fn(),
		downloadReportOverviewCsv: vi.fn(),
	},
}));

import AdminReportsPage from "./index";

describe("AdminReportsPage", () => {
	it("以任務分頁取代原始 metric key 輸入", () => {
		const html = renderToStaticMarkup(<AdminReportsPage />);
		expect(html).toContain("admin.reports.overview");
		expect(html).toContain("admin.reports.funnel");
		expect(html).toContain("admin.reports.costs");
		expect(html).toContain("admin.reports.aiStreams");
		expect(html).not.toContain("admin-custom-metrics");
	});
});
