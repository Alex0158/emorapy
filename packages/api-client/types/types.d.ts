export interface HttpClientDefaults {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
}
export interface RequestContext {
    requestId?: string;
    locale?: string;
    sessionId?: string | null;
    token?: string | null;
}
//# sourceMappingURL=types.d.ts.map