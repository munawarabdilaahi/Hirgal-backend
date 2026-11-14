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

let usesWebSession = false;

export function enableWebSession(): void {
  usesWebSession = true;
  apiClient.defaults.baseURL = '/api/v1';
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  config.headers.set('Accept', 'application/json');
  config.headers.set('Content-Type', 'application/json');
  if (usesWebSession) {
    config.headers.set('X-Hirgal-Session', '1');
  }

  if (token && !config.skipAuth && !usesWebSession) {
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
    if (usesWebSession && (normalizedError.status === 401 || normalizedError.code === 'ACCOUNT_NOT_ACTIVE')) {
      window.location.assign('/login');
    }
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
