import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { apiClient, enableWebSession } from '@/services/api/apiClient';
import { setAccessToken, clearAccessToken } from '@/services/api/tokenStore';

describe('session-backed workspace requests', () => {
  it('uses the same-origin API without sending a stored bearer token', async () => {
    setAccessToken('legacy-token');
    enableWebSession();

    let request: InternalAxiosRequestConfig | undefined;
    await apiClient.get('/projects', {
      adapter: async (config) => {
        request = config;
        return { data: {}, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
      },
    });

    expect(request?.baseURL).toBe('/api/v1');
    expect(request?.headers.get('X-Hirgal-Session')).toBe('1');
    expect(request?.headers.get('Authorization')).toBeUndefined();
    clearAccessToken();
  });
});
