import axios from 'axios';
import { appConfig } from '@/app/config/env';
import { normalizeApiError } from '@/services/api/normalizeApiError';
import { clearAccessToken, getAccessToken } from '@/services/api/tokenStore';

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuth?: boolean;
    authToken?: string | null;
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
    config.authToken = token;
  } else {
    config.headers.delete('Authorization');
    config.authToken = null;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const normalizedError = normalizeApiError(error);
    const requestToken = axios.isAxiosError(error) ? error.config?.authToken : null;
    const requestTokenIsCurrent = requestToken !== null && requestToken === getAccessToken();

    if (normalizedError.status === 401 && requestTokenIsCurrent) {
      clearAccessToken('unauthorized');
    } else if (
      normalizedError.status === 403 &&
      normalizedError.code === 'ACCOUNT_NOT_ACTIVE' &&
      requestTokenIsCurrent
    ) {
      clearAccessToken('account_inactive');
    }

    return Promise.reject(normalizedError);
  },
);
