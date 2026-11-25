import { DateField } from '@/components/ui/date-field';
import { Checkbox } from '@/components/ui/checkbox';
import { ChoiceOption, ChoiceSelect } from '@/components/ui/choice-select';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/primitives';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasPermission } from '@/features/auth/permissions';
import { apiClient } from '@/services/api/apiClient';
import type { ApiPaginatedResponse, ApiSuccess } from '@/services/api/contracts';
import {
  notificationApi,
  type NotificationItem,
} from '@/services/api/notificationApi';
import {
  formatRelativeTime,
  getNotificationIcon,
} from '@/features/notifications/notification-navigation';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface ActivityItem {
  id: number;
  action: string;
  actor_name: string | null;
  description: string | null;
  created_at: string | null;
}

export function NotificationsRoute() {
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ['notifications', user?.id, page, status],
    queryFn: async () => (await apiClient.get<ApiPaginatedResponse<NotificationItem>>('/notifications', { params: { page, ...(status ? { status } : {}) } })).data,
  });
  const unread = useQuery({
    queryKey: ['notifications', user?.id, 'unread-count'],
    queryFn: async () => (await apiClient.get<ApiSuccess<{ unread_count: number }>>('/notifications/unread-count')).data.data,
  });
  const markRead = useMutation({
    mutationFn: async (id: string | null) => {
      if (id) {
        await notificationApi.markRead(id);
      } else {
        await notificationApi.markAllRead();
      }
    },
    onSuccess: async () => {
      if (status === 'unread') setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: (id: string) => notificationApi.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <section className="grid gap-4">
      <PageHeader>
        <h1 className="text-2xl font-semibold tracking-tight">Follow-up inbox</h1>
        <div className="w-52 max-w-full">
          {unread.isPending ? <LoadingState label="Loading unread count" layout="control" /> : (
            <Button className="w-full" variant="outline" disabled={markRead.isPending || unread.data?.unread_count === 0} onClick={() => markRead.mutate(null)}>
              Mark all as read{unread.data ? ` (${unread.data.unread_count} unread)` : ''}
            </Button>
          )}
        </div>
      </PageHeader>
      <div className="rounded-xl border bg-card p-4">
        <ChoiceSelect aria-label="Filter inbox by read status" value={status} onValueChange={(nextValue) => { setStatus(nextValue); setPage(1); }}>
          <ChoiceOption value="">All notifications</ChoiceOption><ChoiceOption value="unread">Unread</ChoiceOption><ChoiceOption value="read">Read</ChoiceOption>
        </ChoiceSelect>
      </div>
      {unread.isError && <ErrorState title="Unread count unavailable" description="You can still read individual notifications." onRetry={() => void unread.refetch()} />}
      {markRead.isError && <p role="alert">Could not update the inbox. Try again.</p>}
      {notifications.isPending && <LoadingState label="Loading notifications" />}
      {notifications.isError && <ErrorState title="Could not load notifications" description="Try loading your inbox again." onRetry={() => void notifications.refetch()} />}
      {notifications.data && (
        <>
          {notifications.data.data.length === 0 && <EmptyState title="No notifications on this page." />}
          <ul className="divide-y rounded-xl border bg-card empty:hidden">
            {notifications.data.data.map((item) => {
              const Icon = getNotificationIcon(item);
              const isUnread = !item.read_at;

              return (
                <li
                  key={item.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-4 p-4 transition-colors',
                    isUnread && 'bg-primary/[0.03]'
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground mt-0.5">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("font-medium text-sm", isUnread && "font-semibold text-foreground")}>
                          {item.data.title ?? 'Notification'}
                        </p>
                        {isUnread && (
                          <Badge variant="default" className="text-[0.625rem] px-1.5 py-0 h-4">
                            New
                          </Badge>
                        )}
                      </div>
                      {item.data.message && (
                        <p className="text-sm text-foreground/85 mt-0.5">
                          {item.data.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.data.actor_name ? `From ${item.data.actor_name} • ` : ''}
                        {formatRelativeTime(item.created_at)}
                        {item.created_at ? ` (${new Date(item.created_at).toLocaleString()})` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {item.data.appointment_uuid && hasPermission(user, 'appointments.view') && (
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/appointments?appointment=${encodeURIComponent(item.data.appointment_uuid)}#appointment-details`}>
                          View appointment
                        </Link>
                      </Button>
                    )}
                    {item.data.task_uuid && hasPermission(user, 'tasks.view') && (
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/tasks?task=${encodeURIComponent(item.data.task_uuid)}`}>
                          View task
                        </Link>
                      </Button>
                    )}
                    {item.data.project_uuid && hasPermission(user, 'projects.view') && (
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/projects/${encodeURIComponent(item.data.project_uuid)}`}>
                          View project
                        </Link>
                      </Button>
                    )}
                    {item.read_at ? (
                      <Badge variant="secondary">Read</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markRead.isPending}
                        onClick={() => markRead.mutate(item.id)}
                      >
                        Mark as read
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive size-8 p-0"
                      disabled={deleteNotification.isPending}
                      onClick={() => deleteNotification.mutate(item.id)}
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination currentPage={page} totalPages={notifications.data.meta.last_page} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

export function ActivityRoute() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [showSystem, setShowSystem] = useState(false);
  const [filters, setFilters] = useState({ action: '', from: '', to: '' });
  const canViewSystem = hasPermission(user, 'audit.view');
  const system = canViewSystem && showSystem;
  const activity = useQuery({
    queryKey: ['activity-logs', user?.id, system, page, filters],
    queryFn: async () => (await apiClient.get<ApiPaginatedResponse<ActivityItem>>(
      system ? '/activity-logs' : '/activity-logs/my',
      { params: {
        page,
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      } },
    )).data,
  });

  return (
    <section className="grid gap-4">
      <PageHeader><h1 className="text-2xl font-semibold tracking-tight">Activity</h1></PageHeader>
      {canViewSystem && (
        <label className="flex items-center gap-2">
          <Checkbox checked={system} onCheckedChange={(checked) => { setShowSystem(checked === true); setPage(1); }} />
          Show system audit log
        </label>
      )}
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        setFilters({ action: String(fields.get('action')).trim(), from: String(fields.get('from')), to: String(fields.get('to')) });
        setPage(1);
      }} onReset={() => { setFilters({ action: '', from: '', to: '' }); setPage(1); }}>
        <label className="grid gap-2 text-sm font-medium">Exact action<Input name="action" placeholder="e.g. project.created" maxLength={100} /></label>
        <div className="grid gap-2 text-sm font-medium"><label htmlFor="activity-from">From</label><DateField id="activity-from" aria-label="From" name="from" /></div>
        <div className="grid gap-2 text-sm font-medium"><label htmlFor="activity-through">Through</label><DateField id="activity-through" aria-label="Through" name="to" /></div>
        <Button type="submit" variant="outline">Apply filters</Button>
        <Button type="reset" variant="ghost">Clear</Button>
      </form>
      {activity.isPending && <LoadingState label="Loading activity" />}
      {activity.isError && <ErrorState title="Could not load activity" description="Try loading the audit timeline again." onRetry={() => void activity.refetch()} />}
      {activity.data && (
        <>
          {activity.data.data.length === 0 && <EmptyState title="No activity on this page." />}
          <ul className="divide-y rounded-xl border bg-card empty:hidden">
            {activity.data.data.map((item) => (
              <li key={item.id} className="p-4">
                <p className="font-medium">{item.description ?? item.action}</p>
                <p className="text-sm text-muted-foreground">{item.actor_name} {item.created_at && new Date(item.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
          <Pagination currentPage={page} totalPages={activity.data.meta.last_page} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
