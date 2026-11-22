import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, RefreshCw, X } from 'lucide-react';
import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  notificationApi,
  type NotificationItem,
} from '@/services/api/notificationApi';
import { AuthContext } from '@/features/auth/auth-context-state';
import type { ApiUser } from '@/services/api/contracts';
import {
  formatRelativeTime,
  getNotificationIcon,
  resolveNotificationTarget,
} from '@/features/notifications/notification-navigation';

interface NotificationBellProps {
  session?: { user: ApiUser; frontendUrl: string; logout: () => void } | undefined;
}

export function NotificationBell({ session }: NotificationBellProps = {}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authContext = useContext(AuthContext);
  const user = session?.user ?? authContext?.user;

  const unreadQuery = useQuery({
    queryKey: ['notifications', user?.id, 'unread-count'],
    queryFn: () => notificationApi.unreadCount(),
    enabled: user === undefined ? true : Boolean(user?.id),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const unreadCount = unreadQuery.data?.unread_count ?? 0;

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'bell-list', filter],
    queryFn: () =>
      notificationApi.list({
        per_page: 10,
        status: filter === 'unread' ? 'unread' : '',
      }),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: (id: string) => notificationApi.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.read_at) {
      markRead.mutate(item.id);
    }
    setOpen(false);
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
  };

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : 'Notifications'
          }
          className="relative size-9"
          size="icon"
          variant="ghost"
        >
          <Bell aria-hidden="true" className="size-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold leading-none text-primary-foreground shadow-xs"
            >
              {badgeText}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] p-0 shadow-lg"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Notifications</h2>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[0.6875rem]">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className="mr-1 size-3.5" />
            Mark all read
          </Button>
        </div>

        <div className="flex border-b bg-muted/30 px-3 py-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'rounded px-2.5 py-1 font-medium transition-colors',
              filter === 'all'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={cn(
              'rounded px-2.5 py-1 font-medium transition-colors',
              filter === 'unread'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        <div className="max-h-[22rem] divide-y divide-border/60 overflow-y-auto">
          {notificationsQuery.isPending && (
            <div className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            </div>
          )}

          {notificationsQuery.isError && (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Could not load notifications.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs"
                onClick={() => void notificationsQuery.refetch()}
              >
                <RefreshCw className="mr-1 size-3" />
                Retry
              </Button>
            </div>
          )}

          {notificationsQuery.data && (
            <>
              {notificationsQuery.data.data.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {filter === 'unread'
                      ? 'No unread notifications'
                      : 'No notifications yet'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {filter === 'unread'
                      ? 'You are all caught up.'
                      : 'When someone assigns you a task, mentions you, or invites you, you will see it here.'}
                  </p>
                </div>
              ) : (
                notificationsQuery.data.data.map((item) => {
                  const Icon = getNotificationIcon(item);
                  const isUnread = !item.read_at;

                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleNotificationClick(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNotificationClick(item);
                        }
                      }}
                      className={cn(
                        'group relative flex cursor-pointer items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                        isUnread && 'bg-primary/[0.04]'
                      )}
                    >
                      {isUnread && (
                        <span
                          className="absolute left-1 top-4 size-1.5 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p
                            className={cn(
                              'truncate text-xs font-medium',
                              isUnread
                                ? 'font-semibold text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {item.data.title ?? 'Notification'}
                          </p>
                          <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </div>
                        {item.data.message ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {item.data.message}
                          </p>
                        ) : item.data.actor_name ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            By {item.data.actor_name}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        {isUnread && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-foreground"
                            title="Mark as read"
                            aria-label="Mark as read"
                            onClick={(e) => {
                              e.stopPropagation();
                              markRead.mutate(item.id);
                            }}
                          >
                            <Check className="size-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          title="Dismiss notification"
                          aria-label="Dismiss notification"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification.mutate(item.id);
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        <div className="border-t bg-muted/20 p-2 text-center">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            <Link to="/notifications">View all in Follow-up inbox</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
