import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Search, Trash2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { UserIdentity } from '@/components/ui/user-identity';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasGlobalRole, hasPermission } from '@/features/auth/permissions';
import { useDebouncedValue } from '@/features/users/use-debounced-value';
import { DirectoryUserPicker } from '@/features/users/DirectoryUserPicker';
import { teamApi } from '@/services/api/teamApi';
import type { ApiDirectoryUser, ApiTeam } from '@/services/api/contracts';
import { teamKeys, useAllTeamMembers, useTeam, useTeamAction, useTeamMembers, useTeams, useSaveTeam } from './team-queries';

const teamSchema = z.object({
  name: z.string().trim().min(1, 'Enter a team name.').max(255, 'Use 255 characters or fewer.'),
  description: z.string().max(5000, 'Use 5000 characters or fewer.'),
  leader_id: z.string(),
});
type TeamFormValues = z.infer<typeof teamSchema>;

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = error.status;
    if (status === 403) return 'You no longer have permission to access this team.';
    if (status === 404) return 'This team is unavailable or outside your access scope.';
    if (status === 422) return 'The team details were rejected. Check that the leader exists and meets project roster requirements.';
  }
  return 'Hirgal could not complete this request. Check your connection and try again.';
}

function memberErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    if (error.status === 422) {
      return 'The member could not be added. They must belong to every project allocated to this team. Refresh the roster and try again.';
    }

    if (error.status === 403) return 'You no longer have permission to manage this team.';
    if (error.status === 404) return 'This team is unavailable or outside your access scope.';
  }

  return 'Hirgal could not add this member. Check your connection and try again.';
}

export function TeamsRoute() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const query = useTeams({ page, per_page: 12, ...(debouncedSearch ? { search: debouncedSearch } : {}) }, search.trim() === debouncedSearch);
  const teams = query.data?.data ?? [];
  return <section aria-labelledby="teams-title" className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div className="space-y-2"><p className="text-sm font-medium text-primary">People &amp; delivery</p><h1 className="text-2xl font-semibold tracking-tight" id="teams-title">Teams</h1><p className="max-w-2xl text-sm leading-6 text-muted-foreground">Browse teams you lead, belong to, or share a project with.</p></div>{hasPermission(user, 'teams.create') ? <Button asChild><Link to="/teams/new"><Plus aria-hidden="true" className="size-4" />New team</Link></Button> : null}</header>
    <Card><CardContent className="pt-6"><label className="relative block"><span className="sr-only">Search teams</span><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" maxLength={100} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search teams" value={search} /></label></CardContent></Card>
    {query.isPending ? <div aria-label="Loading teams" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status"><span className="sr-only">Loading teams</span>{Array.from({ length: 6 }, (_, index) => <Card aria-hidden="true" className="space-y-4 p-6" key={index}><div className="flex justify-between"><Skeleton className="size-5" /><Skeleton className="h-4 w-20" /></div><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /><div className="flex items-center gap-3 pt-2"><Skeleton className="size-9 rounded-full" /><Skeleton className="h-4 w-28" /></div></Card>)}</div> : query.isError ? <ErrorState description={errorMessage(query.error)} onRetry={() => void query.refetch()} title="Teams could not be loaded" /> : teams.length === 0 ? <EmptyState description="Teams you can access will appear here. Try another search or create a team if you have permission." title="No teams found" /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{teams.map((team) => <TeamCard key={team.uuid} team={team} />)}</div>}
    {query.data?.meta ? <Pagination currentPage={query.data.meta.current_page} onPageChange={setPage} totalPages={query.data.meta.last_page} /> : null}
  </section>;
}

