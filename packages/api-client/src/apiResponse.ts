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

export interface SuccessfulApiResponseEnvelope<T = unknown>
  extends ApiResponseEnvelope<T> {
  success: true;
  data: T;
}

export interface RequestErrorLike {
  code: string;
  message: string;
  details?: unknown;
}

export function toRequestError(
  code: string,
  message: string,
  details?: unknown
): RequestErrorLike {
  return { code, message, details };
}

export function isApiResponseEnvelope(
  data: unknown
): data is ApiResponseEnvelope<unknown> {
  return Boolean(data && typeof data === 'object' && 'success' in data);
}

export function readApiResponseError(data: unknown): ApiResponseErrorLike {
  if (!data || typeof data !== 'object') return {};
  const body = data as ApiResponseEnvelope<unknown>;
  if (body.error && typeof body.error === 'object') {
    return {
      code: body.error.code,
      message: body.error.message || body.message,
      details: body.error.details,
    };
  }
  return {
    message: body.message,
  };
}

export function statusToRequestCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMIT';
    case 500:
      return 'SERVER_ERROR';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return `HTTP_${status}`;
  }
}

export function statusToRequestMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not found';
    case 409:
      return 'Conflict';
    case 422:
      return 'Validation failed';
    case 429:
      return 'Too many requests';
    case 500:
      return 'Internal server error';
    case 503:
      return 'Service unavailable';
    default:
      return 'Request failed';
  }
}

export function wrapSuccessfulApiResponse<T>(
  data: T
): SuccessfulApiResponseEnvelope<T> {
  return {
    success: true,
    data,
  };
}
