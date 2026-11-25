import { router } from '@inertiajs/react';
import type { Page, RequestPayload } from '@inertiajs/core';
import { ApiError } from '@/services/api/ApiError';

export function submitWebForm(method: 'post' | 'put', url: string, data: RequestPayload): Promise<Page> {
  return new Promise((resolve, reject) => {
    router.visit(url, {
      method,
      data,
      preserveState: true,
      preserveScroll: true,
      onSuccess: (page) => { resolve(page); },
      onError: (errors) => {
        reject(new ApiError('Check the form and try again.', 422, null,
          Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]))));
      },
      onCancel: () => reject(new Error('Request cancelled.')),
      onHttpException: (response) => {
        reject(new ApiError(response.status === 429 ? 'Too many attempts. Try again shortly.' : 'The request could not be completed.', response.status));
        return false;
      },
      onNetworkError: () => {
        reject(new ApiError('Connection failed.', null));
        return false;
      },
    });
  });
}
