export interface TokenStorageAdapter {
  getToken(): Promise<string | null> | string | null;
  setToken(token: string): Promise<void> | void;
  clearToken(): Promise<void> | void;
}

export interface SessionStorageAdapter {
  getSessionId(): Promise<string | null> | string | null;
  setSessionId(sessionId: string): Promise<void> | void;
  clearSessionId(): Promise<void> | void;
}

export interface PendingLandingStorageAdapter {
  getPendingHref(): Promise<string | null> | string | null;
  setPendingHref(href: string): Promise<void> | void;
  clearPendingHref(): Promise<void> | void;
  consumePendingHref(): Promise<string | null> | string | null;
}