function TeamCard({ team }: { team: ApiTeam }) {
  return <Card className="transition-shadow hover:shadow-md"><CardHeader className="gap-3"><div className="flex items-center justify-between"><UsersRound aria-hidden="true" className="size-5 text-primary" /><span className="text-xs text-muted-foreground">{team.members_count ?? 0} members</span></div><CardTitle><Link className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/teams/${team.uuid}`}>{team.name}</Link></CardTitle><CardDescription>{team.description || 'No description provided.'}</CardDescription></CardHeader><CardContent className="text-sm">{team.leader ? <UserIdentity name={team.leader.name} detail={team.leader.job_title ?? 'Team leader'} imageUrl={team.leader.avatar_url} /> : <p className="text-muted-foreground">No team lead listed</p>}</CardContent></Card>;
}

export function TeamDetailsRoute() {
  const { teamUuid = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const teamQuery = useTeam(teamUuid);
  const [membersPageState, setMembersPageState] = useState<{ teamUuid: string; page: number } | null>(null);
  const membersPage = membersPageState?.teamUuid === teamUuid ? membersPageState.page : 1;
  function setMembersPage(page: number): void {
    setMembersPageState({ teamUuid, page });
  }
  const membersQuery = useTeamMembers(teamUuid, membersPage);
  const completeRosterQuery = useAllTeamMembers(teamUuid);
  const queryClient = useQueryClient();
  const memberMutation = useMutation({
    mutationFn: async (request: { memberId: number; role?: 'leader' | 'member'; remove?: boolean }) => {
      if (request.remove) {
        await teamApi.removeMember(teamUuid, request.memberId);
        return;
      }
      await teamApi.updateMember(teamUuid, request.memberId, request.role ?? 'member');
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teamKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
    },
  });
  const addMember = useMutation({
    mutationFn: (request: { user_id: number; role: 'leader' | 'member' }) => teamApi.addMember(teamUuid, request),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teamKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
    },
  });
  const [candidateUser, setCandidateUser] = useState<ApiDirectoryUser | null>(null);
  const [candidateRole, setCandidateRole] = useState<'leader' | 'member'>('member');
  const remove = useTeamAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const team = teamQuery.data;
  if (teamQuery.isPending) return <div className="flex min-h-48 items-center justify-center"><LoadingState label="Loading team" /></div>;
  if (teamQuery.isError || !team) return <ErrorState description={errorMessage(teamQuery.error)} onRetry={() => void teamQuery.refetch()} title="Team unavailable" />;
  const contextualLeader = team.leader?.id === user?.id || completeRosterQuery.data?.some((member) => member.user.id === user?.id && member.role === 'leader');
  const canEdit = hasPermission(user, 'teams.update') && (contextualLeader || hasGlobalRole(user, 'system-admin'));
  const canDelete = hasPermission(user, 'teams.delete') || hasGlobalRole(user, 'system-admin');
  const canManageMembers = hasPermission(user, 'teams.manage') && (contextualLeader || hasGlobalRole(user, 'system-admin'));
  async function confirm(): Promise<void> {
    try { await remove.mutateAsync(teamUuid); navigate('/teams'); } catch { /* Error remains in the dialog for the user. */ }
  }
  return <section aria-labelledby="team-detail-title" className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-2"><Link className="text-sm text-primary hover:underline" to="/teams">Teams</Link><h1 className="text-2xl font-semibold tracking-tight" id="team-detail-title">{team.name}</h1><p className="max-w-3xl text-sm leading-6 text-muted-foreground">{team.description || 'No description provided.'}</p></div><div className="flex gap-2">{canEdit ? <Button asChild variant="outline"><Link to={`/teams/${teamUuid}/edit`}>Edit team</Link></Button> : null}{canDelete ? <Button onClick={() => setConfirmDelete(true)} variant="destructive"><Trash2 aria-hidden="true" className="size-4" />Delete</Button> : null}</div></header>
    {completeRosterQuery.isPending ? <p className="text-sm text-muted-foreground" role="status">Checking team permissions…</p> : null}
    {completeRosterQuery.isError ? <ErrorState description="Team permissions could not be verified. Retry before managing this team." onRetry={() => void completeRosterQuery.refetch()} title="Team permissions unavailable" /> : null}
    {remove.isError ? <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{errorMessage(remove.error)}</p> : null}
    <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle>Team lead</CardTitle></CardHeader><CardContent>{team.leader ? <UserIdentity name={team.leader.name} detail={team.leader.email} imageUrl={team.leader.avatar_url} /> : <p className="text-sm text-muted-foreground">No lead assigned.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Roster size</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{membersQuery.data?.meta.total ?? team.members_count ?? '—'}</p><p className="text-sm text-muted-foreground">Members returned by the team roster API</p></CardContent></Card><Card><CardHeader><CardTitle>Team workspace</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">The team response does not include allocated project details. Project allocations are listed from a project’s detail page.</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Team members</CardTitle><CardDescription>Team roster roles are distinct from global account roles.</CardDescription></CardHeader><CardContent>{membersQuery.isPending ? <LoadingState label="Loading team members" /> : membersQuery.isError ? <ErrorState description={errorMessage(membersQuery.error)} onRetry={() => void membersQuery.refetch()} title="Members could not be loaded" /> : <><ul className="divide-y">{membersQuery.data?.data.map((member) => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={member.id}><UserIdentity name={member.user.name} detail={member.user.email} imageUrl={member.user.avatar_url} /><div className="flex items-center gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-muted-foreground">{member.role}</span>{canManageMembers && member.user.id !== team.leader?.id ? <><select aria-label={`Change ${member.user.name} team role`} className="h-9 rounded-md border bg-background px-2" onChange={(event) => void memberMutation.mutateAsync({ memberId: member.id, role: event.target.value as 'leader' | 'member' })} value={member.role}><option value="leader">Leader</option><option value="member">Member</option></select><Button disabled={memberMutation.isPending} onClick={() => { if (window.confirm(`Remove ${member.user.name} from this team?`)) void memberMutation.mutateAsync({ memberId: member.id, remove: true }); }} size="sm" variant="outline">Remove</Button></> : null}</div></li>)}</ul>{membersQuery.data?.meta ? <Pagination currentPage={membersQuery.data.meta.current_page} onPageChange={setMembersPage} totalPages={membersQuery.data.meta.last_page} /> : null}{canManageMembers && hasPermission(user, 'users.view_directory') ? <form className="mt-5 flex flex-wrap items-end gap-2 border-t pt-5" onSubmit={(event) => { event.preventDefault(); if (candidateUser) addMember.mutate({ user_id: candidateUser.id, role: candidateRole }, { onSuccess: () => setCandidateUser(null) }); }}><div className="min-w-48 flex-1"><DirectoryUserPicker ariaLabel="Select a person to add" enabled={canManageMembers && !completeRosterQuery.isPending && !completeRosterQuery.isError} excludeIds={(completeRosterQuery.data ?? []).map((member) => member.user.id)} onSelect={setCandidateUser} selectedId={candidateUser ? String(candidateUser.id) : ''} selectedUser={candidateUser} /></div><label className="text-sm"><span className="sr-only">New team role</span><select aria-label="New team role" className="h-10 rounded-md border bg-background px-3" onChange={(event) => setCandidateRole(event.target.value as 'leader' | 'member')} value={candidateRole}><option value="member">Member</option><option value="leader">Leader</option></select></label><Button disabled={!candidateUser || addMember.isPending || completeRosterQuery.isPending || completeRosterQuery.isError} type="submit">{addMember.isPending ? 'Adding…' : 'Add member'}</Button></form> : null}{canManageMembers && !hasPermission(user, 'users.view_directory') ? <p className="mt-4 text-sm text-muted-foreground">The people directory permission is required to choose a member.</p> : null}{addMember.isError ? <p className="mt-3 text-sm text-destructive" role="alert">{memberErrorMessage(addMember.error)}</p> : null}{memberMutation.isError ? <p className="mt-3 text-sm text-destructive" role="alert">{errorMessage(memberMutation.error)}</p> : null}</>}</CardContent></Card>
    <AlertDialog onOpenChange={(open) => { if (!open && !remove.isPending) setConfirmDelete(false); }} open={confirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete this team?</AlertDialogTitle><AlertDialogDescription>The team will be soft-deleted and removed from normal team access.</AlertDialogDescription></AlertDialogHeader>
        {remove.isError ? <p className="text-sm text-destructive" role="alert">{errorMessage(remove.error)}</p> : null}
        <AlertDialogFooter><AlertDialogCancel asChild><Button disabled={remove.isPending} variant="outline">Cancel</Button></AlertDialogCancel><AlertDialogAction asChild><Button disabled={remove.isPending} onClick={(event) => { event.preventDefault(); void confirm(); }} variant="destructive">{remove.isPending ? 'Deleting…' : 'Delete team'}</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

export function TeamFormRoute() {
  const { teamUuid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const existing = useTeam(teamUuid ?? '');
  const existingMembers = useAllTeamMembers(teamUuid ?? '');
  const save = useSaveTeam(teamUuid);
  const canChooseLeader = hasPermission(user, 'users.view_directory');
  const [leaderSelection, setLeaderSelection] = useState<{ teamUuid: string | undefined; user: ApiDirectoryUser | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useForm<TeamFormValues>({ defaultValues: { name: '', description: '', leader_id: '' } });
  const team = existing.data;
  const resetForm = form.reset;
  useEffect(() => {
    if (team) {
      resetForm({ name: team.name, description: team.description ?? '', leader_id: team.leader ? String(team.leader.id) : '' });
    }
  }, [resetForm, team]);
  if (teamUuid && existing.isPending) return <div className="flex min-h-48 items-center justify-center"><LoadingState label="Loading team" /></div>;
  if (teamUuid && existing.isError) return <ErrorState description={errorMessage(existing.error)} onRetry={() => void existing.refetch()} title="Team unavailable" />;
  if (teamUuid && !team) return <ErrorState description="This team is unavailable." title="Team unavailable" />;
  if (teamUuid && existingMembers.isError) return <ErrorState description="Team permissions could not be verified. Retry before editing this team." onRetry={() => void existingMembers.refetch()} title="Team permissions unavailable" />;
  if (teamUuid && existingMembers.isPending && !existing.isPending) return <div className="flex min-h-48 items-center justify-center"><LoadingState label="Checking team access" /></div>;
  const contextualLeader = team?.leader?.id === user?.id || existingMembers.data?.some((member) => member.user.id === user?.id && member.role === 'leader');
  const selectedLeader = leaderSelection && leaderSelection.teamUuid === teamUuid ? leaderSelection.user : team?.leader ?? null;
  if (teamUuid && !(hasPermission(user, 'teams.update') && (contextualLeader || hasGlobalRole(user, 'system-admin')))) return <ErrorState description="Team editing requires the team update permission and contextual leadership authority." title="Editing unavailable" />;
  if (!teamUuid && !hasPermission(user, 'teams.create')) return <ErrorState description="Your account cannot create teams." title="Creation unavailable" />;
  async function submit(values: TeamFormValues): Promise<void> {
    const parsed = teamSchema.safeParse(values);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
    setErrors({});
    try { const saved = await save.mutateAsync({ name: parsed.data.name, description: parsed.data.description || null, ...(parsed.data.leader_id ? { leader_id: Number(parsed.data.leader_id) } : teamUuid ? {} : { leader_id: null }) }); navigate(`/teams/${saved.uuid}`); } catch { /* Mutation error is rendered below. */ }
  }
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link className="text-sm text-primary hover:underline" to={teamUuid ? `/teams/${teamUuid}` : '/teams'}>{teamUuid ? 'Back to team' : 'Teams'}</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{teamUuid ? 'Edit team' : 'Create team'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Team leadership and roster eligibility are enforced by the API.</p>
      </header>
      <Card><CardContent className="pt-6">
        <form className="space-y-5" noValidate onSubmit={form.handleSubmit(submit)}>
          <Field label="Team name" error={errors.name}><Input {...form.register('name')} /></Field>
          <Field label="Description" error={errors.description}><Textarea {...form.register('description')} rows={4} /></Field>
          <div className="space-y-1.5 text-sm font-medium">
            <span className="block">Team lead</span>
            <DirectoryUserPicker ariaLabel="Team lead" enabled={canChooseLeader} onSelect={(leader) => { setLeaderSelection({ teamUuid, user: leader }); form.setValue('leader_id', leader ? String(leader.id) : '', { shouldDirty: true }); }} selectedId={selectedLeader ? String(selectedLeader.id) : ''} selectedUser={selectedLeader} />
            <span className="block text-xs font-normal text-muted-foreground">A replacement lead must belong to every project allocated to the team. Directory access is needed to choose a lead. When editing, clearing the selection leaves the current lead unchanged.</span>
            {errors.leader_id ? <span className="block text-xs font-normal text-destructive" role="alert">{errors.leader_id}</span> : null}
          </div>
          {save.isError ? <p className="text-sm text-destructive" role="alert">{errorMessage(save.error)}</p> : null}
          <div className="flex justify-end gap-2"><Button asChild variant="outline"><Link to={teamUuid ? `/teams/${teamUuid}` : '/teams'}>Cancel</Link></Button><Button disabled={save.isPending} type="submit">{save.isPending ? 'Saving…' : teamUuid ? 'Save changes' : 'Create team'}</Button></div>
        </form>
      </CardContent></Card>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error: string | undefined; children: React.ReactNode }) { return <label className="block space-y-1.5 text-sm font-medium">{label}{children}{error ? <span className="block text-xs font-normal text-destructive" role="alert">{error}</span> : null}</label>; }
