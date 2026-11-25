import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEchoClient,
  disconnectEcho,
  getBroadcastingAuthUrl,
  getEcho,
} from './echo';
import { apiClient } from '@/services/api/apiClient';

vi.mock('@/services/api/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('echo service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    disconnectEcho();
  });

  it('computes correct broadcasting auth URL', () => {
    const authUrl = getBroadcastingAuthUrl();
    expect(authUrl).toContain('/api/broadcasting/auth');
  });

  it('returns null when reverb app key is missing', () => {
    const echo = createEchoClient({ key: '' });
    expect(echo).toBeNull();
  });

  it('creates an Echo client with configuration overrides', () => {
    const echo = createEchoClient({
      key: 'test-app-key',
      wsHost: '127.0.0.1',
      wsPort: 8080,
      wssPort: 8080,
      forceTLS: false,
    });

    expect(echo).not.toBeNull();
    expect(echo?.options.broadcaster).toBe('reverb');
    expect(echo?.options.key).toBe('test-app-key');
  });

  it('authorizes private channels through apiClient.post', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { auth: 'test-auth-signature' },
    });

    const echo = createEchoClient({ key: 'test-app-key' });
    expect(echo).not.toBeNull();

    const authorizerFactory = echo?.options.authorizer;
    expect(authorizerFactory).toBeDefined();

    if (authorizerFactory) {
      const authorizer = authorizerFactory(
        { name: 'private-users.42' } as unknown as Parameters<typeof authorizerFactory>[0],
        {} as unknown as Parameters<typeof authorizerFactory>[1],
      );
      const callback = vi.fn();

      authorizer.authorize('12345.67890', callback);

      await vi.waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/broadcasting/auth'),
          {
            socket_id: '12345.67890',
            channel_name: 'private-users.42',
          },
        );
        expect(callback).toHaveBeenCalledWith(null, { auth: 'test-auth-signature' });
      });
    }
  });

  it('handles authorization errors properly in authorizer callback', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Forbidden channel'));

    const echo = createEchoClient({ key: 'test-app-key' });
    const authorizerFactory = echo?.options.authorizer;
    expect(authorizerFactory).toBeDefined();

    if (authorizerFactory) {
      const authorizer = authorizerFactory(
        { name: 'private-users.99' } as unknown as Parameters<typeof authorizerFactory>[0],
        {} as unknown as Parameters<typeof authorizerFactory>[1],
      );
      const callback = vi.fn();

      authorizer.authorize('socket-id-1', callback);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledWith(
          expect.any(Error),
          null,
        );
      });
    }
  });

  it('disconnects and resets the singleton instance', () => {
    const echo1 = getEcho();
    disconnectEcho();
    const echo2 = getEcho();

    if (echo1 && echo2) {
      expect(echo1).not.toBe(echo2);
    }
  });
});
