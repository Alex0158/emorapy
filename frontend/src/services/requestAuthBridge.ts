let logoutHandler: (() => void) | null = null;
let hasPendingLogout = false;

export function registerRequestLogoutHandler(handler: () => void): void {
	logoutHandler = handler;
	if (hasPendingLogout) {
		hasPendingLogout = false;
		try {
			logoutHandler();
		} catch {
			// 註冊時補償執行失敗不應阻斷應用啟動
		}
	}
}

export function triggerRequestLogout(): void {
	if (!logoutHandler) {
		hasPendingLogout = true;
		return;
	}
	try {
		logoutHandler();
	} catch {
		// 登出流程屬於 side effect，不應阻斷原始請求錯誤鏈
	}
}
