export interface ResponseMeta {
    request_id?: string;
    timestamp?: string;
}
export interface ApiError {
    code: string;
    message: string;
    details?: unknown;
    request_id?: string;
    timestamp?: string;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: ApiError;
    meta?: ResponseMeta;
}
export interface PaginationParams {
    page?: number;
    page_size?: number;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}
export interface PaginationMeta {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_more?: boolean;
}
export interface ListResponse<T> {
    items: T[];
    pagination: PaginationMeta;
}
export interface ResponsibilityRatio {
    plaintiff: number;
    defendant: number;
}
//# sourceMappingURL=common.d.ts.map