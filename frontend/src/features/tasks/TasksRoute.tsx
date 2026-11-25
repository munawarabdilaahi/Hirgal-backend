import { SearchInput } from '@/components/ui/search-input';
import { DateField } from '@/components/ui/date-field';
import { ActionConfirmation } from '@/components/ui/action-confirmation';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/badge';
import { ChoiceOption, ChoiceSelect } from '@/components/ui/choice-select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/primitives';
import { useDebouncedValue } from '@/features/users/use-debounced-value';
import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, CircleAlert, Columns3, Eye, EyeOff, List, Plus, RotateCcw, UserCheck, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserIdentity } from '@/components/ui/user-identity';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasPermission } from '@/features/auth/permissions';
import { getSafeErrorMessage } from '@/features/auth/auth-validation';
import { apiClient } from '@/services/api/apiClient';
import { projectApi } from '@/services/api/projectApi';
import type { ApiDirectoryUser, ApiSuccess, ApiUser } from '@/services/api/contracts';
import { TaskAgenda, TaskSummary, type TaskListResponse, type TaskSchedule } from './TaskAgenda';
import { TaskBoard } from './TaskBoard';
import { NewTaskDialog } from './NewTaskDialog';
import { TaskAssignmentsDialog } from './TaskAssignmentsDialog';
import { FormattedTaskDescription, TaskDescriptionEditor } from './TaskDescriptionEditor';

export const statuses = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
};

type TaskStatus = keyof typeof statuses;

const taskRowColumns = 'grid-cols-[minmax(0,1fr)_auto] @min-[48rem]:grid-cols-[minmax(12rem,1fr)_minmax(9rem,0.65fr)_7rem_5.5rem_7rem_1rem]';

export interface Task {
  uuid: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  capabilities?: { update: boolean; delete: boolean; assign: boolean; create_subtask: boolean };
  due_date?: string | null;
  can_update?: boolean;
  description_html?: string | null;
  context?: 'project' | 'department' | 'other';
  department?: string | null;
  start_date?: string | null;
  remind_on?: string | null;
  tags?: string[];
  followers?: ApiDirectoryUser[];
  project: { uuid: string; name: string } | null;
  parent?: { uuid: string | null; title: string | null };
  assignees: ApiDirectoryUser[];
  creator?: ApiDirectoryUser | null;
  created_at?: string | null;
  completed_at?: string | null;
}

export function TasksRoute({ assignedToMe = false }: { assignedToMe?: boolean }) {
  const { user } = useAuth();
  return <TasksView assignedToMe={assignedToMe} user={user} />;
}

export function TaskCreateDialog({ user, onClose }: { user: ApiUser; onClose: () => void }) {
  return <TasksView user={user} closeCreateDialog={onClose} />;
}

