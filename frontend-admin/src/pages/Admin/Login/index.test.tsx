// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";

const { mockAdminLogin } = vi.hoisted(() => ({
	mockAdminLogin: vi.fn(),
}));

(
	globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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
		loginMutation: { mutateAsync: mockAdminLogin, isPending: false },
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

	it("invalid credentials remain visible in the form", async () => {
		mockAdminLogin.mockRejectedValueOnce(new Error("invalid credentials"));
		const host = document.createElement("div");
		document.body.append(host);
		const root = createRoot(host);
		await act(async () => root.render(<AdminLoginPage />));

		const setInputValue = (input: HTMLInputElement, value: string) => {
			Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			)?.set?.call(input, value);
			input.dispatchEvent(new Event("input", { bubbles: true }));
		};
		await act(async () => {
			setInputValue(
				host.querySelector("#email") as HTMLInputElement,
				"invalid@example.com",
			);
			setInputValue(
				host.querySelector("#password") as HTMLInputElement,
				"wrong-password",
			);
		});
		await act(async () => {
			host
				.querySelector("form")
				?.dispatchEvent(
					new Event("submit", { bubbles: true, cancelable: true }),
				);
			await Promise.resolve();
		});

		expect(mockAdminLogin).toHaveBeenCalled();
		expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy();
		await act(async () => root.unmount());
		host.remove();
	});
});
