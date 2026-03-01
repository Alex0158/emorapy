/**
 * 認證狀態管理
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { User } from "@/services/api/auth";
import * as authApi from "@/services/api/auth";
import { getProfile } from "@/services/api/user";
import { registerRequestLogoutHandler } from "@/services/requestAuthBridge";
import { logger } from "@/utils/logger";
import { cancelAllRequests } from "@/services/requestCancel";
import { sessionStorage as appSessionStorage } from "@/utils/storage";
import { useInterviewStore } from "./interviewStore";
import { usePsychProfileStore } from "./psychProfileStore";
import { useCaseStore } from "./caseStore";

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	_hasHydrated: boolean;
	login: (
		email: string,
		password: string,
		rememberMe?: boolean,
	) => Promise<void>;
	register: (
		email: string,
		password: string,
		nickname?: string,
	) => Promise<void>;
	logout: () => void;
	updateUser: (user: Partial<User>) => void;
	checkAuth: () => Promise<void>;
}

function safeGetItem(storage: Storage, key: string): string | null {
	try { return storage.getItem(key); } catch { return null; }
}
function safeSetItem(storage: Storage, key: string, value: string): void {
	try { storage.setItem(key, value); } catch { /* noop */ }
}
function safeRemoveItem(storage: Storage, key: string): void {
	try { storage.removeItem(key); } catch { /* noop */ }
}
function getPersistedToken(): string | null {
	return safeGetItem(localStorage, "token") || safeGetItem(sessionStorage, "token");
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set, get) => ({
			user: null,
			token: null,
			isAuthenticated: false,
			_hasHydrated: false,
			isLoading: false,

			login: async (email: string, password: string, rememberMe?: boolean) => {
				set({ isLoading: true });
				try {
					const response = await authApi.login({ email, password });
					if (rememberMe) {
						safeSetItem(localStorage, "token", response.token);
						safeRemoveItem(sessionStorage, "token");
					} else {
						safeSetItem(sessionStorage, "token", response.token);
						safeRemoveItem(localStorage, "token");
					}
					set({
						user: response.user,
						token: response.token,
						isAuthenticated: true,
						isLoading: false,
					});

					const quickSessionId = appSessionStorage.get();
					if (quickSessionId) {
						authApi.claimSession(quickSessionId).catch((e: unknown) => { logger.warn('Failed to claim quick session on login', e); });
					}
				} catch (error) {
					set({ isLoading: false });
					throw error;
				}
			},

			register: async (email: string, password: string, nickname?: string) => {
				set({ isLoading: true });
				try {
					const response = await authApi.register({
						email,
						password,
						nickname,
					});
					safeSetItem(localStorage, "token", response.token);
					safeRemoveItem(sessionStorage, "token");
					set({
						user: response.user,
						token: response.token,
						isAuthenticated: true,
						isLoading: false,
					});

					const quickSessionId = appSessionStorage.get();
					if (quickSessionId) {
						authApi.claimSession(quickSessionId).catch((e: unknown) => { logger.warn('Failed to claim quick session', e); });
					}
				} catch (error) {
					set({ isLoading: false });
					throw error;
				}
			},

			logout: () => {
				useInterviewStore.getState().reset();
				usePsychProfileStore.getState().reset();
				useCaseStore.getState().clearError();
				useCaseStore.getState().setCurrentCase(null);
				cancelAllRequests();

				safeRemoveItem(localStorage, "token");
				safeRemoveItem(sessionStorage, "token");
				set({
					user: null,
					token: null,
					isAuthenticated: false,
				});
			},

			updateUser: (user: Partial<User>) => {
				const currentUser = get().user;
				if (currentUser) {
					set({
						user: { ...currentUser, ...user },
					});
				}
			},

			checkAuth: async () => {
				const token = getPersistedToken();
				if (token) {
					try {
						const user = await getProfile();
						set({
							user,
							token,
							isAuthenticated: true,
						});
					} catch {
						safeRemoveItem(localStorage, "token");
						safeRemoveItem(sessionStorage, "token");
						set({
							user: null,
							token: null,
							isAuthenticated: false,
						});
					}
				} else {
					set({
						user: null,
						token: null,
						isAuthenticated: false,
					});
				}
			},
		}),
		{
			name: "auth-storage",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				user: state.user,
			}),
			onRehydrateStorage: () => (state) => {
				if (state) {
					const token = getPersistedToken();
					if (token && state.user) {
						state.token = token;
						state.isAuthenticated = true;
					} else {
						state.token = null;
						state.isAuthenticated = false;
					}
				}
			},
		},
	),
);

// Zustand v5 的 persist 使用同步 thenable 處理 localStorage hydration，
// 導致 onRehydrateStorage 回調在 create() 完成前就執行，此時 useAuthStore 仍在 TDZ。
// 改用 onFinishHydration API 確保 _hasHydrated 在 store 建立後才設定。
const _setHydrated = () => {
	useAuthStore.setState({ _hasHydrated: true });
};
if (useAuthStore.persist.hasHydrated()) {
	_setHydrated();
}
useAuthStore.persist.onFinishHydration(_setHydrated);
registerRequestLogoutHandler(() => {
	useAuthStore.getState().logout();
});