function TasksView({ user, assignedToMe = false, closeCreateDialog }: { user: ApiUser | null; assignedToMe?: boolean; closeCreateDialog?: () => void }) {
  const queryClient = useQueryClient();
  const [referenceDate] = useState(() => new Date());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const searchTerm = useDebouncedValue(taskSearch.trim());
  const [priority, setPriority] = useState('');
  const [sort, setSort] = useState(assignedToMe ? 'due_date:asc' : 'created_at:desc');
  const [sortBy, sortDirection] = sort.split(':');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [searchParams] = useSearchParams();
  const canViewTasks = hasPermission(user, 'tasks.view');
  const selectedTask = closeCreateDialog ? null : searchParams.get('task');
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const pageTitle = useRef<HTMLHeadingElement>(null);
  const [board, setBoard] = useState(false);
  const [projectFilter, setProjectFilter] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState<Partial<Record<keyof TaskSchedule, boolean>>>({});
  const assignee = assignedToMe || onlyMine ? user?.id : undefined;
  const listParams = {
    assignee, status: status || undefined, sort_by: sortBy, sort_direction: sortDirection,
    ...(searchTerm ? { search: searchTerm } : {}),
    ...(priority ? { priority } : {}),
    ...(projectFilter ? { project: projectFilter } : {}),
  };
  const tasks = useQuery({
    queryKey: ['tasks', 'list', user?.id, listParams, page, assignedToMe, board, canViewTasks],
    queryFn: async () => (await apiClient.get<TaskListResponse>('/tasks', {
      params: { ...listParams, page, ...(!assignedToMe && canViewTasks ? { with_schedule: 1 } : {}), ...(board ? { with_move_permissions: 1 } : {}) },
    })).data,
    enabled: Boolean(user) && !closeCreateDialog && taskSearch.trim() === searchTerm && (!assignedToMe || (canViewTasks && assignee !== undefined)),
  });
  const filterProjects = useQuery({
    queryKey: ['projects', 'task-filters', user?.id],
    queryFn: async () => {
      const first = await projectApi.list({ page: 1, per_page: 100 });
      const all = [...first.data];
      for (let page = 2; page <= first.meta.last_page; page++) {
        all.push(...(await projectApi.list({ page, per_page: 100 })).data);
      }
      return all;
    },
    enabled: canViewTasks && !closeCreateDialog && !assignedToMe && hasPermission(user, 'projects.view'),
  });
  const detail = useQuery({
    queryKey: ['tasks', selectedTask],
    queryFn: async () => (await apiClient.get<ApiSuccess<Task>>(`/tasks/${selectedTask}`)).data.data,
    enabled: selectedTask !== null,
  });
  const task = detail.data;
  const canAssign = task?.capabilities?.assign === true;
  const update = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: 'post' | 'put' | 'delete'; body?: unknown }) =>
      apiClient.request({ url: path, method, data: body }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });

  const { hash, pathname, search } = useLocation();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<"create" | "edit" | "subtask" | "assign" | null>(() => closeCreateDialog || hash === "#new-task" ? "create" : null);
  const closeEditor = () => {
    setEditor(null);
    if (closeCreateDialog) { closeCreateDialog(); return; }
    if (hash === '#new-task') void navigate({ pathname, search }, { replace: true });
  };
  const schedule = tasks.data?.meta.schedule;

  function clearFilters() {
    setTaskSearch('');
    setStatus('');
    setPriority('');
    setProjectFilter('');
    setOnlyMine(false);
    setSort('created_at:desc');
    setPage(1);
  }

  function openTask(uuid: string, trigger: HTMLButtonElement) {
    detailTrigger.current = trigger;
    update.reset();
    const params = new URLSearchParams(searchParams);
    params.set('task', uuid);
    void navigate({ pathname, search: params.toString() }, { replace: true, preventScrollReset: true });
  }

  function closeTask() {
    setEditor(null);
    setDeleteOpen(false);
    update.reset();
    const params = new URLSearchParams(searchParams);
    params.delete('task');
    void navigate({ pathname, search: params.toString(), hash: hash === '#task-details' ? '' : hash }, {
      replace: true,
      preventScrollReset: true,
    });
  }

  function saveTask(event: FormEvent<HTMLFormElement>, task?: Task, parent?: Task) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const dueDate = fields.get('due_date');
    update.mutate({
      path: task ? `/tasks/${task.uuid}` : `/projects/${parent?.project?.uuid}/tasks`,
      method: task ? 'put' : 'post',
      body: {
        title: fields.get('title'),
        description: fields.get('description') || null,
        ...(task?.description_html !== undefined ? { description_is_rich_text: true } : {}),
        status: fields.get('status') ?? 'todo',
        ...(fields.has('priority') ? { priority: fields.get('priority') } : {}),
        ...(dueDate !== null && dueDate !== (task?.due_date?.slice(0, 10) ?? '')
          ? { due_date: dueDate || null }
          : {}),
        ...(parent ? { parent: parent.uuid } : {}),
      },
    }, {
      onSuccess: () => {
        form.reset();
        closeEditor();
        toast.success(task ? 'Task updated.' : parent ? 'Subtask created.' : 'Task created.');
      },
    });
  }

  function updateTaskStatus(newStatus: TaskStatus) {
    if (!task) return;
    update.mutate({
      path: `/tasks/${task.uuid}`,
      method: 'put',
      body: { status: newStatus },
    }, {
      onSuccess: () => {
        toast.success(newStatus === 'done' ? 'Task marked as complete!' : `Task status updated to ${statuses[newStatus]}.`);
      },
    });
  }

  function toggleWatchTask(currentTask: Task, isWatching: boolean) {
    if (!user) return;
    const currentFollowerIds = (currentTask.followers ?? []).map((f) => f.id);
    const newFollowerIds = isWatching
      ? currentFollowerIds.filter((id) => id !== user.id)
      : [...new Set([...currentFollowerIds, user.id])];

    update.mutate({
      path: `/tasks/${currentTask.uuid}`,
      method: 'put',
      body: { followers: newFollowerIds },
    }, {
      onSuccess: () => {
        toast.success(isWatching ? 'Unwatched task.' : 'Now watching task.');
      },
    });
  }

  const createTaskForm = editor === 'create' && !assignedToMe && user && (
    <NewTaskDialog actorId={user.id} canViewProjects={hasPermission(user, 'projects.view')} canAssign={hasPermission(user, 'tasks.assign')}
      initialProjectUuid={projectFilter || undefined}
      statuses={statuses} priorities={priorities} onClose={closeEditor} />
  );
  if (closeCreateDialog) return createTaskForm;

  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:gap-5">
      <PageHeader className="items-center">
        <div className="flex flex-wrap items-center gap-3">
          {!assignedToMe && user && <UserIdentity name={user.name} imageUrl={user.avatar_url} className="[&>div:last-child]:sr-only" />}
          <div className="space-y-1">
            <h1 ref={pageTitle} tabIndex={-1} className="text-2xl font-semibold tracking-tight">{assignedToMe ? 'My work' : 'Tasks'}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{assignedToMe ? 'Review and update tasks assigned to you.' :
              new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: user?.timezone ?? 'UTC' }).format(referenceDate)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!assignedToMe && canViewTasks && (
            <Button disabled={!schedule?.overdue} variant="outline" onClick={() => {
              setBoard(false);
              setAgendaOpen((current) => ({ ...current, overdue: true }));
              requestAnimationFrame(() => document.getElementById('task-overdue')?.focus());
            }}>
              <CircleAlert aria-hidden="true" className="size-4" />Review overdue
            </Button>
          )}
          {canViewTasks && <Button variant="outline" onClick={() => setBoard(!board)}>
            {board ? <List aria-hidden="true" className="size-4" /> : <Columns3 aria-hidden="true" className="size-4" />}
            {board ? 'List view' : 'Board view'}
          </Button>}
          {!assignedToMe && user && (
            <Button onClick={() => { update.reset(); setEditor('create'); }}><Plus aria-hidden="true" className="size-4" />Add task</Button>
          )}
        </div>
      </PageHeader>
      {createTaskForm}
      {!assignedToMe && canViewTasks && <TaskSummary pending={tasks.isPending} schedule={schedule} />}
      {!assignedToMe && canViewTasks ? (
        <div className="@container rounded-xl border bg-card p-3 shadow-card sm:p-4">
          <div className="grid items-end gap-3 @min-[28rem]:grid-cols-2 @min-[61rem]:grid-cols-[minmax(12rem,1fr)_repeat(4,minmax(0,9rem))_auto]">
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground @min-[28rem]:col-span-2 @min-[61rem]:col-span-1">
              Search
              <SearchInput aria-label="Search tasks" placeholder="Search tasks, projects, assignees…" maxLength={100} value={taskSearch}
                onChange={(event) => { setTaskSearch(event.target.value); setPage(1); }} />
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
              Status
              <ChoiceSelect aria-label="Status" value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
                <ChoiceOption value="">All statuses</ChoiceOption>
                {Object.entries(statuses).map(([value, label]) => <ChoiceOption key={value} value={value}>{label}</ChoiceOption>)}
              </ChoiceSelect>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
              Project
              <ChoiceSelect aria-label="Filter by project" disabled={!filterProjects.data?.length} value={projectFilter}
                onValueChange={(value) => { setProjectFilter(value); setPage(1); }}>
                <ChoiceOption value="">All projects</ChoiceOption>
                {filterProjects.data?.map((item) => <ChoiceOption key={item.uuid} value={item.uuid}>{item.name}</ChoiceOption>)}
              </ChoiceSelect>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
              Priority
              <ChoiceSelect aria-label="Filter by priority" value={priority} onValueChange={(value) => { setPriority(value); setPage(1); }}>
                <ChoiceOption value="">All priorities</ChoiceOption>
                {priorities.map((value) => <ChoiceOption className="capitalize" key={value} value={value}>{value}</ChoiceOption>)}
              </ChoiceSelect>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
              Assignment
              <ChoiceSelect aria-label="Filter by assignment" value={onlyMine ? 'mine' : 'all'} onValueChange={(value) => { setOnlyMine(value === 'mine'); setPage(1); }}>
                <ChoiceOption value="all">All work</ChoiceOption>
                <ChoiceOption value="mine">Assigned to me</ChoiceOption>
              </ChoiceSelect>
            </label>
            <Button variant="outline" disabled={!taskSearch && !status && !priority && !projectFilter && !onlyMine && sort === 'created_at:desc'} onClick={clearFilters}>
              <X aria-hidden="true" className="size-4" />Clear
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{tasks.data ? `${tasks.data.meta.total} matching tasks` : ''}</span>
            <ChoiceSelect aria-label="Sort tasks" className="h-8 w-36" value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}>
              <ChoiceOption value="created_at:desc">Newest first</ChoiceOption>
              <ChoiceOption value="due_date:asc">Due date</ChoiceOption>
              <ChoiceOption value="title:asc">Title A–Z</ChoiceOption>
            </ChoiceSelect>
          </div>
          {filterProjects.isError && <Button size="sm" variant="link" onClick={() => void filterProjects.refetch()}>Retry loading project filters</Button>}
        </div>
      ) : (
      <div className="@container rounded-xl border bg-card p-3 shadow-card sm:p-4">
        <div className="grid gap-2.5 @min-[17rem]:grid-cols-2 @min-[43rem]:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,10rem))]">
          <div className="relative min-w-0 @min-[17rem]:col-span-2 @min-[43rem]:col-span-1">
            <SearchInput aria-label="Search tasks" placeholder="Search tasks" maxLength={100} value={taskSearch} onChange={(event) => { setTaskSearch(event.target.value); setPage(1); }} />
          </div>
          <label className="sr-only" htmlFor="task-status-filter">Status</label>
          <ChoiceSelect id="task-status-filter" value={status} onValueChange={(nextValue) => { setStatus(nextValue); setPage(1); }}>
            <ChoiceOption value="">All statuses</ChoiceOption>
            {Object.entries(statuses).map(([value, label]) => <ChoiceOption key={value} value={value}>{label}</ChoiceOption>)}
          </ChoiceSelect>
          <ChoiceSelect aria-label="Filter by priority" value={priority} onValueChange={(nextValue) => { setPriority(nextValue); setPage(1); }}>
            <ChoiceOption value="">All priorities</ChoiceOption>
            {priorities.map((value) => <ChoiceOption className="capitalize" key={value} value={value}>{value}</ChoiceOption>)}
          </ChoiceSelect>
          <ChoiceSelect aria-label="Sort tasks" className="@min-[17rem]:col-span-2 @min-[43rem]:col-span-1" value={sort} onValueChange={(nextValue) => { setSort(nextValue); setPage(1); }}>
            <ChoiceOption value="created_at:desc">Newest first</ChoiceOption>
            <ChoiceOption value="due_date:asc">Due date</ChoiceOption>
            <ChoiceOption value="title:asc">Title A–Z</ChoiceOption>
          </ChoiceSelect>
        </div>
      </div>
      )}
      {tasks.isPending && <LoadingState label="Loading tasks" layout={board ? "board" : "list"} />}
      {tasks.isError && <ErrorState title="Could not load tasks" description={getSafeErrorMessage(tasks.error)} onRetry={() => void tasks.refetch()} />}
      {!assignedToMe && canViewTasks && !board && tasks.data ? (
        <TaskAgenda actorId={user?.id} key={JSON.stringify(listParams)} params={listParams} schedule={schedule} open={agendaOpen}
          onToggle={(group) => setAgendaOpen((current) => ({ ...current, [group]: !(current[group] ?? group === 'today') }))}
          onOpenTask={openTask} statusLabels={statuses} />
      ) : tasks.data && (
        <>
          {tasks.data.data.length === 0 && <EmptyState title={assignedToMe ? 'No assigned tasks match this view.' : 'No tasks match this view.'} />}
          {board ? <TaskBoard tasks={tasks.data.data} statuses={statuses} onOpenTask={openTask} /> :
            tasks.data.data.length > 0 && <div className="@container overflow-hidden rounded-xl border bg-card shadow-card">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4">
            <h2 className="text-sm font-semibold">{canViewTasks ? 'Task list' : 'Private tasks'}</h2>
              <p className="text-xs tabular-nums text-muted-foreground">
                {tasks.data.meta.total ?? tasks.data.data.length} {(tasks.data.meta.total ?? tasks.data.data.length) === 1 ? 'task' : 'tasks'}
              </p>
            </div>
            <div aria-hidden="true" className={`hidden gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground @min-[48rem]:grid ${taskRowColumns}`}>
              <span>Task</span><span>Project</span><span>Status</span><span>Priority</span><span>Due date</span>
            </div>
            <ul aria-label="Task list" className="divide-y">
            {tasks.data.data.map((task) => (
              <li key={task.uuid}>
                <Button className={`grid h-auto min-h-16 w-full gap-x-3 gap-y-2 rounded-none whitespace-normal px-3 py-2.5 text-left focus-visible:ring-inset sm:px-4 ${taskRowColumns}`}
                  aria-haspopup="dialog" aria-label={task.title} aria-describedby={`task-project-${task.uuid} task-meta-${task.uuid}`}
                  variant="ghost" onClick={(event) => openTask(task.uuid, event.currentTarget)}>
                  <span className="font-semibold wrap-anywhere">{task.title}</span>
                  <ChevronRight aria-hidden="true" className="row-span-3 size-4 shrink-0 text-muted-foreground @min-[48rem]:order-last @min-[48rem]:row-span-1" />
                  <span id={`task-project-${task.uuid}`} className="text-xs font-normal text-muted-foreground wrap-anywhere @min-[48rem]:text-sm">{task.project?.name ?? 'Personal task'}</span>
                  <span id={`task-meta-${task.uuid}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 @min-[48rem]:contents">
                    <Badge variant="secondary" className="w-fit">{statuses[task.status]}</Badge>
                    <span className="text-xs font-medium capitalize text-muted-foreground"><span className="sr-only">Priority: </span>{task.priority}</span>
                    <span className="text-xs font-normal tabular-nums text-muted-foreground">
                      {task.due_date ? <><span className="@min-[48rem]:sr-only">Due </span><time dateTime={task.due_date}>{task.due_date.slice(0, 10)}</time></> : <span className="hidden @min-[48rem]:inline">No due date</span>}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
            </ul>
          </div>}
          {tasks.data.meta.last_page > 1 && <Pagination currentPage={page} totalPages={tasks.data.meta.last_page} onPageChange={setPage} />}
        </>
      )}
      <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => { if (!open) closeTask(); }}>
        <DialogContent
          id="task-details"
          className="max-w-2xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const trigger = detailTrigger.current;
            (trigger?.isConnected ? trigger : pageTitle.current)?.focus();
            detailTrigger.current = null;
          }}
        >
          <DialogHeader className="border-b px-5 py-4 pr-12 sm:px-6 sm:pr-12">
            <DialogTitle className="text-section-title wrap-anywhere">{task?.title ?? 'Task details'}</DialogTitle>
            <DialogDescription>{task ? task.project?.name ?? 'Personal task' : 'View task information and available actions.'}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            {detail.isPending && <LoadingState label="Loading task details" layout="list" rows={2} />}
            {detail.isError && <ErrorState title="Could not load task" description={getSafeErrorMessage(detail.error)} onRetry={() => void detail.refetch()} />}
            {task && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4 empty:hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    {task.capabilities?.update && (
                      task.status === 'done' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={update.isPending}
                          onClick={() => updateTaskStatus('todo')}
                        >
                          <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
                          Reopen task
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                          disabled={update.isPending}
                          onClick={() => updateTaskStatus('done')}
                        >
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          Mark as Complete
                        </Button>
                      )
                    )}
                    {task.capabilities?.update && (
                      <Button size="sm" variant="outline" onClick={() => { update.reset(); setEditor('edit'); }}>
                        Edit task
                      </Button>
                    )}
                    {canAssign && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { update.reset(); setEditor('assign'); }}>
                        <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                        Assignees & Watchers
                      </Button>
                    )}
                    {task.capabilities?.create_subtask && (
                      <Button size="sm" variant="outline" onClick={() => { update.reset(); setEditor('subtask'); }}>
                        Add subtask
                      </Button>
                    )}
                  </div>
                  {user && task.project && (
                    <div>
                      {(() => {
                        const isWatching = (task.followers ?? []).some((f) => f.id === user.id);
                        return (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                            disabled={update.isPending}
                            onClick={() => toggleWatchTask(task, isWatching)}
                          >
                            {isWatching ? (
                              <>
                                <EyeOff className="size-4 text-amber-500" aria-hidden="true" />
                                <span>Unwatch</span>
                              </>
                            ) : (
                              <>
                                <Eye className="size-4" aria-hidden="true" />
                                <span>Watch task</span>
                              </>
                            )}
                          </Button>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border bg-card p-4 text-sm">
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">Status</dt>
                    <dd>
                      {task.capabilities?.update ? (
                        <ChoiceSelect
                          aria-label="Update task status"
                          className="h-8 text-xs font-medium"
                          value={task.status}
                          onValueChange={(nextStatus) => updateTaskStatus(nextStatus as TaskStatus)}
                          disabled={update.isPending}
                        >
                          {Object.entries(statuses).map(([value, label]) => (
                            <ChoiceOption key={value} value={value}>
                              {label}
                            </ChoiceOption>
                          ))}
                        </ChoiceSelect>
                      ) : (
                        <Badge variant="secondary">{statuses[task.status]}</Badge>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">Priority</dt>
                    <dd className="capitalize">{task.priority}</dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">Due date</dt>
                    <dd>{task.due_date ? <time dateTime={task.due_date}>{task.due_date.slice(0, 10)}</time> : 'No due date'}</dd>
                  </div>
                  {task.start_date && (
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">Start date</dt>
                      <dd>{task.start_date}</dd>
                    </div>
                  )}
                  {task.remind_on && (
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">Reminder date</dt>
                      <dd>{task.remind_on}</dd>
                    </div>
                  )}
                  {task.context && (
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">Context</dt>
                      <dd className="capitalize">{task.context}{task.department ? ` · ${task.department}` : ''}</dd>
                    </div>
                  )}
                  {task.parent?.title && (
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">Parent task</dt>
                      <dd className="wrap-anywhere">{task.parent.title}</dd>
                    </div>
                  )}
                  {task.creator && (
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">Created by</dt>
                      <dd className="flex items-center gap-1.5">
                        <Avatar className="size-5 shrink-0">
                          {task.creator.avatar_url && <AvatarImage src={task.creator.avatar_url} alt={task.creator.name} />}
                          <AvatarFallback className="text-[10px]">
                            {task.creator.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium wrap-anywhere">{task.creator.name}</span>
                        {task.created_at && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            · <time dateTime={task.created_at}>{task.created_at.slice(0, 10)}</time>
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {task.completed_at && task.status === 'done' && (
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">Completed at</dt>
                      <dd className="text-emerald-500 font-medium">
                        <time dateTime={task.completed_at}>{task.completed_at.slice(0, 10)}</time>
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="space-y-1.5">
                  <h2 className="text-sm font-semibold">Description</h2>
                  {task.description_html ? <FormattedTaskDescription html={task.description_html} />
                    : <p className="text-sm leading-6 whitespace-pre-wrap wrap-anywhere text-muted-foreground">{task.description || 'No description provided.'}</p>}
                </div>
                {!!task.tags?.length && <div className="space-y-2"><h2 className="text-sm font-semibold">Tags</h2>
                  <ul className="flex flex-wrap gap-2">{task.tags.map((tag) => <li key={tag}><Badge variant="secondary">{tag}</Badge></li>)}</ul>
                </div>}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold flex items-center gap-1.5">
                      <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
                      Followed by ({task.followers?.length ?? 0})
                    </h2>
                    {canAssign && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => { update.reset(); setEditor('assign'); }}
                      >
                        Manage watchers
                      </Button>
                    )}
                  </div>
                  {!task.followers?.length ? (
                    <p className="text-sm text-muted-foreground">No watchers following this task.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {task.followers.map((follower) => (
                        <li key={follower.id}>
                          <div className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                            <Avatar className="size-4 shrink-0">
                              {follower.avatar_url && <AvatarImage src={follower.avatar_url} alt={follower.name} />}
                              <AvatarFallback className="text-[9px]">
                                {follower.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{follower.name}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold flex items-center gap-1.5">
                      <UserCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                      Assignees ({task.assignees.length})
                    </h2>
                    {canAssign && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => { update.reset(); setEditor('assign'); }}
                      >
                        Manage assignees
                      </Button>
                    )}
                  </div>
                  {task.assignees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                  ) : (
                    <ul className="divide-y rounded-lg border bg-card">
                      {task.assignees.map((member) => (
                        <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" key={member.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6 shrink-0">
                              {member.avatar_url && <AvatarImage src={member.avatar_url} alt={member.name} />}
                              <AvatarFallback className="text-[10px]">
                                {member.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium wrap-anywhere">{member.name}</span>
                            {member.role && (
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {member.role}
                              </Badge>
                            )}
                          </div>
                          {canAssign && (
                            <Button
                              aria-label={`Unassign ${member.name}`}
                              size="sm"
                              variant="ghost"
                              disabled={update.isPending}
                              onClick={() =>
                                update.mutate({ path: `/tasks/${selectedTask}/assignees/${member.id}`, method: 'delete' })
                              }
                            >
                              Unassign
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {!editor && !deleteOpen && update.isError && <p className="text-sm text-destructive" role="alert">{getSafeErrorMessage(update.error)}</p>}
                {editor === 'edit' && task.capabilities?.update && (
                  <FormDialog title="Edit task" description="Update the task details and status." pending={update.isPending} onClose={closeEditor}>
                    <form key={task.uuid} className="grid gap-4" onSubmit={(event) => saveTask(event, task)}>
                      <Input name="title" label="Task title" defaultValue={task.title} required maxLength={255} />
                      {task.description_html !== undefined ? <TaskDescriptionEditor name="description" defaultValue={task.description_html ?? ''} />
                        : <label className="grid gap-2 text-sm font-medium">Description
                          <Textarea name="description" aria-label="Task description" defaultValue={task.description ?? ''} maxLength={10000} />
                        </label>}
                      <ChoiceSelect aria-label="Task status" name="status" defaultValue={task.status}>
                        {Object.entries(statuses).map(([value, label]) => <ChoiceOption key={value} value={value}>{label}</ChoiceOption>)}
                      </ChoiceSelect>
                      <div className="grid gap-1 text-sm">
                        <label htmlFor="edit-task-due-date">Due date</label>
                        <DateField id="edit-task-due-date" name="due_date" aria-label="Due date" defaultValue={task.due_date?.slice(0, 10) ?? ''} />
                      </div>
                      {update.isError && <p role="alert" className="text-sm text-destructive">{getSafeErrorMessage(update.error)}</p>}
                      <TaskPrioritySelect value={task.priority} />
                      <FormDialogActions pending={update.isPending} submitLabel="Save task" />
                    </form>
                  </FormDialog>
                )}
                {editor === 'assign' && canAssign && (
                  <TaskAssignmentsDialog task={task} onClose={closeEditor} />
                )}
                {editor === 'subtask' && task.capabilities?.create_subtask && (
                  <FormDialog title="Add subtask" description="Create a task under this task." pending={update.isPending} onClose={closeEditor}>
                    <form key={task.uuid} className="grid gap-4" onSubmit={(event) => saveTask(event, undefined, task)}>
                      <Input name="title" aria-label="Subtask title" placeholder="Subtask title" required maxLength={255} />
                      {update.isError && <p role="alert" className="text-sm text-destructive">{getSafeErrorMessage(update.error)}</p>}
                      <FormDialogActions pending={update.isPending} submitLabel="Add subtask" />
                    </form>
                  </FormDialog>
                )}
                {task.capabilities?.delete && <div className="border-t pt-4"><Button size="sm" variant="destructive" onClick={() => { update.reset(); setDeleteOpen(true); }}>Delete task</Button></div>}
                {deleteOpen && task.capabilities?.delete && (
                  <ActionConfirmation title="Delete this task?" description="This task will be removed from the project and assigned work." action="Delete task"
                    pending={update.isPending} error={update.isError ? getSafeErrorMessage(update.error) : null}
                    onCancel={() => { update.reset(); setDeleteOpen(false); }}
                    onConfirm={() => update.mutate({ path: `/tasks/${task.uuid}`, method: 'delete' }, { onSuccess: closeTask })} />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

const priorities = ['urgent', 'high', 'medium', 'low'] as const;

function TaskPrioritySelect({ value = 'medium' }: { value?: string | undefined }) {
  return <label className="grid gap-2 text-sm font-medium">
    Priority
    <ChoiceSelect name="priority" aria-label="Priority" defaultValue={value}>
      {priorities.map((priority) => <ChoiceOption className="capitalize" key={priority} value={priority}>{priority}</ChoiceOption>)}
    </ChoiceSelect>
  </label>;
}
