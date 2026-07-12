import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, setAdminToken } from "@/services/api/admin";

export function useAdminSession() {
	const queryClient = useQueryClient();

	const loginMutation = useMutation({
		mutationFn: async (payload: { email: string; password: string }) => {
			const data = await adminApi.login(payload);
			const saved = setAdminToken(data.token);
			if (!saved) {
				throw new Error("Failed to persist admin token");
			}
			return data;
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["admin"] });
		},
	});

	const logout = () => {
		setAdminToken("");
		queryClient.removeQueries({ queryKey: ["admin"] });
	};

	return {
		loginMutation,
		logout,
	};
}
