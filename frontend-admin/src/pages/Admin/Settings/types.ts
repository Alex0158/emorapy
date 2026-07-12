export interface AdminUserFormValues {
	email: string;
	password: string;
	name: string;
	roleKey: "super_admin" | "ops" | "marketing" | "support";
}

export interface MediaProviderFormValues {
	providerKey?: string;
	apiKey?: string;
	baseUrl?: string;
	timeoutMs?: number;
	model?: string;
	sourceImageUrl?: string;
	count?: number;
	durationSeconds?: number;
	prompt?: string;
}
