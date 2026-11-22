import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChoiceOption, ChoiceSelect } from '@/components/ui/choice-select';
import { DateField } from '@/components/ui/date-field';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { useMarkFormDirty } from '@/components/ui/form-dirty-context';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { TaskAssigneesField } from './TaskAssigneesField';
import { FormattedTaskDescription, TaskDescriptionEditor } from './TaskDescriptionEditor';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { isCalendarDate } from '@/lib/calendar-date';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api/apiClient';
import type { ApiDirectoryUser } from '@/services/api/contracts';
import { projectApi } from '@/services/api/projectApi';

const steps = ['Details', 'Context', 'Review'] as const;
const contexts = { project: 'Project', department: 'Department', other: 'Other' };
const initial = {
  title: '', description: '', context: 'project' as keyof typeof contexts, department: '',
  status: 'todo', priority: 'medium', start_date: '', due_date: '', remind_on: '', tags: [] as string[],
  assignees: [] as ApiDirectoryUser[], followers: [] as ApiDirectoryUser[],
};

export function NewTaskDialog({ actorId, canViewProjects, canAssign, statuses, priorities, initialProjectUuid, onClose }: {
  actorId: number;
  canViewProjects: boolean;
  canAssign: boolean;
  statuses: Record<string, string>;
  priorities: readonly string[];
  initialProjectUuid?: string | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: ({ project, details }: { project: string | null; details: typeof initial }) => apiClient.post(project ? `/projects/${project}/tasks` : '/tasks', {
      ...details,
      department: details.department || null,
      description: details.description.trim() || null,
      description_is_rich_text: true,
      start_date: details.start_date || null,
      due_date: details.due_date || null,
      remind_on: details.remind_on || null,
      assignees: details.assignees.map(({ id }) => id),
      followers: details.followers.map(({ id }) => id),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created.');
      onClose();
    },
  });

  return (
    <FormDialog title="Create task" description="Add details, choose who’s involved, and review your task." wide pending={create.isPending} onClose={onClose}>
      <TaskCreationSteps actorId={actorId} canViewProjects={canViewProjects} canAssign={canAssign}
        statuses={statuses} priorities={priorities} initialProjectUuid={initialProjectUuid} pending={create.isPending}
        error={create.isError ? Object.values(getApiValidationErrors(create.error)).join(' ') || getSafeErrorMessage(create.error) : null}
        onSubmit={(project, details) => create.mutate({ project, details })} />
    </FormDialog>
  );
}

