import { act, render, screen } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockCheckAuth,
	mockInitSEO,
	mockLogPageLoadTime,
	routerLifecycle,
	localeState,
} = vi.hoisted(() => ({
	mockCheckAuth: vi.fn(),
	mockInitSEO: vi.fn(),
	mockLogPageLoadTime: vi.fn(),
	routerLifecycle: { mounts: 0, unmounts: 0 },
	localeState: {
		value: "zh-TW",
		listener: null as null | (() => void),
	},
}));

vi.mock("react-router-dom", () => ({
	RouterProvider: () => {
		useEffect(() => {
			routerLifecycle.mounts += 1;
			return () => {
				routerLifecycle.unmounts += 1;
			};
		}, []);
		return <div data-testid="router-provider" />;
	},
}));

vi.mock("./router", () => ({ router: {} }));
vi.mock("./components/common/ErrorBoundary", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./components/common/Loading", () => ({ default: () => null }));
vi.mock("./components/common/NetworkStatus", () => ({ default: () => null }));
vi.mock("./components/ui/sonner", () => ({
	Toaster: () => <div data-testid="feedback-toaster" />,
}));
vi.mock("./utils/performance", () => ({
	logPageLoadTime: mockLogPageLoadTime,
}));
vi.mock("./utils/seo", () => ({ initSEO: mockInitSEO }));
vi.mock("./store/authStore", () => ({
	useAuthStore: () => ({ checkAuth: mockCheckAuth }),
}));
vi.mock("./utils/i18n", () => ({
	getLocale: () => localeState.value,
	onLocaleChange: (listener: () => void) => {
		localeState.listener = listener;
		return () => {
			localeState.listener = null;
		};
	},
	t: (key: string) => key,
}));

import App from "./App";

describe("App locale lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		routerLifecycle.mounts = 0;
		routerLifecycle.unmounts = 0;
		localeState.value = "zh-TW";
		localeState.listener = null;
	});

	it("切換語言時更新 SEO，但不重建 Router 或重跑 auth check", () => {
		render(<App />);
		expect(screen.getByTestId("router-provider")).toBeInTheDocument();
		expect(screen.getByTestId("feedback-toaster")).toBeInTheDocument();
		expect(routerLifecycle.mounts).toBe(1);
		expect(mockCheckAuth).toHaveBeenCalledOnce();
		expect(mockInitSEO).toHaveBeenCalledOnce();

		act(() => {
			localeState.value = "en-US";
			localeState.listener?.();
		});

		expect(routerLifecycle.mounts).toBe(1);
		expect(routerLifecycle.unmounts).toBe(0);
		expect(mockCheckAuth).toHaveBeenCalledOnce();
		expect(mockInitSEO).toHaveBeenCalledTimes(2);
	});
});
