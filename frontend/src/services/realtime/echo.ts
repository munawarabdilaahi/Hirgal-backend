import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { appConfig } from '@/app/config/env';
import { apiClient } from '@/services/api/apiClient';

if (typeof window !== 'undefined') {
  (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;
}

export type EchoInstance = Echo<'reverb'>;

export function getBroadcastingAuthUrl(): string {
  try {
    const url = new URL(appConfig.apiBaseUrl);
    return `${url.origin}/api/broadcasting/auth`;
  } catch {
    return '/api/broadcasting/auth';
  }
}

export interface EchoOptionsOverride {
  key?: string;
  wsHost?: string;
  wsPort?: number;
  wssPort?: number;
  forceTLS?: boolean;
}

let echoInstance: EchoInstance | null = null;

export function createEchoClient(overrides?: EchoOptionsOverride): EchoInstance | null {
  const key = overrides?.key ?? appConfig.reverb.key;
  if (!key) {
    return null;
  }

  const wsHost = overrides?.wsHost ?? appConfig.reverb.host;
  const wsPort = overrides?.wsPort ?? appConfig.reverb.port;
  const wssPort = overrides?.wssPort ?? appConfig.reverb.port;
  const forceTLS = overrides?.forceTLS ?? appConfig.reverb.scheme === 'https';

  return new Echo<'reverb'>({
    broadcaster: 'reverb',
    key,
    wsHost,
    wsPort,
    wssPort,
    forceTLS,
    enabledTransports: ['ws', 'wss'],
    Pusher,
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        const authUrl = getBroadcastingAuthUrl();
        apiClient
          .post<{ auth: string; channel_data?: string }>(authUrl, {
            socket_id: socketId,
            channel_name: channel.name,
          })
          .then((response) => {
            callback(null, response.data);
          })
          .catch((error: unknown) => {
            const normalized = error instanceof Error ? error : new Error(String(error));
            callback(normalized, null);
          });
      },
    }),
  });
}

export function getEcho(): EchoInstance | null {
  if (!echoInstance) {
    echoInstance = createEchoClient();
  }
  return echoInstance;
}

export function disconnectEcho(): void {
  if (echoInstance) {
    try {
      echoInstance.disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }
    echoInstance = null;
  }
}
