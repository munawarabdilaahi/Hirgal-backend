import { useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AuthContext } from '@/features/auth/auth-context-state';
import type { ApiUser } from '@/services/api/contracts';
import {
  notificationApi,
  type NotificationData,
  type NotificationItem,
} from '@/services/api/notificationApi';
import { resolveNotificationTarget } from '@/features/notifications/notification-navigation';
import { getEcho } from '@/services/realtime/echo';

export interface RealtimeNotificationPayload {
  id?: string;
  type?: string;
  title?: string;
  message?: string;
  description?: string;
  event?: string;
  resource_type?: string;
  resource_id?: string;
  task_uuid?: string;
  project_uuid?: string;
  project_name?: string;
  appointment_uuid?: string;
  comment_id?: number;
  actor_id?: number;
  actor_name?: string;
  action_url?: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  organizer_name?: string;
  context?: string;
  data?: Record<string, unknown>;
  read_at?: string | null;
  created_at?: string | null;
}

export function normalizeRealtimePayload(payload: RealtimeNotificationPayload): NotificationItem {
  const innerData =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Partial<NotificationData>)
      : (payload as unknown as Partial<NotificationData>);

  const title = innerData.title ?? payload.title ?? 'New Notification';
  const message =
    innerData.message ??
    innerData.description ??
    payload.message ??
    payload.description ??
    (innerData.actor_name ? `From ${innerData.actor_name}` : '');

  const data: NotificationData = {
    ...innerData,
    title,
    message,
  };

  return {
    id: payload.id ?? String(Date.now()),
    type: payload.type ?? 'realtime_notification',
    data,
    read_at: payload.read_at ?? null,
    created_at: payload.created_at ?? new Date().toISOString(),
  };
}

export interface UseRealtimeNotificationsOptions {
  user?: Pick<ApiUser, 'id'> | null | undefined;
  enabled?: boolean | undefined;
  onNotification?: ((notification: NotificationItem) => void) | undefined;
}

export function useRealtimeNotifications(
  optionsOrUser?: UseRealtimeNotificationsOptions | Pick<ApiUser, 'id'> | null,
): { isSubscribed: boolean; channelName: string | null } {
  const authContext = useContext(AuthContext);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const options: UseRealtimeNotificationsOptions =
    optionsOrUser && 'id' in optionsOrUser
      ? { user: optionsOrUser }
      : (optionsOrUser ?? {});

  const effectiveUser = options.user !== undefined ? options.user : authContext?.user;
  const enabled = options.enabled ?? true;

  const onNotificationRef = useRef(options.onNotification);
  useEffect(() => {
    onNotificationRef.current = options.onNotification;
  }, [options.onNotification]);

  const userId = effectiveUser?.id;
  const channelName = userId ? `users.${userId}` : null;

  useEffect(() => {
    if (!enabled || !userId || !channelName) {
      return;
    }

    const echo = getEcho();
    if (!echo) {
      return;
    }

    const channel = echo.private(channelName);

    const handleIncomingNotification = (payload: RealtimeNotificationPayload) => {
      const item = normalizeRealtimePayload(payload);

      // Invalidate all notification queries (badge unread count, popover list, inbox page)
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });

      // Trigger optional callback
      onNotificationRef.current?.(item);

      // Display real-time toast
      const toastTitle = item.data.title || 'Notification';
      const toastDescription = item.data.message || undefined;

      toast(toastTitle, {
        description: toastDescription,
        action: {
          label: 'View',
          onClick: () => {
            if (item.id) {
              void notificationApi.markRead(item.id).catch(() => {});
            }
            const target = resolveNotificationTarget(item);
            const to: { pathname: string; search?: string; hash?: string } = {
              pathname: target.pathname,
            };
            if (target.search) {
              to.search = target.search;
            }
            if (target.hash) {
              to.hash = target.hash;
            }
            void navigate(to, { preventScrollReset: false });
          },
        },
      });
    };

    channel.listen('.notification.created', handleIncomingNotification);
    channel.notification(handleIncomingNotification);

    return () => {
      channel.stopListening('.notification.created', handleIncomingNotification);
      echo.leave(channelName);
    };
  }, [channelName, enabled, navigate, queryClient, userId]);

  return {
    isSubscribed: Boolean(enabled && userId && channelName && getEcho()),
    channelName,
  };
}