function TaskCreationSteps({ actorId, canViewProjects, canAssign, statuses, priorities, initialProjectUuid, pending, error, onSubmit }: {
  actorId: number;
  canViewProjects: boolean;
  canAssign: boolean;
  statuses: Record<string, string>;
  priorities: readonly string[];
  initialProjectUuid?: string | undefined;
  pending: boolean;
  error: string | null;
  onSubmit: (project: string | null, details: typeof initial) => void;
}) {
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState(() => ({ ...initial, context: canViewProjects ? initial.context : 'other' as const }));
  const [project, setProject] = useState<{ uuid: string; name: string } | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [tag, setTag] = useState('');
  const [validation, setValidation] = useState('');
  const markDirty = useMarkFormDirty();
  const heading = useRef<HTMLHeadingElement>(null);
  const descriptionId = useId();
  const projects = useQuery({
    queryKey: ['projects', 'new-task', actorId, projectSearch],
    queryFn: () => projectApi.list({ search: projectSearch.trim(), page: 1, per_page: 50 }),
    enabled: canViewProjects,
  });
  const projectsData = projects.data?.data;
  const projectOptions = projectsData ?? [];

  useEffect(() => {
    if (!project && projectsData && projectsData.length > 0 && details.context === 'project') {
      const match = initialProjectUuid ? projectsData.find((item) => item.uuid === initialProjectUuid) : null;
      const target = match ?? projectsData[0];
      if (target) {
        setProject({ uuid: target.uuid, name: target.name });
      }
    }
  }, [project, projectsData, details.context, initialProjectUuid]);

  const roster = useQuery({
    queryKey: ['projects', 'new-task-roster', actorId, project?.uuid],
    queryFn: async () => {
      const uuid = project!.uuid;
      const first = await projectApi.members(uuid);
      const members = [...first.data];
      for (let page = 2; page <= first.meta.last_page; page++) {
        members.push(...(await projectApi.members(uuid, page)).data);
      }
      return members.map(({ user }) => user).filter(Boolean);
    },
    enabled: Boolean(project),
  });
  const members = roster.data ?? [];
  const departments = [...new Set(members.flatMap(({ department }) => department ? [department] : []))].sort();
  const eligible = details.context === 'department' ? members.filter(({ department }) => department === details.department) : members;

  function patch(values: Partial<typeof initial>) {
    markDirty();
    setDetails((current) => ({ ...current, ...values }));
    setValidation('');
  }

  function navigate(next: number) {
    setValidation('');
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }

  function addTag() {
    const value = tag.trim();
    if (!value) return;
    if (details.tags.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      setValidation('This tag is already added.');
      return;
    }
    if (details.tags.length >= 20) {
      setValidation('Add up to 20 tags.');
      return;
    }
    patch({ tags: [...details.tags, value] });
    setTag('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (step === 0) {
      if (!details.title.trim()) return setValidation('Enter a task name.');
      if (details.description.length > 10000) return setValidation('Shorten the description to continue.');
      if (details.start_date && details.due_date && details.due_date < details.start_date) {
        return setValidation('End date must be on or after the start date.');
      }
      if (tag.trim()) return setValidation('Add the pending tag or clear the tag field before continuing.');
    }
    if (step === 1 && details.context !== 'other' && (!project || (details.context === 'department' && !details.department))) {
      return setValidation('Choose a project and, for Department context, a department. For a private task, choose Other.');
    }
    if (step < 2) navigate(step + 1);
    else onSubmit(project?.uuid ?? null, { ...details, title: details.title.trim() });
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <nav aria-label="Creation steps">
        <ol className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/35 p-1">
          {steps.map((label, index) => (
            <li key={label}>
              <Button type="button" size="sm" variant="ghost" disabled={index > step || pending}
                aria-current={index === step ? 'step' : undefined} onClick={() => index < step && navigate(index)}
                className={cn('w-full gap-1.5 px-1 text-xs sm:gap-2 sm:text-sm', index === step && 'bg-card text-primary shadow-sm')}>
                <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-muted text-xs">{index + 1}</span>{label}
              </Button>
            </li>
          ))}
        </ol>
      </nav>
      <h3 ref={heading} tabIndex={-1} className="text-base font-semibold outline-none">{steps[step]}</h3>
      {step === 0 && (
        <div className="grid gap-4">
          <Input label="Task name" value={details.title} placeholder="Enter a task name" required maxLength={255}
            onChange={(event) => patch({ title: event.target.value })} />
          <TaskDescriptionEditor defaultValue={details.description} onChange={(description) => patch({ description })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status"><ChoiceSelect aria-label="Status" value={details.status} onValueChange={(status) => patch({ status })}>
              {Object.entries(statuses).map(([value, label]) => <ChoiceOption value={value} key={value}>{label}</ChoiceOption>)}
            </ChoiceSelect></Field>
            <Field label="Priority"><ChoiceSelect aria-label="Priority" value={details.priority} onValueChange={(priority) => patch({ priority })}>
              {priorities.map((priority) => <ChoiceOption className="capitalize" value={priority} key={priority}>{priority}</ChoiceOption>)}
            </ChoiceSelect></Field>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Assignees</span>
            <TaskAssigneesField
              eligibleUsers={eligible}
              selectedUsers={details.assignees}
              onChange={(assignees) => patch({ assignees })}
              isLoading={roster.isPending}
              disabled={!canAssign || details.context === 'other'}
              disabledMessage={
                details.context === 'other'
                  ? 'Personal tasks cannot have assignees.'
                  : !canAssign
                  ? 'You do not have permission to assign tasks.'
                  : undefined
              }
            />
          </div>
          <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
            <legend className="px-1 text-sm font-medium">Timeline</legend>
            <Field label="Start date"><DateField aria-label="Start date" value={details.start_date} onValueChange={(start_date) => patch({ start_date })} /></Field>
            <Field label="End date"><DateField aria-label="End date" value={details.due_date} onValueChange={(due_date) => patch({ due_date })}
              {...(isCalendarDate(details.start_date) ? { min: details.start_date } : {})} /></Field>
            <Field label="Remind me date"><DateField aria-label="Remind me date" value={details.remind_on} onValueChange={(remind_on) => patch({ remind_on })} /></Field>
          </fieldset>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor={descriptionId + '-tag'}>Tags</label>
            <div className="flex gap-2">
              <Input id={descriptionId + '-tag'} value={tag} maxLength={40} placeholder="Add a tag" onChange={(event) => setTag(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} />
              <Button type="button" variant="outline" onClick={addTag} disabled={!tag.trim()}>Add tag</Button>
            </div>
            <Chips items={details.tags} onRemove={(value) => patch({ tags: details.tags.filter((item) => item !== value) })} />
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="grid gap-4">
          <fieldset className="grid grid-cols-3 gap-2">
            <legend className="mb-2 text-sm font-medium">Context</legend>
            {Object.entries(contexts).filter(([value]) => canViewProjects || value === 'other').map(([value, label]) => (
              <Button key={value} type="button" aria-pressed={details.context === value} variant={details.context === value ? 'default' : 'outline'}
                onClick={() => { if (details.context !== value) patch({ context: value as keyof typeof contexts, department: '', assignees: [] }); }}>
                {label}
              </Button>
            ))}
          </fieldset>
          {details.context === 'other' && <p className="text-sm text-muted-foreground">A task without a project is private to you.</p>}
          {canViewProjects && <div className="grid gap-2">
            <SearchInput aria-label="Search projects" placeholder="Search projects" maxLength={100} value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} />
            <Field label={details.context === 'other' ? 'Project (optional)' : 'Project'}>
              <ChoiceSelect aria-label="Project" value={project?.uuid ?? ''} onValueChange={(uuid) => {
                const nextProject = projectOptions.find((item) => item.uuid === uuid) ?? null;
                setProject(nextProject);
                if (nextProject?.uuid !== project?.uuid) {
                  patch({ department: '', assignees: [], followers: [] });
                }
              }}>
                <ChoiceOption value="">Choose a project</ChoiceOption>
                {project && !projectOptions.some((item) => item.uuid === project.uuid) && <ChoiceOption value={project.uuid}>{project.name}</ChoiceOption>}
                {projectOptions.map((item) => <ChoiceOption key={item.uuid} value={item.uuid}>{item.name}</ChoiceOption>)}
              </ChoiceSelect>
            </Field>
            {projects.isPending && <LoadingState label="Loading projects" layout="inline" />}
            {projects.isError && <Button type="button" variant="link" onClick={() => void projects.refetch()}>Retry loading projects</Button>}
            {projects.isSuccess && projectOptions.length === 0 && <p className="text-sm text-muted-foreground">
              No matching projects. Choose Other to create a private task.
            </p>}
          </div>}
          {project && roster.isPending && <LoadingState label="Loading project members" layout="list" rows={2} />}
          {project && roster.isError && <Button type="button" variant="link" onClick={() => void roster.refetch()}>Retry loading project members</Button>}
          {details.context === 'department' && (
            <Field label="Department">
              <ChoiceSelect aria-label="Department" disabled={departments.length === 0} value={details.department}
                onValueChange={(department) => patch({ department, assignees: [] })}>
                <ChoiceOption value="">Choose a department</ChoiceOption>
                {departments.map((department) => <ChoiceOption value={department} key={department}>{department}</ChoiceOption>)}
              </ChoiceSelect>
              {roster.isSuccess && departments.length === 0 && <p className="text-xs text-muted-foreground">This project has no department members.</p>}
            </Field>
          )}
          {project && canAssign && (
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Assigned to</span>
              <TaskAssigneesField
                label="Assigned to"
                eligibleUsers={eligible}
                selectedUsers={details.assignees}
                onChange={(assignees) => patch({ assignees })}
                isLoading={roster.isPending}
                disabled={!canAssign}
              />
            </div>
          )}
          {project && <PeopleField label="Followed by" options={members} selected={details.followers} onChange={(followers) => patch({ followers })} />}
        </div>
      )}
      {step === 2 && (
        <dl className="grid gap-3 rounded-lg border bg-muted/25 p-4 text-sm sm:grid-cols-2">
          {Object.entries({
            'Task name': details.title, Context: [contexts[details.context], project?.name, details.department].filter(Boolean).join(' · '),
            Status: statuses[details.status], Priority: details.priority, 'Start date': details.start_date, 'End date': details.due_date,
            'Remind me date': details.remind_on, 'Assigned to': details.assignees.map(({ name }) => name).join(', '),
            'Followed by': details.followers.map(({ name }) => name).join(', '), Tags: details.tags.join(', '),

          }).map(([label, value]) => (
            <div className="min-w-0" key={label}>
              <dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap wrap-anywhere">{value || '—'}</dd>
            </div>
          ))}
          <div className="min-w-0 sm:col-span-2"><dt className="text-muted-foreground">Description</dt><dd className="mt-0.5">
            {details.description ? <FormattedTaskDescription html={details.description} /> : '—'}
          </dd></div>
        </dl>
      )}
      {(validation || error) && <p className="text-sm text-destructive" role="alert">{validation || error}</p>}
      <FormDialogActions pending={pending} submitLabel={step === 2 ? 'Create task' : 'Continue'}
        {...(step > 0 ? { onBack: () => navigate(step - 1) } : {})} />
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid min-w-0 gap-1.5"><span className="text-sm font-medium">{label}</span>{children}</div>;
}

function Chips({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  if (items.length === 0) return null;
  return <ul className="flex flex-wrap gap-2">{items.map((item) => (
    <li key={item}><Badge variant="secondary" className="max-w-full gap-1 wrap-anywhere">
      {item}<Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Remove ${item}`} onClick={() => onRemove(item)}>
        <X className="size-3" aria-hidden="true" />
      </Button>
    </Badge></li>
  ))}</ul>;
}

function PeopleField({ label, options, selected, onChange }: {
  label: string; options: ApiDirectoryUser[]; selected: ApiDirectoryUser[]; onChange: (users: ApiDirectoryUser[]) => void;
}) {
  const available = options.filter(({ id }) => !selected.some((user) => user.id === id));
  return (
    <Field label={label}>
      <ChoiceSelect aria-label={label} value="" disabled={available.length === 0} onValueChange={(id) => {
        const person = available.find((item) => String(item.id) === id);
        if (person) onChange([...selected, person]);
      }}>
        <ChoiceOption value="">{available.length ? 'Choose a project member' : 'No additional members available'}</ChoiceOption>
        {available.map((user) => <ChoiceOption key={user.id} value={String(user.id)}>{user.name} · {user.email}</ChoiceOption>)}
      </ChoiceSelect>
      <ul className="flex flex-wrap gap-2">{selected.map((user) => (
        <li key={user.id}><Badge variant="secondary" className="gap-1">{user.name}
          <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={`Remove ${user.name} from ${label.toLowerCase()}`}
            onClick={() => onChange(selected.filter(({ id }) => id !== user.id))}><X className="size-3" aria-hidden="true" /></Button>
        </Badge></li>
      ))}</ul>
    </Field>
  );
}
