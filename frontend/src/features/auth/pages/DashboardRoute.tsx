import { useState } from 'react';
import { BookingCreateDialog } from '@/features/appointments/AppointmentsRoute';
import { TaskCreateDialog } from '@/features/tasks/TasksRoute';
import { LoadingState } from '@/components/feedback/LoadingState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/primitives';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, ChevronRight, ClipboardCheck, Clock, FolderKanban, ListTodo, Plus, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback/ErrorState';
import { getSafeErrorMessage } from '@/features/auth/auth-validation';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasAnyPermission, hasPermission } from '@/features/auth/permissions';
import { useProjects } from '@/features/projects/project-queries';
import { statuses, type Task } from '@/features/tasks/TasksRoute';
import type { Appointment } from '@/features/appointments/AppointmentsRoute';
import { apiClient } from '@/services/api/apiClient';
import type { ApiPaginatedResponse, ApiUser } from '@/services/api/contracts';

export function DashboardRoute() {
  const { user } = useAuth();
  return user ? <Dashboard user={user} /> : null;
}

export function Dashboard({ user, frontendUrl = '' }: { user: ApiUser; frontendUrl?: string }) {
  const [editor, setEditor] = useState<'task' | 'booking' | null>(null);
  const canViewProjects = hasPermission(user, 'projects.view');
  const canViewTasks = hasPermission(user, 'tasks.view');
  const canViewAppointments = hasPermission(user, 'appointments.view');
  const canAddTask = canViewTasks && canViewProjects && hasPermission(user, 'tasks.create');
  const canAddBooking = canViewAppointments && hasPermission(user, 'appointments.create');

  const now = new Date();
  const timeZone = user.timezone || undefined;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone, dateStyle: 'short' }).format(now);
  const projects = useProjects({ status: 'active', per_page: 1 }, canViewProjects);
  const tasks = useQuery({
    queryKey: ['tasks', 'dashboard', user.id],
    enabled: canViewTasks,
    queryFn: async ({ signal }) => {
      const assignedTasks: Task[] = [];
      let page = 1;
      let lastPage: number;
      do {
        const { data } = await apiClient.get<ApiPaginatedResponse<Task>>('/tasks', {
          params: { assignee: user.id, page, per_page: 100, sort_by: 'due_date', sort_direction: 'asc' },
          signal,
        });
        assignedTasks.push(...data.data);
        lastPage = data.meta.last_page;
        page++;
      } while (page <= lastPage);
      return assignedTasks;
    },
  });
  const appointments = useQuery({
    queryKey: ['appointments', 'dashboard', user.id],
    enabled: canViewAppointments,
    queryFn: async ({ signal }) => {
      const start = new Date();
      const from = start.toISOString().replace(/\.\d{3}Z$/, 'Z');
      const upcoming = await Promise.all(['scheduled', 'confirmed'].map(async (status) => {
        let page = 1;
        let lastPage: number;
        do {
          const { data } = await apiClient.get<ApiPaginatedResponse<Appointment>>('/appointments', {
            params: { from, status, page, per_page: 25 },
            signal,
          });
          const next = data.data.find((item) => new Date(item.start_time) >= start);
          if (next) return next;
          lastPage = data.meta.last_page;
          page++;
        } while (page <= lastPage);
        return null;
      }));
      return upcoming.filter((item): item is Appointment => item !== null)
        .sort((first, second) => Date.parse(first.start_time) - Date.parse(second.start_time));
    },
  });

  const openTasks = tasks.isSuccess ? tasks.data.filter((task) => task.status !== 'done' && task.status !== 'cancelled') : undefined;
  const isOverdue = (task: Task) => Boolean(task.due_date && task.due_date.slice(0, 10) < today);
  const actionTasks = openTasks?.filter((task) => task.status !== 'backlog' || (task.due_date && task.due_date.slice(0, 10) <= today))
    .sort((first, second) => (first.due_date ?? '9999').localeCompare(second.due_date ?? '9999')).slice(0, 6);
  const nextAppointment = appointments.isSuccess
    ? appointments.data.find((item) => new Date(item.start_time) >= now)
    : undefined;
  const metrics = [
    { visible: canViewProjects, pending: projects.isPending, title: 'Active projects', description: 'Projects you can access', value: projects.isSuccess ? projects.data.meta.total : undefined, icon: FolderKanban, color: 'text-primary' },
    { visible: canViewTasks, pending: tasks.isPending, title: 'Due today', description: 'Open tasks assigned to you', value: openTasks?.filter((task) => task.due_date?.slice(0, 10) === today).length, icon: Clock, color: 'text-info' },
    { visible: canViewTasks, pending: tasks.isPending, title: 'Overdue tasks', description: 'Assigned tasks past their due date', value: openTasks?.filter(isOverdue).length, icon: TriangleAlert, color: 'text-warning' },
    { visible: canViewTasks, pending: tasks.isPending, title: 'Pending reviews', description: 'Your assigned tasks in review', value: openTasks?.filter((task) => task.status === 'in_review').length, icon: ClipboardCheck, color: 'text-success' },
  ].filter((metric) => metric.visible);

  return (
    <div className="space-y-7">
      <PageHeader>
        <div className="space-y-1">
          <time className="block text-xs font-semibold tracking-wide text-primary uppercase" dateTime={today}>
            {new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone }).format(now)}
          </time>
          <h1 className="text-2xl font-semibold tracking-tight">Today’s Workspace Agenda</h1>
        </div>
        {(canAddTask || canAddBooking) && (
          <div className="flex flex-wrap gap-2">
            {canAddTask && <Button className="h-8 text-xs" size="sm" variant="outline" onClick={() => setEditor('task')}><Plus aria-hidden="true" className="size-3.5" /> Add task</Button>}
            {canAddBooking && <Button className="h-8 text-xs" size="sm" onClick={() => setEditor('booking')}><Plus aria-hidden="true" className="size-3.5" /> Add booking</Button>}
          </div>
        )}
      </PageHeader>
      {editor === 'task' && canAddTask && <TaskCreateDialog user={user} onClose={() => setEditor(null)} />}
      {editor === 'booking' && canAddBooking && <BookingCreateDialog user={user} onClose={() => setEditor(null)} />}

      {metrics.length > 0 && (
        <section aria-label="Workspace overview" className="grid gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ title, description, value, pending, icon: Icon, color }) => (
            <div className="workspace-surface min-w-0 p-4" key={title}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm text-muted-foreground">{title}</h2>
                <Icon aria-hidden="true" className={`size-4 shrink-0 ${color}`} />
              </div>
              <div className="mt-2 flex h-8 items-center">
                {pending ? <LoadingState label={`Loading ${title.toLowerCase()}`} layout="inline" className="max-w-10" /> : <p className="text-2xl font-semibold tracking-tight tabular-nums">{value ?? '—'}</p>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
          ))}
        </section>
      )}
      {canViewProjects && projects.isError && <ErrorState description={getSafeErrorMessage(projects.error)} title="Active project count unavailable" onRetry={() => void projects.refetch()} />}

      {canViewAppointments && (
        <section aria-labelledby="next-appointment" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="next-appointment" className="text-xs font-semibold tracking-wide uppercase">Next appointment</h2>
            <Link className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" reloadDocument={Boolean(frontendUrl)} to="/appointments">All bookings <ArrowRight aria-hidden="true" className="size-3" /></Link>
          </div>
          {appointments.isError ? <ErrorState description={getSafeErrorMessage(appointments.error)} title="Could not load appointments" onRetry={() => void appointments.refetch()} /> : appointments.isPending ? (
            <LoadingState label="Loading appointments" rows={1} rowClassName="min-h-27" />
          ) : nextAppointment ? (
            <div className="workspace-surface flex min-h-27 flex-wrap items-center gap-4 p-4">
              <span className="rounded-lg bg-muted p-2.5 text-primary"><CalendarDays aria-hidden="true" className="size-5" /></span>
              <div className="min-w-0 flex-1 break-words">
                <p className="font-medium">{nextAppointment.title}</p>
                <p className="text-sm text-muted-foreground">
                  <time dateTime={nextAppointment.start_time}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(nextAppointment.start_time))}</time>
                  {' · Hosted by '}{nextAppointment.organizer.name}
                </p>
              </div>
              <Button asChild size="sm" variant="outline"><Link reloadDocument={Boolean(frontendUrl)} to={`/appointments?appointment=${nextAppointment.uuid}#appointment-details`}>View appointment</Link></Button>
            </div>
          ) : <EmptyState icon={<Clock className="size-5" />} title="No upcoming appointments scheduled." />}
        </section>
      )}

      {canViewTasks && (
        <section aria-labelledby="tasks-needing-action" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="tasks-needing-action" className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
              Tasks needing action
              {actionTasks && <span className="font-normal text-muted-foreground">({actionTasks.length})</span>}
            </h2>
            <Link className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" reloadDocument={Boolean(frontendUrl)} to="/my-work">My work <ArrowRight aria-hidden="true" className="size-3" /></Link>
          </div>
          {tasks.isError ? <ErrorState description={getSafeErrorMessage(tasks.error)} title="Could not load assigned tasks" onRetry={() => void tasks.refetch()} /> : tasks.isPending ? (
            <LoadingState label="Loading assigned tasks" rows={3} />
          ) : actionTasks?.length ? (
            <ul className="workspace-surface divide-y">
              {actionTasks.map((task) => {
                const overdue = isOverdue(task);
                const dueDate = task.due_date?.slice(0, 10);
                return (
                  <li key={task.uuid}>
                    <Link
                      aria-labelledby={`task-title-${task.uuid}`}
                      className="flex min-h-[4.35rem] items-center gap-3 rounded-lg px-3.5 py-2.5 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
                      reloadDocument={Boolean(frontendUrl)}
                      to={`/my-work?task=${task.uuid}#task-details`}
                    >
                      <ListTodo aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <Badge className={overdue ? 'border-destructive/25 bg-destructive/10 text-destructive' : undefined} variant={overdue ? 'outline' : task.status === 'in_progress' ? 'info' : task.status === 'in_review' ? 'warning' : 'secondary'}>
                            {overdue ? 'Overdue' : statuses[task.status]}
                          </Badge>
                          <span className="break-words">{task.project.name}</span>
                          {dueDate && <time className="whitespace-nowrap" dateTime={dueDate}>Due {dueDate}</time>}
                        </div>
                        <p className="break-words text-sm font-medium leading-tight" id={`task-title-${task.uuid}`}>{task.title}</p>
                      </div>
                      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState title="No assigned tasks need action." />}
        </section>
      )}

      <nav aria-label="Account shortcuts" className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-sm text-muted-foreground">
        <Link className="hover:underline" reloadDocument={Boolean(frontendUrl)} to="/profile">Manage profile</Link>
        {hasAnyPermission(user, ['users.view_directory', 'users.view']) && <Link className="hover:underline" reloadDocument={Boolean(frontendUrl)} to="/users">People &amp; access</Link>}
        <Link className="hover:underline" reloadDocument={Boolean(frontendUrl)} to={`${frontendUrl}/change-password`}>Password &amp; security</Link>
      </nav>
    </div>
  );
}
