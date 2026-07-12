import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("react-router-dom", () => ({
	Navigate: () => null,
	useLocation: () => ({ state: null }),
	useNavigate: () => vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("@/components/common/SEO", () => ({ default: () => null }));
vi.mock("@/hooks/useAdminSession", () => ({
	useAdminSession: () => ({
		loginMutation: { mutateAsync: vi.fn(), isPending: false },
		logout: vi.fn(),
	}),
}));
vi.mock("@/hooks/useAdminToken", () => ({
	useAdminToken: () => "",
}));
vi.mock("@/hooks/useAdminMe", () => ({
	useAdminMe: () => ({ data: undefined, error: null, isLoading: false }),
}));

import AdminLoginPage from "./index";

describe("AdminLoginPage form contract", () => {
	it("credential inputs expose labels and autocomplete", () => {
		const html = renderToStaticMarkup(<AdminLoginPage />);
		expect(html).toContain('for="email"');
		expect(html).toContain('id="email"');
		expect(html).toContain('autoComplete="email"');
		expect(html).toContain('for="password"');
		expect(html).toContain('id="password"');
		expect(html).toContain('autoComplete="current-password"');
	});
});
