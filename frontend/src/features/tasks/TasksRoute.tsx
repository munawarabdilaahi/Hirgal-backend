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
import { ChevronRight, Columns3, List, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasPermission } from '@/features/auth/permissions';
import { getSafeErrorMessage } from '@/features/auth/auth-validation';
import { apiClient } from '@/services/api/apiClient';
import { projectApi } from '@/services/api/projectApi';
import type { ApiPaginatedResponse, ApiSuccess, ApiUser } from '@/services/api/contracts';

export const statuses = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
};

type TaskStatus = keyof typeof statuses;

export interface Task {
  uuid: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  capabilities?: { update: boolean; delete: boolean; assign: boolean; create_subtask: boolean };
  due_date?: string | null;
  project: { uuid: string; name: string };
  parent?: { uuid: string | null; title: string | null };
  assignees: { id: number; name: string }[];
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const searchTerm = useDebouncedValue(taskSearch.trim());
  const [priority, setPriority] = useState('');
  const [sort, setSort] = useState(assignedToMe ? 'due_date:asc' : 'created_at:desc');
  const [sortBy, sortDirection] = sort.split(':');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [project, setProject] = useState('');
  const [searchParams] = useSearchParams();
  const selectedTask = closeCreateDialog ? null : searchParams.get('task');
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const pageTitle = useRef<HTMLHeadingElement>(null);
  const [board, setBoard] = useState(false);
  const canCreate = hasPermission(user, 'tasks.create');
  const assignee = assignedToMe ? user?.id : undefined;
  const tasks = useQuery({
    queryKey: ['tasks', 'list', user?.id, assignee, page, status, priority, searchTerm, sort],
    queryFn: async () => (await apiClient.get<ApiPaginatedResponse<Task>>('/tasks', {
      params: {
        page, assignee, status: status || undefined, sort_by: sortBy, sort_direction: sortDirection,
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(priority ? { priority } : {}),
      },
    })).data,
    enabled: !closeCreateDialog && taskSearch.trim() === searchTerm && (!assignedToMe || assignee !== undefined),
  });
  const projects = useQuery({
    queryKey: ['projects', 'task-picker', project],
    queryFn: () => projectApi.list({ search: project, page: 1, per_page: 20 }),
    enabled: !assignedToMe && canCreate && hasPermission(user, 'projects.view'),
  });
  const detail = useQuery({
    queryKey: ['tasks', selectedTask],
    queryFn: async () => (await apiClient.get<ApiSuccess<Task>>(`/tasks/${selectedTask}`)).data.data,
    enabled: selectedTask !== null,
  });
  const task = detail.data;
  const canAssign = task?.capabilities?.assign === true;
  const [memberPage, setMemberPage] = useState(1);
  const members = useQuery({
    queryKey: ['projects', task?.project.uuid, 'task-members', memberPage],
    queryFn: () => projectApi.members(task!.project.uuid, memberPage),
    enabled: Boolean(task) && canAssign && hasPermission(user, 'projects.view'),
  });
  const update = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: 'post' | 'put' | 'delete'; body?: unknown }) =>
      apiClient.request({ url: path, method, data: body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
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

  function openTask(uuid: string, trigger: HTMLButtonElement) {
    detailTrigger.current = trigger;
    setMemberPage(1);
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
      path: task ? `/tasks/${task.uuid}` : `/projects/${parent?.project.uuid ?? fields.get('project')}/tasks`,
      method: task ? 'put' : 'post',
      body: {
        title: fields.get('title'),
        description: fields.get('description') || null,
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

  const createTaskForm = editor === 'create' && !assignedToMe && canCreate && hasPermission(user, 'projects.view') && (
        <FormDialog title="Create task" description="Choose a project and enter the task details." pending={update.isPending} onClose={closeEditor}>
        <form className="grid gap-4" onSubmit={(event) => saveTask(event)}>
          {update.isError && <p role="alert" className="text-sm text-destructive">{getSafeErrorMessage(update.error)}</p>}
          <Input aria-label="Search projects" placeholder="Search projects" value={project} onChange={(event) => setProject(event.target.value)} />
          {projects.isPending && <LoadingState label="Loading projects for this task" layout="inline" />}
          {projects.isError && <p role="alert">Projects could not be loaded.</p>}
          <ChoiceSelect name="project" aria-label="Project" required>
            <ChoiceOption value="">Choose a project</ChoiceOption>
            {projects.data?.data.map((item) => <ChoiceOption key={item.uuid} value={item.uuid}>{item.name}</ChoiceOption>)}
          </ChoiceSelect>
          <Input name="title" aria-label="New task title" placeholder="Task title" required maxLength={255} />
          <Textarea name="description" aria-label="Task description" maxLength={10000} />
          <TaskPrioritySelect />
          <DateField name="due_date" aria-label="Due date" />
          <FormDialogActions pending={update.isPending} submitLabel="Create task" />
        </form>
        </FormDialog>
      );
  if (closeCreateDialog) return createTaskForm;

  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:gap-5">
      <PageHeader className="items-center">
        <div className="space-y-2">
          <h1 ref={pageTitle} tabIndex={-1} className="text-2xl font-semibold tracking-tight">{assignedToMe ? 'My work' : 'Tasks'}</h1>
          {assignedToMe && <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Review and update tasks assigned to you.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBoard(!board)}>
            {board ? <List aria-hidden="true" className="size-4" /> : <Columns3 aria-hidden="true" className="size-4" />}
            {board ? 'List view' : 'Board view'}
          </Button>
          {!assignedToMe && canCreate && hasPermission(user, 'projects.view') && (
            <Button onClick={() => { update.reset(); setEditor('create'); }}><Plus aria-hidden="true" className="size-4" />Add task</Button>
          )}
        </div>
      </PageHeader>
      {createTaskForm}
      <div className="workspace-surface @container p-3 sm:p-4">
        <div className="grid gap-3 @min-[25rem]:grid-cols-2 @min-[48rem]:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,10rem))]">
          <div className="relative min-w-0 @min-[25rem]:col-span-2 @min-[48rem]:col-span-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input className="pl-9" aria-label="Search tasks" placeholder="Search tasks" maxLength={100} value={taskSearch} onChange={(event) => { setTaskSearch(event.target.value); setPage(1); }} />
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
          <ChoiceSelect aria-label="Sort tasks" value={sort} onValueChange={(nextValue) => { setSort(nextValue); setPage(1); }}>
            <ChoiceOption value="created_at:desc">Newest first</ChoiceOption>
            <ChoiceOption value="due_date:asc">Due date</ChoiceOption>
            <ChoiceOption value="title:asc">Title A–Z</ChoiceOption>
          </ChoiceSelect>
        </div>
      </div>
      {tasks.isPending && <LoadingState label="Loading tasks" layout={board ? "board" : "list"} />}
      {tasks.isError && <ErrorState title="Could not load tasks" description={getSafeErrorMessage(tasks.error)} onRetry={() => void tasks.refetch()} />}
      {tasks.data && (
        <>
          {tasks.data.data.length === 0 && <EmptyState title={assignedToMe ? 'No assigned tasks match this view.' : 'No tasks match this view.'} />}
          {tasks.data.data.length > 0 && (board ? (
            <div className="grid grid-cols-[repeat(6,minmax(10rem,1fr))] gap-3 overflow-x-auto pb-2">
              {Object.entries(statuses).map(([value, label]) => (
                <section key={value} className="workspace-surface space-y-2 p-3">
                  <h2 className="text-sm font-semibold">{label}</h2>
                  {tasks.data.data.filter((item) => item.status === value).map((item) => (
                    <Button aria-haspopup="dialog" className="h-auto w-full justify-start text-left whitespace-normal wrap-anywhere" key={item.uuid} variant="outline"
                      onClick={(event) => openTask(item.uuid, event.currentTarget)}>{item.title}</Button>
                  ))}
                </section>
              ))}
            </div>
          ) : <ul className="workspace-surface divide-y">
            {tasks.data.data.map((task) => (
              <li key={task.uuid}>
                <Button className="grid h-auto min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 whitespace-normal px-3 py-2.5 text-left focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] sm:px-4"
                  aria-haspopup="dialog" aria-label={task.title} aria-describedby={`task-project-${task.uuid} task-meta-${task.uuid}`}
                  variant="ghost" onClick={(event) => openTask(task.uuid, event.currentTarget)}>
                  <span className="min-w-0">
                    <span className="block font-semibold wrap-anywhere">{task.title}</span>
                    <span id={`task-project-${task.uuid}`} className="mt-0.5 block text-xs font-normal text-muted-foreground wrap-anywhere">{task.project.name}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="row-span-2 size-4 shrink-0 text-muted-foreground sm:order-last sm:row-span-1" />
                  <span id={`task-meta-${task.uuid}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:contents">
                    <Badge variant="secondary" className="w-fit">{statuses[task.status]}</Badge>
                    <span className="text-xs font-normal text-muted-foreground">
                      {task.due_date ? <><span className="sr-only sm:not-sr-only">Due </span><time dateTime={task.due_date}>{task.due_date.slice(0, 10)}</time></> : <span className="hidden sm:inline">No due date</span>}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>)}
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
            <DialogDescription>{task?.project.name ?? 'View task information and available actions.'}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            {detail.isPending && <LoadingState label="Loading task details" layout="list" rows={2} />}
            {detail.isError && <ErrorState title="Could not load task" description={getSafeErrorMessage(detail.error)} onRetry={() => void detail.refetch()} />}
            {task && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2 empty:hidden">
                  {task.capabilities?.update && <Button size="sm" onClick={() => { update.reset(); setEditor('edit'); }}>Edit task</Button>}
                  {canAssign && hasPermission(user, 'projects.view') && <Button size="sm" variant="outline" onClick={() => { update.reset(); setEditor('assign'); }}>Assign member</Button>}
                  {task.capabilities?.create_subtask && <Button size="sm" variant="outline" onClick={() => { update.reset(); setEditor('subtask'); }}>Add subtask</Button>}
                </div>
                <dl className="workspace-surface grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
                  <div><dt className="mb-1 text-xs text-muted-foreground">Status</dt><dd><Badge variant="secondary">{statuses[task.status]}</Badge></dd></div>
                  <div><dt className="mb-1 text-xs text-muted-foreground">Priority</dt><dd className="capitalize">{task.priority}</dd></div>
                  <div><dt className="mb-1 text-xs text-muted-foreground">Due date</dt><dd>{task.due_date ? <time dateTime={task.due_date}>{task.due_date.slice(0, 10)}</time> : 'No due date'}</dd></div>
                  {task.parent?.title && <div><dt className="mb-1 text-xs text-muted-foreground">Parent task</dt><dd className="wrap-anywhere">{task.parent.title}</dd></div>}
                </dl>
                <div className="space-y-1.5">
                  <h2 className="text-sm font-semibold">Description</h2>
                  <p className="text-sm leading-6 whitespace-pre-wrap wrap-anywhere text-muted-foreground">{task.description || 'No description provided.'}</p>
                </div>
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Assignees</h2>
                  {task.assignees.length === 0 ? <p className="text-sm text-muted-foreground">Unassigned</p> : (
                    <ul className="divide-y rounded-lg border">
                      {task.assignees.map((member) => (
                        <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" key={member.id}>
                          <span className="wrap-anywhere">{member.name}</span>
                          {canAssign && <Button aria-label={`Unassign ${member.name}`} size="sm" variant="ghost" disabled={update.isPending} onClick={() =>
                            update.mutate({ path: `/tasks/${selectedTask}/assignees/${member.id}`, method: 'delete' })
                          }>Unassign</Button>}
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
                      <label className="grid gap-2 text-sm font-medium">Description
                        <Textarea name="description" aria-label="Task description" defaultValue={task.description ?? ''} maxLength={10000} />
                      </label>
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
                  <FormDialog title="Assign member" description="Choose a member of the task’s project." pending={update.isPending} onClose={closeEditor}>
                    {members.isPending ? <LoadingState label="Loading project members" layout="control" /> : members.isError ? <ErrorState title="Could not load project members" description={getSafeErrorMessage(members.error)} onRetry={() => void members.refetch()} /> : members.data && <form className="grid gap-2" onSubmit={(event) => {
                      event.preventDefault();
                      const member = new FormData(event.currentTarget).get('member');
                      update.mutate({ path: `/tasks/${selectedTask}/assign`, method: 'post', body: { user_ids: [Number(member)] } }, { onSuccess: () => setEditor(null) });
                    }}>
                      <ChoiceSelect name="member" aria-label="Project member" required>
                        <ChoiceOption value="">Choose a project member</ChoiceOption>
                        {members.data.data.filter(({ user: member }) => !task?.assignees.some((person) => person.id === member.id))
                          .map(({ user: member }) => <ChoiceOption key={member.id} value={member.id}>{member.name}</ChoiceOption>)}
                      </ChoiceSelect>
                      <Pagination currentPage={memberPage} totalPages={members.data.meta.last_page} onPageChange={setMemberPage} />
                      {update.isError && <p role="alert" className="text-sm text-destructive">{getSafeErrorMessage(update.error)}</p>}
                      <FormDialogActions pending={update.isPending} submitLabel="Assign member" />
                    </form>}
                  </FormDialog>
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
