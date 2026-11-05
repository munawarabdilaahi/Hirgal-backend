import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Archive, FolderKanban, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasGlobalRole, hasPermission } from '@/features/auth/permissions';
import { useDebouncedValue } from '@/features/users/use-debounced-value';
import { userApi } from '@/services/api/userApi';
import { projectKeys, useProject, useProjectAction, useProjectMembers, useProjectTeams, useProjects, useSaveProject } from './project-queries';
import type { ApiProject, ProjectStatus, SaveProjectRequest } from '@/services/api/contracts';
import { projectApi } from '@/services/api/projectApi';
import { teamApi } from '@/services/api/teamApi';
import { teamKeys } from '@/features/teams/team-queries';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name.').max(255, 'Use 255 characters or fewer.'),
  description: z.string().max(5000, 'Use 5000 characters or fewer.'),
  status: z.enum(['planning', 'active', 'paused', 'completed']),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  start_date: z.string(),
  due_date: z.string(),
});
type ProjectFormValues = z.infer<typeof formSchema>;

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = error.status;
    if (status === 403) return 'You no longer have permission to access this project.';
    if (status === 404) return 'This project is unavailable or outside your access scope.';
    if (status === 422) return 'The project details were rejected. Review the fields and try again.';
  }
  return 'Hirgal could not complete this request. Check your connection and try again.';
}

function statusLabel(status: ProjectStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ProjectsRoute() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const searchIsSettled = search.trim() === debouncedSearch;
  const query = useProjects({ page, per_page: 12, ...(debouncedSearch ? { search: debouncedSearch } : {}), ...(status ? { status: status as ProjectStatus } : {}), ...(priority ? { priority: priority as 'urgent' | 'high' | 'medium' | 'low' } : {}) }, searchIsSettled);
  const projects = query.data?.data ?? [];
  return (
    <section aria-labelledby="projects-title" className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2"><p className="text-sm font-medium text-primary">Workspaces</p><h1 className="text-2xl font-semibold tracking-tight" id="projects-title">Projects</h1><p className="max-w-2xl text-sm leading-6 text-muted-foreground">Browse projects you own or have joined.</p></div>
        {hasPermission(user, 'projects.create') ? <Button asChild><Link to="/projects/new"><Plus aria-hidden="true" className="size-4" />New project</Link></Button> : null}
      </header>
      <Card><CardContent className="grid gap-3 pt-6 sm:grid-cols-[minmax(12rem,1fr)_12rem_12rem]"><label className="relative"><span className="sr-only">Search projects</span><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" maxLength={100} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search projects" value={search} /></label><label className="space-y-1 text-sm"><span className="sr-only">Filter by status</span><select aria-label="Filter by status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" onChange={(event) => { setStatus(event.target.value); setPage(1); }} value={status}><option value="">All statuses</option>{(['planning', 'active', 'paused', 'completed', 'archived'] as const).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><label className="space-y-1 text-sm"><span className="sr-only">Filter by priority</span><select aria-label="Filter by priority" className="h-10 w-full rounded-md border bg-background px-3 text-sm" onChange={(event) => { setPriority(event.target.value); setPage(1); }} value={priority}><option value="">All priorities</option>{(['urgent', 'high', 'medium', 'low'] as const).map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label></CardContent></Card>
      {query.isPending ? <div aria-label="Loading projects" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status"><span className="sr-only">Loading projects</span>{Array.from({ length: 6 }, (_, index) => <Card aria-hidden="true" className="space-y-4 p-6" key={index}><div className="flex justify-between"><Skeleton className="size-5" /><Skeleton className="h-5 w-20" /></div><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /><div className="flex justify-between pt-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div></Card>)}</div> : query.isError ? <ErrorState description={errorMessage(query.error)} onRetry={() => void query.refetch()} title="Projects could not be loaded" /> : projects.length === 0 ? <EmptyState description="Projects you can access will appear here. Try a different search or create a project if you have permission." title="No projects found" /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.uuid} project={project} />)}</div>}
      {query.data?.meta ? <Pagination currentPage={query.data.meta.current_page} onPageChange={setPage} totalPages={query.data.meta.last_page} /> : null}
    </section>
  );
}

