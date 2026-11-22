import axios from 'axios';
import { ApiError } from '@/services/api/ApiError';
import type { ApiErrorResponse } from '@/services/api/contracts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall back to original string
      }
    }
  }
  return value;
}

function extractErrorMessage(data: unknown): string | null {
  if (isRecord(data)) {
    if (typeof data.message === 'string' && data.message.trim().length > 0) {
      return data.message.trim();
    }
    if (isRecord(data.errors)) {
      const firstEntry = Object.values(data.errors)[0];
      if (Array.isArray(firstEntry) && typeof firstEntry[0] === 'string') {
        return firstEntry[0];
      }
      if (typeof firstEntry === 'string') {
        return firstEntry;
      }
    }
  }
  if (typeof data === 'string') {
    const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]?.trim()) {
      return titleMatch[1].trim();
    }
    const h1Match = data.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match?.[1]?.trim()) {
      return h1Match[1].trim();
    }
  }
  return null;
}

function extractErrors(data: unknown): Record<string, string[]> | null {
  if (isRecord(data) && isRecord(data.errors)) {
    const result: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(data.errors)) {
      if (Array.isArray(val)) {
        result[key] = val.filter((item): item is string => typeof item === 'string');
      } else if (typeof val === 'string') {
        result[key] = [val];
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  }
  return null;
}

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

function statusFallbackMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 413:
      return 'The uploaded file is too large.';
    case 419:
      return 'Your session has expired. Please refresh the page and try again.';
    case 422:
      return 'Validation failed. Please check your submission.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return 'The request could not be completed. Please try again.';
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const response = error.response;

    if (response) {
      const parsedData = tryParseJson(response.data);
      const body = isApiErrorResponse(parsedData) ? parsedData : null;
      const message = body?.message ?? extractErrorMessage(parsedData);
      const errors = (response.status >= 500 ? null : (body?.errors ?? extractErrors(parsedData))) ?? null;
      const code =
        body?.error_code ??
        (isRecord(parsedData) && typeof parsedData.error_code === 'string' ? parsedData.error_code : null);

      return new ApiError(
        response.status >= 500
          ? 'Hirgal could not complete the request. Please try again.'
          : message ?? statusFallbackMessage(response.status),
        response.status,
        code,
        errors,
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
