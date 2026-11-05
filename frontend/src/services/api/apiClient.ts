import axios from 'axios';
import { appConfig } from '@/app/config/env';
import { normalizeApiError } from '@/services/api/normalizeApiError';
import { clearAccessToken, getAccessToken } from '@/services/api/tokenStore';

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuth?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: appConfig.apiBaseUrl,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  config.headers.set('Accept', 'application/json');
  config.headers.set('Content-Type', 'application/json');

  if (token && !config.skipAuth) {
    config.headers.set('Authorization', `Bearer ${token}`);
  } else {
    config.headers.delete('Authorization');
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const normalizedError = normalizeApiError(error);

    if (normalizedError.status === 401) {
      clearAccessToken('unauthorized');
    } else if (
      normalizedError.status === 403 &&
      normalizedError.code === 'ACCOUNT_NOT_ACTIVE'
    ) {
      clearAccessToken('account_inactive');
    }

    return Promise.reject(normalizedError);
  },
);
