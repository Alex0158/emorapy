export interface ApiResponseErrorLike {
    code?: string;
    message?: string;
    details?: unknown;
}
export interface ApiResponseEnvelope<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: ApiResponseErrorLike | null;
}
export interface SuccessfulApiResponseEnvelope<T = unknown> extends ApiResponseEnvelope<T> {
    success: true;
    data: T;
}
export interface RequestErrorLike {
    code: string;
    message: string;
    details?: unknown;
}
export declare function toRequestError(code: string, message: string, details?: unknown): RequestErrorLike;
export declare function isApiResponseEnvelope(data: unknown): data is ApiResponseEnvelope<unknown>;
export declare function readApiResponseError(data: unknown): ApiResponseErrorLike;
export declare function statusToRequestCode(status: number): string;
export declare function statusToRequestMessage(status: number): string;
export declare function wrapSuccessfulApiResponse<T>(data: T): SuccessfulApiResponseEnvelope<T>;
//# sourceMappingURL=apiResponse.d.ts.map