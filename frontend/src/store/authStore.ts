/**
 * 認證狀態管理
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { User } from "@/services/api/auth";
import * as authApi from "@/services/api/auth";
import { getProfile } from "@/services/api/user";

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
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

function getPersistedToken(): string | null {
	return localStorage.getItem("token") || sessionStorage.getItem("token");
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set, get) => ({
			user: null,
			token: null,
			isAuthenticated: false,
			isLoading: false,

			login: async (email: string, password: string, rememberMe?: boolean) => {
				set({ isLoading: true });
				try {
					const response = await authApi.login({ email, password });
					if (rememberMe) {
						localStorage.setItem("token", response.token);
						sessionStorage.removeItem("token");
					} else {
						sessionStorage.setItem("token", response.token);
						localStorage.removeItem("token");
					}
					set({
						user: response.user,
						token: response.token,
						isAuthenticated: true,
						isLoading: false,
					});
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
					localStorage.setItem("token", response.token);
					sessionStorage.removeItem("token");
					set({
						user: response.user,
						token: response.token,
						isAuthenticated: true,
						isLoading: false,
					});
				} catch (error) {
					set({ isLoading: false });
					throw error;
				}
			},

			logout: () => {
				localStorage.removeItem("token");
				sessionStorage.removeItem("token");
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
						localStorage.removeItem("token");
						sessionStorage.removeItem("token");
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
