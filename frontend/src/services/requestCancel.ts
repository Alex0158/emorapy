const cancelTokenMap = new Map<string, AbortController>();

export function registerCancelableRequest(
	requestId: string,
	controller: AbortController,
): void {
	cancelTokenMap.set(requestId, controller);
}

export function unregisterCancelableRequest(requestId: string): void {
	cancelTokenMap.delete(requestId);
}

export function cancelRequest(requestId: string): void {
	const controller = cancelTokenMap.get(requestId);
	if (!controller) return;
	controller.abort();
	cancelTokenMap.delete(requestId);
}

export function cancelAllRequests(): void {
	cancelTokenMap.forEach((controller) => controller.abort());
	cancelTokenMap.clear();
}
