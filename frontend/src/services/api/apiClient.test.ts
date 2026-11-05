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

  it('keeps the session for an ordinary forbidden response', async () => {
    const adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      const response: AxiosResponse = {
        data: {
          success: false,
          message: 'Forbidden.',
          errors: null,
          error_code: 'FORBIDDEN',
        },
        status: 403,
        statusText: 'Forbidden',
        headers: new AxiosHeaders(),
        config,
      };

      throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response);
    };

    setAccessToken('valid-token');

    await expect(apiClient.get('/projects', { adapter })).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(getAccessToken()).toBe('valid-token');
  });

  it('clears the token only for the inactive-account error code', async () => {
    const adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      const response: AxiosResponse = {
        data: {
          success: false,
          message: 'Account not active.',
          errors: null,
          error_code: 'ACCOUNT_NOT_ACTIVE',
        },
        status: 403,
        statusText: 'Forbidden',
        headers: new AxiosHeaders(),
        config,
      };

      throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response);
    };

    setAccessToken('inactive-token');

    await expect(apiClient.get('/auth/me', { adapter })).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_NOT_ACTIVE',
    });
    expect(getAccessToken()).toBeNull();
  });

  it('does not let a stale request clear a newer login token', async () => {
    let requestConfig: InternalAxiosRequestConfig | undefined;
    let rejectRequest: ((error: AxiosError) => void) | undefined;
    let resolveStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
      new Promise((_, reject) => {
        requestConfig = config;
        rejectRequest = reject;
        resolveStarted?.();
      });

    setAccessToken('old-token');
    const requestFailure = expect(apiClient.get('/auth/me', { adapter })).rejects.toMatchObject({
      status: 401,
    });
    await started;
    setAccessToken('new-token');

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
      config: requestConfig!,
    };
    rejectRequest?.(
      new AxiosError('Request failed', 'ERR_BAD_REQUEST', requestConfig, null, response),
    );

    await requestFailure;
    expect(getAccessToken()).toBe('new-token');
  });
});
