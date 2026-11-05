import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/services/api/apiClient';

const defaultAdapter = apiClient.defaults.adapter!;

afterEach(() => {
  apiClient.defaults.adapter = defaultAdapter;
});
import { userApi } from '@/services/api/userApi';

function createAdapter(
  respond: (config: InternalAxiosRequestConfig) => unknown,
  requests: InternalAxiosRequestConfig[],
) {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    requests.push(config);
    return {
      data: respond(config),
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    };
  };
}

describe('userApi', () => {
  it('uses the admin listing contract with filters and pagination metadata', async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    const page = { success: true, message: 'Users loaded', data: [], meta: { current_page: 2, last_page: 4, per_page: 15, total: 53 } };
    apiClient.defaults.adapter = createAdapter(() => page, requests);

    const result = await userApi.listUsers({ search: 'Amina', status: 'active', role: 'member', page: 2, per_page: 15, sort_by: 'name', sort_direction: 'asc' });

    expect(requests[0]?.url).toBe('/users');
    expect(requests[0]?.params).toEqual({ search: 'Amina', status: 'active', role: 'member', page: 2, per_page: 15, sort_by: 'name', sort_direction: 'asc' });
    expect(result).toEqual(page);
  });

  it('uses the sanitized directory endpoint and exposes the standard page metadata', async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    const response = { success: true, message: 'Directory loaded', data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } };
    apiClient.defaults.adapter = createAdapter(() => response, requests);

    await userApi.listDirectory({ search: 'design', department: 'Design', page: 1, per_page: 20 });

    expect(requests[0]?.url).toBe('/users/directory');
    expect(requests[0]?.params).toEqual({ search: 'design', department: 'Design', page: 1, per_page: 20 });
  });

  it('sends supported update and account action requests to the user resource', async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    apiClient.defaults.adapter = createAdapter((config) => ({
      success: true,
      message: 'Updated',
      data: { id: 42, ...((config.data && JSON.parse(config.data)) || {}) },
    }), requests);

    await userApi.getUser(42);
    await userApi.updateUser(42, { name: 'Amina Noor', email: 'amina@example.test', timezone: 'Africa/Nairobi' });
    await userApi.activateUser(42);
    await userApi.deactivateUser(42);

    expect(requests.map(({ method, url }) => [method, url])).toEqual([
      ['get', '/users/42'],
      ['put', '/users/42'],
      ['post', '/users/42/activate'],
      ['post', '/users/42/deactivate'],
    ]);
    expect(JSON.parse(requests[1]!.data as string)).toEqual({ name: 'Amina Noor', email: 'amina@example.test', timezone: 'Africa/Nairobi' });
  });
});
