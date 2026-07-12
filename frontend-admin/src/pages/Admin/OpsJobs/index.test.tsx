import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));
vi.mock("@/components/common/SEO", () => ({ default: () => null }));
vi.mock("@/hooks/useAdminJobStats", () => ({
	useAdminJobStats: () => ({
		data: undefined,
		error: null,
		isLoading: false,
		isFetching: false,
		dataUpdatedAt: 0,
		refetch: vi.fn(),
	}),
}));

import OpsJobsStatsPage from "./index";

describe("OpsJobsStatsPage filter contract", () => {
	it("keeps query controls and removes the page-local token editor", () => {
		const html = renderToStaticMarkup(<OpsJobsStatsPage />);
		expect(html).toContain('for="admin-ops-days"');
		expect(html).toContain('id="admin-ops-days"');
		expect(html).toContain('for="admin-ops-rate-base"');
		expect(html).toContain('for="admin-ops-max-rows"');
		expect(html).toContain('id="admin-ops-max-rows"');
		expect(html).not.toContain("admin-ops-token");
	});
});