function ProjectCard({ project }: { project: ApiProject }) {
  return <Card className="transition-shadow hover:shadow-md"><CardHeader className="gap-3"><div className="flex items-start justify-between gap-3"><FolderKanban aria-hidden="true" className="size-5 text-primary" /><StatusBadge label={statusLabel(project.status)} status={project.status === 'completed' ? 'complete' : project.status === 'active' ? 'active' : project.status === 'paused' || project.status === 'archived' ? 'blocked' : 'planned'} /></div><CardTitle><Link className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/projects/${project.uuid}`}>{project.name}</Link></CardTitle><CardDescription>{project.description || 'No description provided.'}</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between gap-3 text-muted-foreground"><span>{project.owner?.name ? `Owner: ${project.owner.name}` : 'Owner not listed'}</span><span>{project.members_count ?? 0} members</span></div><div className="flex justify-between gap-3 text-xs text-muted-foreground"><span>Priority: {project.priority}</span><span>{project.due_date ? `Due ${project.due_date}` : 'No due date'}</span></div></CardContent></Card>;
}

export function ProjectDetailsRoute() {
  const { projectUuid = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const projectQuery = useProject(projectUuid);
  const membersQuery = useProjectMembers(projectUuid);
  const teamsQuery = useProjectTeams(projectUuid, hasPermission(user, 'teams.view'));
  const accessibleTeams = useQuery({ queryKey: [...teamKeys.lists(), 'allocation-picker'], queryFn: () => teamApi.list({ per_page: 100 }), enabled: hasPermission(user, 'teams.view') });
  const [candidateSearch, setCandidateSearch] = useState('');
  const debouncedCandidateSearch = useDebouncedValue(candidateSearch.trim());
  const directoryQuery = useProjectDirectory(hasPermission(user, 'users.view_directory'), debouncedCandidateSearch);
  const queryClient = useQueryClient();
  const memberMutation = useMutation({
    mutationFn: async (request: { memberId: number; role?: 'lead' | 'member' | 'viewer'; remove?: boolean }) => {
      if (request.remove) {
        await projectApi.removeMember(projectUuid, request.memberId);
        return;
      }
      await projectApi.updateMember(projectUuid, request.memberId, request.role ?? 'member');
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: teamKeys.all }),
      ]);
    },
  });
  const addMember = useMutation({
    mutationFn: (request: { user_id: number; role: 'lead' | 'member' | 'viewer' }) => projectApi.addMember(projectUuid, request),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
      ]);
    },
  });
  const teamMutation = useMutation({
    mutationFn: async (request: { teamUuid: string; remove?: boolean }) => {
      if (request.remove) {
        await projectApi.deallocateTeam(projectUuid, request.teamUuid);
        return;
      }
      await projectApi.allocateTeam(projectUuid, request.teamUuid);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.teams(projectUuid) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: teamKeys.all }),
      ]);
    },
  });
  const [candidateId, setCandidateId] = useState('');
  const [candidateTeamUuid, setCandidateTeamUuid] = useState('');
  const [candidateRole, setCandidateRole] = useState<'lead' | 'member' | 'viewer'>('member');
  const directoryUsers = directoryQuery.data?.data ?? [];
  const action = useProjectAction('archive');
  const remove = useProjectAction('remove');
  const [confirmAction, setConfirmAction] = useState<'archive' | 'remove' | null>(null);
  const project = projectQuery.data;
  if (projectQuery.isPending) return <div className="flex min-h-48 items-center justify-center"><LoadingState label="Loading project" /></div>;
  if (projectQuery.isError || !project) return <ErrorState description={errorMessage(projectQuery.error)} onRetry={() => void projectQuery.refetch()} title="Project unavailable" />;
  const actorRole = hasGlobalRole(user, 'system-admin') || project.owner?.id === user?.id ? 'owner' : membersQuery.data?.data.find((member) => member.user.id === user?.id)?.role;
  const canLead = actorRole === 'owner' || actorRole === 'lead';
  const canEdit = hasPermission(user, 'projects.update') && canLead;
  const canArchive = hasPermission(user, 'projects.archive') && canLead && project.status !== 'archived';
  const canDelete = hasGlobalRole(user, 'system-admin') || (hasPermission(user, 'projects.delete') && actorRole === 'owner');
  const canManageMembers = hasPermission(user, 'projects.invite') && (actorRole === 'owner' || actorRole === 'lead');
  const canAllocateTeams = hasPermission(user, 'projects.update') && (actorRole === 'owner' || actorRole === 'lead') && hasPermission(user, 'teams.view');
  async function confirm(): Promise<void> {
    try {
      if (confirmAction === 'archive') await action.mutateAsync(projectUuid);
      if (confirmAction === 'remove') { await remove.mutateAsync(projectUuid); navigate('/projects'); }
      setConfirmAction(null);
    } catch {
      // Keep the confirmation open so the user can read the mutation error and retry or cancel.
    }
  }
  return <section aria-labelledby="project-detail-title" className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-2"><Link className="text-sm text-primary hover:underline" to="/projects">Projects</Link><h1 className="text-2xl font-semibold tracking-tight" id="project-detail-title">{project.name}</h1><p className="max-w-3xl text-sm leading-6 text-muted-foreground">{project.description || 'No description provided.'}</p></div><div className="flex flex-wrap gap-2">{canEdit ? <Button asChild variant="outline"><Link to={`/projects/${projectUuid}/edit`}>Edit project</Link></Button> : null}{canArchive ? <Button onClick={() => setConfirmAction('archive')} variant="outline"><Archive aria-hidden="true" className="size-4" />Archive</Button> : null}{canDelete ? <Button onClick={() => setConfirmAction('remove')} variant="destructive"><Trash2 aria-hidden="true" className="size-4" />Delete</Button> : null}</div></header>
    {(action.isError || remove.isError) ? <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{errorMessage(action.error ?? remove.error)}</p> : null}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]"><Card><CardHeader><CardTitle>Project overview</CardTitle><CardDescription>Details returned by the project service.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><Detail label="Status" value={statusLabel(project.status)} /><Detail label="Priority" value={project.priority} /><Detail label="Owner" value={project.owner?.name ?? 'Not listed'} /><Detail label="Members" value={membersQuery.data?.meta.total ?? project.members_count ?? 'Not available'} /><Detail label="Start date" value={project.start_date ?? 'Not set'} /><Detail label="Due date" value={project.due_date ?? 'Not set'} /></CardContent></Card><Card><CardHeader><CardTitle>Project teams</CardTitle><CardDescription>Teams allocated to this workspace.</CardDescription></CardHeader><CardContent className="space-y-3">{!hasPermission(user, 'teams.view') ? <p className="text-sm text-muted-foreground">Your account cannot view allocated team details.</p> : teamsQuery.isPending ? <LoadingState label="Loading project teams" /> : teamsQuery.isError ? <p className="text-sm text-muted-foreground">{errorMessage(teamsQuery.error)}</p> : teamsQuery.data?.data.length ? teamsQuery.data.data.map((team) => <div className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm" key={team.uuid}><Link className="min-w-0 hover:text-primary" to={`/teams/${team.uuid}`}><span className="block truncate font-medium">{team.name}</span><span className="mt-1 block text-muted-foreground">{team.leader?.name ?? 'No team lead listed'}</span></Link>{canAllocateTeams ? <Button disabled={teamMutation.isPending} onClick={() => { if (window.confirm(`Remove ${team.name} from this project?`)) void teamMutation.mutateAsync({ teamUuid: team.uuid, remove: true }); }} size="sm" variant="outline">Remove</Button> : null}</div>) : <p className="text-sm text-muted-foreground">No teams are allocated to this project.</p>}{canAllocateTeams ? <form className="flex gap-2 border-t pt-3" onSubmit={(event) => { event.preventDefault(); if (candidateTeamUuid) void teamMutation.mutateAsync({ teamUuid: candidateTeamUuid }).then(() => setCandidateTeamUuid('')); }}><select aria-label="Select a team to allocate" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2" onChange={(event) => setCandidateTeamUuid(event.target.value)} value={candidateTeamUuid}><option value="">Choose a team</option>{(accessibleTeams.data?.data ?? []).filter((team) => !teamsQuery.data?.data.some((allocated) => allocated.uuid === team.uuid)).map((team) => <option key={team.uuid} value={team.uuid}>{team.name}</option>)}</select><Button disabled={!candidateTeamUuid || teamMutation.isPending} type="submit">Allocate</Button></form> : null}{teamMutation.isError ? <p className="text-sm text-destructive" role="alert">{errorMessage(teamMutation.error)}</p> : null}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>Project members</CardTitle><CardDescription>Contextual project roles, separate from global account roles.</CardDescription></CardHeader><CardContent>{membersQuery.isPending ? <LoadingState label="Loading project members" /> : membersQuery.isError ? <ErrorState description={errorMessage(membersQuery.error)} onRetry={() => void membersQuery.refetch()} title="Members could not be loaded" /> : <><ul className="divide-y">{membersQuery.data?.data.map((member) => {
      const isProjectOwner = member.user.id === project.owner?.id;
      const assignableRoles = actorRole === 'owner' ? ['lead', 'member', 'viewer'] as const : ['member', 'viewer'] as const;
      return <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={member.id}><span className="font-medium">{member.user.name}<span className="ml-2 font-normal text-muted-foreground">{member.user.email}</span></span><div className="flex items-center gap-2"><span className="capitalize text-muted-foreground">{member.role}</span>{canManageMembers && !isProjectOwner ? <><select aria-label={`Change ${member.user.name} project role`} className="h-9 rounded-md border bg-background px-2" onChange={(event) => void memberMutation.mutateAsync({ memberId: member.id, role: event.target.value as 'lead' | 'member' | 'viewer' })} value={member.role}>{assignableRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select><Button disabled={memberMutation.isPending} onClick={() => { if (window.confirm(`Remove ${member.user.name} from this project?`)) void memberMutation.mutateAsync({ memberId: member.id, remove: true }); }} size="sm" variant="outline">Remove</Button></> : null}</div></li>;
    })}</ul>{canManageMembers && hasPermission(user, 'users.view_directory') ? <form className="mt-5 space-y-2 border-t pt-5" onSubmit={(event) => { event.preventDefault(); if (candidateId) void addMember.mutateAsync({ user_id: Number(candidateId), role: candidateRole }).then(() => setCandidateId('')); }}><Input aria-label="Search people to add" maxLength={100} onChange={(event) => { setCandidateSearch(event.target.value); setCandidateId(''); }} placeholder="Search people by name or email" value={candidateSearch} /><div className="flex flex-wrap gap-2"><label className="min-w-48 flex-1 text-sm"><span className="sr-only">Select a person to add</span><select aria-label="Select a person to add" className="h-10 w-full rounded-md border bg-background px-3" onChange={(event) => setCandidateId(event.target.value)} value={candidateId}><option value="">Choose a person</option>{directoryUsers.filter((candidate) => !membersQuery.data?.data.some((member) => member.user.id === candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email}</option>)}</select></label><label className="text-sm"><span className="sr-only">New project role</span><select aria-label="New project role" className="h-10 rounded-md border bg-background px-3" onChange={(event) => setCandidateRole(event.target.value as 'lead' | 'member' | 'viewer')} value={candidateRole}><option value="member">Member</option><option value="viewer">Viewer</option>{actorRole === 'owner' ? <option value="lead">Lead</option> : null}</select></label><Button disabled={!candidateId || addMember.isPending} type="submit">{addMember.isPending ? 'Adding…' : 'Add member'}</Button></div></form> : null}{canManageMembers && !hasPermission(user, 'users.view_directory') ? <p className="mt-4 text-sm text-muted-foreground">The people directory permission is required to choose a member.</p> : null}{addMember.isError || memberMutation.isError ? <p className="mt-3 text-sm text-destructive" role="alert">{errorMessage(addMember.error ?? memberMutation.error)}</p> : null}{directoryQuery.isError && canManageMembers ? <p className="mt-3 text-sm text-muted-foreground">The member picker is unavailable. The directory permission may be required.</p> : null}</>}</CardContent></Card>
    <AlertDialog onOpenChange={(open) => { if (!open && !action.isPending && !remove.isPending) setConfirmAction(null); }} open={Boolean(confirmAction)}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{confirmAction === 'archive' ? 'Archive this project?' : 'Delete this project?'}</AlertDialogTitle><AlertDialogDescription>{confirmAction === 'archive' ? 'The project status will change to archived and its data will remain available.' : 'The project will be soft-deleted and disappear from normal project access.'}</AlertDialogDescription></AlertDialogHeader>
        {(action.isError || remove.isError) ? <p className="text-sm text-destructive" role="alert">{errorMessage(action.error ?? remove.error)}</p> : null}
        <AlertDialogFooter><AlertDialogCancel asChild><Button disabled={action.isPending || remove.isPending} variant="outline">Cancel</Button></AlertDialogCancel><AlertDialogAction asChild><Button disabled={action.isPending || remove.isPending} onClick={(event) => { event.preventDefault(); void confirm(); }} variant="destructive">{action.isPending || remove.isPending ? 'Working…' : confirmAction === 'archive' ? 'Archive project' : 'Delete project'}</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

function Detail({ label, value }: { label: string; value: string | number }) { return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium capitalize">{value}</p></div>; }

function useProjectDirectory(enabled: boolean, search: string) {
  return useQuery({ queryKey: ['users', 'directory', 'project-member-picker', search], queryFn: () => userApi.listDirectory({ per_page: 100, ...(search ? { search } : {}) }), enabled });
}

export function ProjectFormRoute() {
  const { projectUuid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const existing = useProject(projectUuid ?? '');
  const projectMembers = useProjectMembers(projectUuid ?? '');
  const save = useSaveProject(projectUuid);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useForm<ProjectFormValues>({ defaultValues: { name: '', description: '', status: 'planning', priority: 'medium', start_date: '', due_date: '' } });
  const seeded = existing.data;
  const resetForm = form.reset;
  useEffect(() => {
    if (seeded) {
      resetForm({ name: seeded.name, description: seeded.description ?? '', status: seeded.status === 'archived' ? 'completed' : seeded.status, priority: seeded.priority, start_date: seeded.start_date ?? '', due_date: seeded.due_date ?? '' });
    }
  }, [resetForm, seeded]);
  if (projectUuid && existing.isPending) return <div className="flex min-h-48 items-center justify-center"><LoadingState label="Loading project" /></div>;
  if (projectUuid && existing.isError) return <ErrorState description={errorMessage(existing.error)} onRetry={() => void existing.refetch()} title="Project unavailable" />;
  if (projectUuid && !seeded) return <ErrorState description="This project is unavailable." title="Project unavailable" />;
  const actorRole = hasGlobalRole(user, 'system-admin') || seeded?.owner?.id === user?.id ? 'owner' : projectMembers.data?.data.find((member) => member.user.id === user?.id)?.role;
  if (projectUuid && projectMembers.isPending && !existing.isPending) return <div className="flex min-h-48 items-center justify-center"><LoadingState label="Checking project access" /></div>;
  if (projectUuid && seeded && !(hasPermission(user, 'projects.update') && (actorRole === 'owner' || actorRole === 'lead'))) return <ErrorState description="Project editing requires the project update permission and project owner or lead authority." title="Editing unavailable" />;
  if (!projectUuid && !hasPermission(user, 'projects.create')) return <ErrorState description="Your account cannot create projects." title="Creation unavailable" />;
  async function submit(values: ProjectFormValues): Promise<void> {
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
    setErrors({});
    const request: SaveProjectRequest = { name: parsed.data.name, description: parsed.data.description || null, status: parsed.data.status, priority: parsed.data.priority, start_date: parsed.data.start_date || null, due_date: parsed.data.due_date || null };
    try { const project = await save.mutateAsync(request); navigate(`/projects/${project.uuid}`); } catch { /* Mutation error is rendered below. */ }
  }
  return <section className="mx-auto max-w-3xl space-y-6"><header><Link className="text-sm text-primary hover:underline" to={projectUuid ? `/projects/${projectUuid}` : '/projects'}>{projectUuid ? 'Back to project' : 'Projects'}</Link><h1 className="mt-2 text-2xl font-semibold tracking-tight">{projectUuid ? 'Edit project' : 'Create project'}</h1><p className="mt-2 text-sm text-muted-foreground">Set the project details supported by the workspace API.</p></header><Card><CardContent className="pt-6"><form className="space-y-5" noValidate onSubmit={form.handleSubmit(submit)}><Field label="Project name" error={errors.name}><Input {...form.register('name')} autoComplete="off" /></Field><Field label="Description" error={errors.description}><Textarea {...form.register('description')} rows={4} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Status" error={errors.status}><select className="h-10 w-full rounded-md border bg-background px-3" {...form.register('status')}><option value="planning">Planning</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></Field><Field label="Priority" error={errors.priority}><select className="h-10 w-full rounded-md border bg-background px-3" {...form.register('priority')}><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field><Field label="Start date" error={errors.start_date}><Input type="date" {...form.register('start_date')} /></Field><Field label="Due date" error={errors.due_date}><Input type="date" {...form.register('due_date')} /></Field></div>{save.isError ? <p className="text-sm text-destructive" role="alert">{errorMessage(save.error)}</p> : null}<div className="flex justify-end gap-2"><Button asChild variant="outline"><Link to={projectUuid ? `/projects/${projectUuid}` : '/projects'}>Cancel</Link></Button><Button disabled={save.isPending} type="submit">{save.isPending ? 'Saving…' : projectUuid ? 'Save changes' : 'Create project'}</Button></div></form></CardContent></Card></section>;
}

function Field({ label, error, children }: { label: string; error: string | undefined; children: React.ReactNode }) { return <label className="block space-y-1.5 text-sm font-medium">{label}{children}{error ? <span className="block text-xs font-normal text-destructive" role="alert">{error}</span> : null}</label>; }
