import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasPermission } from '@/features/auth/permissions';
import { apiClient } from '@/services/api/apiClient';
import type { ApiPaginatedResponse, ApiSuccess } from '@/services/api/contracts';

interface NotificationItem {
  id: string;
  data: { title?: string; event?: string };
  read_at: string | null;
  created_at: string | null;
}

interface ActivityItem {
  id: number;
  action: string;
  actor_name: string | null;
  description: string | null;
  created_at: string | null;
}

export function NotificationsRoute() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ['notifications', page],
    queryFn: async () => (await apiClient.get<ApiPaginatedResponse<NotificationItem>>('/notifications', { params: { page } })).data,
  });
  const unread = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => (await apiClient.get<ApiSuccess<{ unread_count: number }>>('/notifications/unread-count')).data.data,
  });
  const markRead = useMutation({
    mutationFn: (id: string | null) => apiClient.patch(id ? `/notifications/${id}/read` : '/notifications/read-all'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Follow-up inbox</h1>
        <Button variant="outline" disabled={markRead.isPending || unread.data?.unread_count === 0} onClick={() => markRead.mutate(null)}>
          Mark all as read{unread.data ? ` (${unread.data.unread_count} unread)` : ''}
        </Button>
      </div>
      {markRead.isError && <p role="alert">Could not update the inbox. Try again.</p>}
      {notifications.isPending && <LoadingState label="Loading notifications" />}
      {notifications.isError && <ErrorState title="Could not load notifications" description="Try loading your inbox again." onRetry={() => void notifications.refetch()} />}
      {notifications.data && (
        <>
          {notifications.data.data.length === 0 && <p>No notifications on this page.</p>}
          <ul className="grid gap-2">
            {notifications.data.data.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{item.data.title ?? 'Notification'}</p>
                  <p className="text-sm text-muted-foreground">{item.data.event?.replaceAll('_', ' ')} {item.created_at && new Date(item.created_at).toLocaleString()}</p>
                </div>
                {item.read_at ? <span>Read</span> : (
                  <Button size="sm" variant="outline" disabled={markRead.isPending} onClick={() => markRead.mutate(item.id)}>Mark as read</Button>
                )}
              </li>
            ))}
          </ul>
          <FollowUpPagination page={page} lastPage={notifications.data.meta.last_page} setPage={setPage} />
        </>
      )}
    </section>
  );
}

export function ActivityRoute() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [showSystem, setShowSystem] = useState(false);
  const canViewSystem = hasPermission(user, 'audit.view');
  const system = canViewSystem && showSystem;
  const activity = useQuery({
    queryKey: ['activity-logs', user?.id, system, page],
    queryFn: async () => (await apiClient.get<ApiPaginatedResponse<ActivityItem>>(
      system ? '/activity-logs' : '/activity-logs/my',
      { params: { page } },
    )).data,
  });

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Activity</h1>
      {canViewSystem && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={system} onChange={(event) => { setShowSystem(event.target.checked); setPage(1); }} />
          Show system audit log
        </label>
      )}
      {activity.isPending && <LoadingState label="Loading activity" />}
      {activity.isError && <ErrorState title="Could not load activity" description="Try loading the audit timeline again." onRetry={() => void activity.refetch()} />}
      {activity.data && (
        <>
          {activity.data.data.length === 0 && <p>No activity on this page.</p>}
          <ul className="grid gap-2">
            {activity.data.data.map((item) => (
              <li key={item.id} className="rounded-lg border p-4">
                <p className="font-medium">{item.description ?? item.action}</p>
                <p className="text-sm text-muted-foreground">{item.actor_name} {item.created_at && new Date(item.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
          <FollowUpPagination page={page} lastPage={activity.data.meta.last_page} setPage={setPage} />
        </>
      )}
    </section>
  );
}

function FollowUpPagination({ page, lastPage, setPage }: { page: number; lastPage: number; setPage: (page: number) => void }) {
  return (
    <nav aria-label="Pagination" className="flex items-center gap-3">
      <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
      <span>Page {page} of {lastPage}</span>
      <Button variant="outline" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</Button>
    </nav>
  );
}
