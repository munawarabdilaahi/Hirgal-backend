import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
} from 'axios';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/services/api/ApiError';
import { normalizeApiError } from '@/services/api/normalizeApiError';
import type { ApiErrorResponse } from '@/services/api/contracts';

describe('normalizeApiError', () => {
  it('preserves Laravel validation errors and status', () => {
    const response: AxiosResponse<ApiErrorResponse> = {
      data: {
        success: false,
        message: 'Validation failed',
        errors: { email: ['Invalid credentials.'] },
        error_code: 'VALIDATION_ERROR',
      },
      status: 422,
      statusText: 'Unprocessable Content',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
    const error = new AxiosError<ApiErrorResponse>(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      response,
    );

    const normalizedError = normalizeApiError(error);

    expect(normalizedError).toBeInstanceOf(ApiError);
    expect(normalizedError.status).toBe(422);
    expect(normalizedError.code).toBe('VALIDATION_ERROR');
    expect(normalizedError.errors).toEqual({
      email: ['Invalid credentials.'],
    });
    expect(normalizedError.message).toBe('Validation failed');
  });

  it.each([
    { status: 401, errorCode: 'UNAUTHENTICATED' },
    { status: 403, errorCode: 'FORBIDDEN' },
    { status: 404, errorCode: 'RESOURCE_NOT_FOUND' },
    { status: 500, errorCode: 'INTERNAL_SERVER_ERROR' },
  ])('normalizes HTTP $status errors', ({ status, errorCode }) => {
    const response: AxiosResponse<ApiErrorResponse> = {
      data: {
        success: false,
        message: 'Request failed',
        errors: null,
        error_code: errorCode,
      },
      status,
      statusText: 'Error',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
    const error = new AxiosError<ApiErrorResponse>(
      'Request failed',
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      response,
    );

    expect(normalizeApiError(error)).toMatchObject({
      status,
      code: errorCode,
      message: 'Request failed',
    });
  });

  it('returns a safe error for network failures', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');

    expect(normalizeApiError(error)).toMatchObject({
      status: null,
      code: null,
      message:
        'Unable to reach the Hirgal API. Check the connection and try again.',
    });
  });
});
