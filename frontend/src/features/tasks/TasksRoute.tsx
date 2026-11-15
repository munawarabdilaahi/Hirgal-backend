import { ActionConfirmation } from '@/components/ui/action-confirmation';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/components/layout/primitives';
import { useDebouncedValue } from '@/features/users/use-debounced-value';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const [selectedTask, setSelectedTask] = useState(() => searchParams.get('task'));
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
  const targetReady = hash === '#task-details' && Boolean(detail.data);
  useEffect(() => {
    if (targetReady) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [hash, targetReady]);

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
          <NativeSelect name="project" aria-label="Project" required>
            <option value="">Choose a project</option>
            {projects.data?.data.map((item) => <option key={item.uuid} value={item.uuid}>{item.name}</option>)}
          </NativeSelect>
          <Input name="title" aria-label="New task title" placeholder="Task title" required maxLength={255} />
          <Textarea name="description" aria-label="Task description" maxLength={10000} />
          <TaskPrioritySelect />
          <Input name="due_date" aria-label="Due date" type="date" />
          <FormDialogActions pending={update.isPending} submitLabel="Create task" />
        </form>
        </FormDialog>
      );
  if (closeCreateDialog) return createTaskForm;

  return (
    <section className="grid grid-cols-1 gap-5">
      <PageHeader>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{assignedToMe ? 'My work' : 'Tasks'}</h1>
          {assignedToMe && <p className="text-sm text-muted-foreground">Review and update tasks assigned to you.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
        {!assignedToMe && canCreate && hasPermission(user, 'projects.view') && <Button onClick={() => { update.reset(); setEditor('create'); }}>Add task</Button>}
        <Button variant="outline" aria-pressed={board} onClick={() => setBoard(!board)}>Board view</Button>
        </div>
      </PageHeader>
      {!editor && update.isError && <p role="alert">{getSafeErrorMessage(update.error)}</p>}
      {createTaskForm}
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input aria-label="Search tasks" placeholder="Search tasks" maxLength={100} value={taskSearch} onChange={(event) => { setTaskSearch(event.target.value); setPage(1); }} />
        <label className="sr-only" htmlFor="task-status-filter">Status</label>
        <NativeSelect id="task-status-filter" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Filter by priority" value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }}>
          <option value="">All priorities</option>
          {priorities.map((value) => <option className="capitalize" key={value} value={value}>{value}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Sort tasks" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
          <option value="created_at:desc">Newest first</option>
          <option value="due_date:asc">Due date</option>
          <option value="title:asc">Title A–Z</option>
        </NativeSelect>
      </div>
      {tasks.isPending && <LoadingState label="Loading tasks" layout={board ? "board" : "list"} />}
      {tasks.isError && <ErrorState title="Could not load tasks" description={getSafeErrorMessage(tasks.error)} onRetry={() => void tasks.refetch()} />}
      {tasks.data && (
        <>
          {tasks.data.data.length === 0 && <EmptyState title={assignedToMe ? 'No assigned tasks match this view.' : 'No tasks match this view.'} />}
          {board ? (
            <div className="grid grid-cols-[repeat(6,minmax(11rem,1fr))] gap-3 overflow-x-auto pb-2">
              {Object.entries(statuses).map(([value, label]) => (
                <section key={value} className="space-y-2 rounded-lg border p-3">
                  <h2 className="font-semibold">{label}</h2>
                  {tasks.data.data.filter((item) => item.status === value).map((item) => (
                    <Button className="h-auto w-full justify-start text-left whitespace-normal wrap-anywhere" key={item.uuid} variant="outline"
                      onClick={() => { setSelectedTask(item.uuid); setMemberPage(1); update.reset(); }}>{item.title}</Button>
                  ))}
                </section>
              ))}
            </div>
          ) : <ul className="divide-y rounded-xl border bg-card empty:hidden">
            {tasks.data.data.map((task) => (
              <li key={task.uuid} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <Button className="h-auto max-w-full justify-start text-left whitespace-normal wrap-anywhere" variant="ghost" onClick={() => { setSelectedTask(task.uuid); setMemberPage(1); update.reset(); }}>{task.title}</Button>
                <span className="text-sm wrap-anywhere text-muted-foreground">
                  {task.project.name} · <Badge variant="secondary">{statuses[task.status]}</Badge>
                  {task.due_date && <> · Due <time dateTime={task.due_date}>{task.due_date.slice(0, 10)}</time></>}
                </span>
              </li>
            ))}
          </ul>}
          <Pagination currentPage={page} totalPages={tasks.data.meta.last_page} onPageChange={setPage} />
        </>
      )}
      {selectedTask && detail.isPending && <LoadingState label="Loading task details" layout="detail" />}
      {detail.isError && <ErrorState title="Could not load task" description={getSafeErrorMessage(detail.error)} onRetry={() => void detail.refetch()} />}
      {detail.data && (
        <section className="grid gap-3 rounded-lg border p-4" id="task-details" aria-label="Task details">
          <h2 className="text-lg font-semibold">{detail.data.title}</h2>
          <p>{detail.data.description}</p>
          <p className="text-sm text-muted-foreground">Priority: {detail.data.priority} · {statuses[detail.data.status]}</p>
          {detail.data.parent?.title && <p>Parent task: {detail.data.parent.title}</p>}
          <p>Assignees: {detail.data.assignees.map((person) => person.name).join(', ') || 'Unassigned'}</p>
          {task?.capabilities?.update && <Button variant="outline" onClick={() => { update.reset(); setEditor('edit'); }}>Edit task</Button>}
          {editor === 'edit' && task?.capabilities?.update && (
            <FormDialog title="Edit task" description="Update the task details and status." pending={update.isPending} onClose={closeEditor}>
            <form key={detail.data.uuid} className="grid gap-2" onSubmit={(event) => saveTask(event, detail.data)}>
              <Input name="title" aria-label="Task title" defaultValue={detail.data.title} required maxLength={255} />
              <Textarea name="description" aria-label="Task description" defaultValue={detail.data.description ?? ''} maxLength={10000} />
              <NativeSelect aria-label="Task status" name="status" defaultValue={detail.data.status}>
                {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
              <label className="grid gap-1 text-sm">
                Due date
                <Input name="due_date" type="date" defaultValue={detail.data.due_date?.slice(0, 10) ?? ''} />
              </label>
              {update.isError && <p role="alert" className="text-sm text-destructive">{getSafeErrorMessage(update.error)}</p>}
              <TaskPrioritySelect value={task?.priority} />
              <FormDialogActions pending={update.isPending} submitLabel="Save task" />
            </form>
            </FormDialog>
          )}
          {canAssign && hasPermission(user, 'projects.view') && <Button variant="outline" onClick={() => { update.reset(); setEditor('assign'); }}>Assign member</Button>}
          {editor === 'assign' && canAssign && (
            <FormDialog title="Assign member" description="Choose a member of the task’s project." pending={update.isPending} onClose={closeEditor}>
            {members.isPending ? <LoadingState label="Loading project members" layout="control" /> : members.isError ? <ErrorState title="Could not load project members" description={getSafeErrorMessage(members.error)} onRetry={() => void members.refetch()} /> : members.data && <form className="grid gap-2" onSubmit={(event) => {
              event.preventDefault();
              const member = new FormData(event.currentTarget).get('member');
              update.mutate({ path: `/tasks/${selectedTask}/assign`, method: 'post', body: { user_ids: [Number(member)] } }, { onSuccess: () => setEditor(null) });
            }}>
              <NativeSelect name="member" aria-label="Project member" required>
                <option value="">Choose a project member</option>
                {members.data.data.filter(({ user: member }) => !task?.assignees.some((person) => person.id === member.id))
                  .map(({ user: member }) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </NativeSelect>
              <Pagination currentPage={memberPage} totalPages={members.data.meta.last_page} onPageChange={setMemberPage} />
              {update.isError && <p role="alert" className="text-sm text-destructive">{getSafeErrorMessage(update.error)}</p>}
              <FormDialogActions pending={update.isPending} submitLabel="Assign member" />
            </form>}
            </FormDialog>
          )}
          {canAssign && members.isError && <p role="alert">Project members could not be loaded.</p>}
          {task?.capabilities?.create_subtask && task && <Button variant="outline" onClick={() => { update.reset(); setEditor('subtask'); }}>Add subtask</Button>}
          {editor === 'subtask' && task?.capabilities?.create_subtask && task && (
            <FormDialog title="Add subtask" description="Create a task under this task." pending={update.isPending} onClose={closeEditor}>
            <form key={task.uuid} className="grid gap-4" onSubmit={(event) => saveTask(event, undefined, task)}>
              <Input name="title" aria-label="Subtask title" placeholder="Subtask title" required maxLength={255} />
              {update.isError && <p role="alert" className="text-sm text-destructive">{getSafeErrorMessage(update.error)}</p>}
              <FormDialogActions pending={update.isPending} submitLabel="Add subtask" />
            </form>
            </FormDialog>
          )}
          {canAssign && task?.assignees.map((member) => (
            <Button key={member.id} variant="outline" disabled={update.isPending} onClick={() =>
              update.mutate({ path: `/tasks/${selectedTask}/assignees/${member.id}`, method: 'delete' })
            }>Unassign {member.name}</Button>
          ))}
          {task?.capabilities?.delete && <Button variant="destructive" onClick={() => { update.reset(); setDeleteOpen(true); }}>Delete task</Button>}
          {deleteOpen && task?.capabilities?.delete && (
            <ActionConfirmation title="Delete this task?" description="This task will be removed from the project and assigned work." action="Delete task"
              pending={update.isPending} error={update.isError ? getSafeErrorMessage(update.error) : null}
              onCancel={() => { update.reset(); setDeleteOpen(false); }}
              onConfirm={() => update.mutate({ path: `/tasks/${task.uuid}`, method: 'delete' }, { onSuccess: () => { setDeleteOpen(false); setSelectedTask(null); } })} />
          )}
          <Button variant="outline" onClick={() => setSelectedTask(null)}>Close details</Button>
        </section>
      )}
    </section>
  );
}

const priorities = ['urgent', 'high', 'medium', 'low'] as const;

function TaskPrioritySelect({ value = 'medium' }: { value?: string | undefined }) {
  return <label className="grid gap-2 text-sm font-medium">
    Priority
    <NativeSelect name="priority" defaultValue={value}>
      {priorities.map((priority) => <option className="capitalize" key={priority} value={priority}>{priority}</option>)}
    </NativeSelect>
  </label>;
}
