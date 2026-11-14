import { AxiosHeaders } from 'axios';
import { expect, it } from 'vitest';
import { apiClient } from '@/services/api/apiClient';
import { habitApi } from '@/services/api/habitApi';

it('serializes habit archive filters as query values accepted by Laravel', async () => {
  const originalAdapter = apiClient.defaults.adapter!;
  const urls: URL[] = [];
  apiClient.defaults.adapter = async (config) => {
    urls.push(new URL(apiClient.getUri(config)));
    return { config, data: { data: [] }, status: 200, statusText: 'OK', headers: new AxiosHeaders() };
  };

  try {
    await habitApi.list({ is_archived: false, page: 1 });
    await habitApi.list({ is_archived: true, frequency: 'daily' });
    await habitApi.list({});

    expect(urls.map((url) => url.searchParams.get('is_archived'))).toEqual(['0', '1', null]);
    expect(urls[0]?.searchParams.get('page')).toBe('1');
    expect(urls[1]?.searchParams.get('frequency')).toBe('daily');
  } finally {
    apiClient.defaults.adapter = originalAdapter;
  }
});
