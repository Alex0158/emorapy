const ADMIN_TOKEN_STORAGE_KEY = "admin_token";
const ADMIN_TOKEN_CHANGED_EVENT = "admin-token-changed";

function readStorageToken(storage: Storage | undefined): string {
	if (!storage) return "";
	try {
		return (storage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "").trim();
	} catch {
		return "";
	}
}

function removeStorageToken(storage: Storage | undefined): void {
	if (!storage) return;
	try {
		storage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
	} catch {
		// Storage can be unavailable in hardened browser contexts.
	}
}

export function isLikelyAdminJwt(token: string): boolean {
	const normalized = token.trim();
	const parts = normalized.split(".");
	if (parts.length !== 3) return false;
	const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
	return parts.every((part) => part.length > 0 && base64UrlPattern.test(part));
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	try {
		const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
		const decoded = atob(normalized);
		const parsed = JSON.parse(decoded) as Record<string, unknown>;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

export function isAdminTokenExpired(token: string): boolean {
	const payload = parseJwtPayload(token.trim());
	if (!payload) return false;
	const expRaw = payload.exp;
	if (typeof expRaw !== "number" || !Number.isFinite(expRaw)) return false;
	return expRaw <= Math.floor(Date.now() / 1000);
}

export function getAdminToken(): string {
	if (typeof window === "undefined") return "";
	try {
		const sessionToken = readStorageToken(window.sessionStorage);
		const localToken = readStorageToken(window.localStorage);
		const token = sessionToken || localToken;
		if (!token) return "";
		if (isAdminTokenExpired(token)) {
			removeStorageToken(window.sessionStorage);
			removeStorageToken(window.localStorage);
			window.dispatchEvent(new Event(ADMIN_TOKEN_CHANGED_EVENT));
			return "";
		}
		if (!sessionToken && localToken) {
			try {
				window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, localToken);
				window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
			} catch {
				// Keep the readable legacy token for the current request.
			}
		}
		return token;
	} catch {
		return "";
	}
}

export function setAdminToken(token: string): boolean {
	if (typeof window === "undefined") return false;
	try {
		const normalized = token.trim();
		if (normalized) {
			window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, normalized);
			window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
		} else {
			window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
			window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
		}
		window.dispatchEvent(new Event(ADMIN_TOKEN_CHANGED_EVENT));
		return true;
	} catch {
		return false;
	}
}

export function clearAdminToken(): boolean {
	return setAdminToken("");
}

function hashToken(input: string): string {
	let hash = 5381;
	for (let index = 0; index < input.length; index += 1) {
		hash = (hash * 33) ^ input.charCodeAt(index);
	}
	return (hash >>> 0).toString(16);
}

export function getAdminTokenFingerprint(tokenInput?: string): string {
	const token = (tokenInput ?? getAdminToken()).trim();
	if (!token) return "missing";
	return `h:${hashToken(token)}`;
}

export function subscribeAdminTokenChanges(
	onStoreChange: () => void,
): () => void {
	if (typeof window === "undefined") return () => {};

	const handleTokenChanged = () => onStoreChange();
	const handleStorage = (event: StorageEvent) => {
		if (event.key === ADMIN_TOKEN_STORAGE_KEY) onStoreChange();
	};

	window.addEventListener(ADMIN_TOKEN_CHANGED_EVENT, handleTokenChanged);
	window.addEventListener("storage", handleStorage);
	return () => {
		window.removeEventListener(ADMIN_TOKEN_CHANGED_EVENT, handleTokenChanged);
		window.removeEventListener("storage", handleStorage);
	};
}

export function getAdminAuthHeaders() {
	const adminToken = getAdminToken().trim();
	if (!isLikelyAdminJwt(adminToken)) return undefined;
	return { Authorization: `Bearer ${adminToken}` };
}
