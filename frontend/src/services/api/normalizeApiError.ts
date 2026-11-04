import axios from 'axios';
import { ApiError } from '@/services/api/ApiError';
import type { ApiErrorResponse } from '@/services/api/contracts';

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === false &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const response = error.response;

    if (response) {
      const body = isApiErrorResponse(response.data) ? response.data : null;

      return new ApiError(
        body?.message ?? 'The API request failed.',
        response.status,
        body?.error_code ?? null,
        body?.errors ?? null,
      );
    }

    return new ApiError(
      'Unable to reach the Hirgal API. Check the connection and try again.',
      null,
    );
  }

  if (error instanceof Error) {
    return new ApiError(error.message, null);
  }

  return new ApiError('An unexpected error occurred.', null);
}
