import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { appConfig } from '@/app/config/env';
import { apiClient } from '@/services/api/apiClient';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '@/services/api/tokenStore';

afterEach(() => {
  clearAccessToken();
});

describe('apiClient', () => {
  it('uses the validated API base URL', () => {
    expect(apiClient.defaults.baseURL).toBe(appConfig.apiBaseUrl);
    expect(apiClient.defaults.withCredentials).toBe(false);
  });

  it('keeps bearer credentials in memory only', () => {
    setAccessToken('test-token');

    expect(getAccessToken()).toBe('test-token');

    clearAccessToken();

    expect(getAccessToken()).toBeNull();
  });

  it('adds a Bearer authorization header to API requests', async () => {
    let authorizationHeader: string | undefined;
    let acceptHeader: string | undefined;
    let contentTypeHeader: string | undefined;
    const adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      const authorization = config.headers.get('Authorization');
      const accept = config.headers.get('Accept');
      const contentType = config.headers.get('Content-Type');

      authorizationHeader =
        typeof authorization === 'string' ? authorization : undefined;
      acceptHeader = typeof accept === 'string' ? accept : undefined;
      contentTypeHeader =
        typeof contentType === 'string' ? contentType : undefined;

      return {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      };
    };

    setAccessToken('test-token');

    await apiClient.get('/auth/me', { adapter });

    expect(authorizationHeader).toBe('Bearer test-token');
    expect(acceptHeader).toBe('application/json');
    expect(contentTypeHeader).toBe('application/json');
  });

  it('clears the in-memory token after an unauthorized response', async () => {
    const adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      const response: AxiosResponse = {
        data: {
          success: false,
          message: 'Unauthenticated.',
          errors: null,
          error_code: 'UNAUTHENTICATED',
        },
        status: 401,
        statusText: 'Unauthorized',
        headers: new AxiosHeaders(),
        config,
      };

      throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response);
    };

    setAccessToken('expired-token');

    await expect(apiClient.get('/auth/me', { adapter })).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    expect(getAccessToken()).toBeNull();
  });
});
