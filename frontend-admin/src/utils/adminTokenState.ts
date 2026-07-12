import { isLikelyAdminJwt } from "@/services/api/admin";

export interface AdminTokenStatus {
	tokenPresent: boolean;
	tokenReady: boolean;
	tokenFormatInvalid: boolean;
}

export function deriveAdminTokenStatus(token: string): AdminTokenStatus {
	const normalized = token.trim();
	const tokenPresent = normalized.length > 0;
	const tokenReady = tokenPresent && isLikelyAdminJwt(normalized);

	return {
		tokenPresent,
		tokenReady,
		tokenFormatInvalid: tokenPresent && !tokenReady,
	};
}
