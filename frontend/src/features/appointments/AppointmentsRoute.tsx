import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/components/layout/primitives';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasPermission } from '@/features/auth/permissions';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { apiClient } from '@/services/api/apiClient';
import { projectApi } from '@/services/api/projectApi';
import { teamApi } from '@/services/api/teamApi';
import { DirectoryUserPicker } from '@/features/users/DirectoryUserPicker';
import type { ApiDirectoryUser, ApiPaginatedResponse, ApiSuccess, ApiUser } from '@/services/api/contracts';

export interface Appointment {
  uuid: string;
  title: string;
  description: string | null;
  organizer: { id: number; name: string };
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  participants?: { user_id: number; name?: string; status: string }[];
}

function upcomingRange() {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 30);
  return { from: today, to: end.toISOString().slice(0, 10) };
}

function formatAppointmentTime(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const offset = get('timeZoneName')?.slice(3) || 'Z';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`;
}

export function AppointmentsRoute() {
  const { user } = useAuth();
  return <AppointmentsView user={user} />;
}

export function BookingCreateDialog({ user, onClose }: { user: ApiUser; onClose: () => void }) {
  return <AppointmentsView user={user} closeCreateDialog={onClose} />;
}

function AppointmentsView({ user, closeCreateDialog }: { user: ApiUser | null; closeCreateDialog?: () => void }) {
  const queryClient = useQueryClient();
  const [range, setRange] = useState(upcomingRange);
  const [page, setPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState(() => searchParams.get('appointment'));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState(() => !selected && (Boolean(closeCreateDialog) || searchParams.get('new') === '1') && hasPermission(user, 'appointments.create'));
  const [context, setContext] = useState('personal');
  const [contextSearch, setContextSearch] = useState('');
  const [invitee, setInvitee] = useState<ApiDirectoryUser | null>(null);
  const [conflict, setConflict] = useState(false);
  const appointments = useQuery({
    queryKey: ['appointments', 'calendar', range, page],
    enabled: !closeCreateDialog,
    queryFn: async () => (await apiClient.get<ApiPaginatedResponse<Appointment>>('/appointments/calendar', {
      params: { from: `${range.from}T00:00:00Z`, to: `${range.to}T00:00:00Z`, page },
    })).data,
  });
  const detail = useQuery({
    queryKey: ['appointments', selected],
    queryFn: async () => (await apiClient.get<ApiSuccess<Appointment>>(`/appointments/${selected}`)).data.data,
    enabled: selected !== null,
  });
  const closeEditor = () => {
    setEditing(false);
    if (closeCreateDialog) { closeCreateDialog(); return; }
    if (searchParams.has('new')) setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('new');
      return next;
    }, { replace: true });
  };
  const mutation = useMutation({
    mutationFn: ({ url, method, data }: { url: string; method: 'post' | 'put'; data?: Record<string, unknown> }) =>
      apiClient.request<ApiSuccess<{ conflicts?: { has_conflicts: boolean } }>>({ url, method, data }),
    onSuccess: async ({ data }) => {
      setConflict(data.data?.conflicts?.has_conflicts === true);
      closeEditor();
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
  const appointment = detail.data;
  const organizer = appointment?.organizer.id === user?.id;
  const active = appointment?.status === 'scheduled' || appointment?.status === 'confirmed';
  const participant = appointment?.participants?.find((person) => person.user_id === user?.id);
  const projects = useQuery({
    queryKey: ['projects', 'appointment-picker', contextSearch],
    queryFn: () => projectApi.list({ search: contextSearch, page: 1, per_page: 20 }),
    enabled: editing && !selected && context === 'project' && hasPermission(user, 'projects.view'),
  });
  const teams = useQuery({
    queryKey: ['teams', 'appointment-picker', contextSearch],
    queryFn: () => teamApi.list({ search: contextSearch, page: 1, per_page: 20 }),
    enabled: editing && !selected && context === 'team' && hasPermission(user, 'teams.view'),
  });

  const { hash } = useLocation();
  const targetReady = hash === '#appointment-details' && Boolean(appointment);
  useEffect(() => {
    if (targetReady) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [hash, targetReady]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const data = Object.fromEntries(fields);
    mutation.mutate({
      url: appointment ? `/appointments/${appointment.uuid}` : '/appointments',
      method: appointment ? 'put' : 'post',
      data,
    });
  }

  const bookingForm = editing && (
        <FormDialog title={appointment ? "Edit appointment" : "Schedule an appointment"} description="Set the booking details and time." pending={mutation.isPending} onClose={closeEditor}>
        <form key={selected ?? 'new'} className="grid gap-4" onSubmit={save}>
          {!selected && (
            <>
              <label>Context
                <NativeSelect className="ml-2" value={context} onChange={(event) => { setContext(event.target.value); setContextSearch(''); }}>
                  <option value="personal">Personal</option>
                  {hasPermission(user, 'projects.view') && <option value="project">Project</option>}
                  {hasPermission(user, 'teams.view') && <option value="team">Team</option>}
                </NativeSelect>
              </label>
              {context !== 'personal' && (
                <>
                  <Input aria-label={`Search ${context}s`} placeholder={`Search ${context}s`} value={contextSearch} onChange={(event) => setContextSearch(event.target.value)} />
                  <NativeSelect key={context} name={`${context}_uuid`} aria-label={`Choose ${context}`} required>
                    <option value="">Choose {context}</option>
                    {(context === 'project' ? projects.data : teams.data)?.data.map((item) => (
                      <option key={item.uuid} value={item.uuid}>{item.name}</option>
                    ))}
                  </NativeSelect>
                  {(context === 'project' ? projects.isPending : teams.isPending) && <LoadingState label={`Loading ${context}s`} layout="inline" />}
                  {(context === 'project' ? projects.isError : teams.isError) && <p role="alert">The available contexts could not be loaded.</p>}
                </>
              )}
            </>
          )}
          <label>Title<Input name="title" defaultValue={appointment?.title} maxLength={255} required /></label>
          <label>Description<Input name="description" defaultValue={appointment?.description ?? ''} /></label>
          <label>Time zone<Input name="timezone" defaultValue={appointment?.timezone ?? 'UTC'} required /></label>
          <label>Starts at<Input name="start_time" defaultValue={appointment && formatAppointmentTime(appointment.start_time, appointment.timezone)} placeholder="YYYY-MM-DDThh:mm:ssZ" required /></label>
          <label>Ends at<Input name="end_time" defaultValue={appointment && formatAppointmentTime(appointment.end_time, appointment.timezone)} placeholder="YYYY-MM-DDThh:mm:ssZ" required /></label>
          <p className="text-sm text-muted-foreground">For local times, include the UTC offset for the chosen time zone. Use Z for UTC.</p>
          {mutation.isError && <p role="alert" className="text-sm text-destructive">{Object.values(getApiValidationErrors(mutation.error)).join(' ') || getSafeErrorMessage(mutation.error)}</p>}
          <FormDialogActions pending={mutation.isPending} submitLabel="Save appointment" />
        </form>
        </FormDialog>
      );
  if (closeCreateDialog) return bookingForm;

  return (
    <section className="grid grid-cols-1 gap-4">
      <PageHeader>
        <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
        {hasPermission(user, 'appointments.create') && (
          <Button onClick={() => { setSelected(null); setContext('personal'); setContextSearch(''); setEditing(true); mutation.reset(); }}>Add booking</Button>
        )}
      </PageHeader>
      {conflict && <p role="status">Saved with a scheduling conflict. Review participant availability.</p>}
      {!editing && !inviteOpen && mutation.isError && <p role="alert">{Object.values(getApiValidationErrors(mutation.error)).join(' ') || getSafeErrorMessage(mutation.error)}</p>}
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        setRange({ from: String(fields.get('from')), to: String(fields.get('to')) });
        setPage(1);
      }}>
        <label>From (UTC)<Input type="date" name="from" defaultValue={range.from} required /></label>
        <label>Until (UTC)<Input type="date" name="to" defaultValue={range.to} required /></label>
        <Button type="submit" variant="outline">Show date range</Button>
      </form>
      {appointments.isPending && <LoadingState label="Loading appointments" />}
      {appointments.isError && <ErrorState title="Could not load appointments" description={getSafeErrorMessage(appointments.error)} onRetry={() => void appointments.refetch()} />}
      {appointments.data && (
        <>
          {appointments.data.data.length === 0 && <EmptyState title="No appointments in this range." />}
          <ul className="divide-y rounded-xl border bg-card empty:hidden">
            {appointments.data.data.map((item) => (
              <li key={item.uuid} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <Button className="h-auto max-w-full justify-start text-left whitespace-normal wrap-anywhere" variant="ghost" onClick={() => { setSelected(item.uuid); setInvitee(null); setEditing(false); mutation.reset(); }}>{item.title}</Button>
                <span className="text-sm text-muted-foreground">{new Date(item.start_time).toLocaleString()} · <Badge className="capitalize" variant="secondary">{item.status}</Badge></span>
              </li>
            ))}
          </ul>
          <Pagination currentPage={page} totalPages={appointments.data.meta.last_page} onPageChange={setPage} />
        </>
      )}
      {selected && detail.isPending && <LoadingState label="Loading appointment details" layout="detail" />}
      {detail.isError && <ErrorState title="Could not load appointment" description={getSafeErrorMessage(detail.error)} onRetry={() => void detail.refetch()} />}
      {appointment && (
        <section className="grid gap-3 rounded-lg border p-4" id="appointment-details" aria-label="Appointment details">
          <h2 className="text-lg font-semibold">{appointment.title}</h2>
          <p>{appointment.description}</p>
          <p>{new Date(appointment.start_time).toLocaleString()} to {new Date(appointment.end_time).toLocaleString()}</p>
          <p>Organizer: {appointment.organizer.name}</p>
          {appointment.participants?.map((person) => <p key={person.user_id}>{person.name ?? 'Participant'} · {person.status}</p>)}
          {participant && active && (
            <div className="flex flex-wrap gap-2">
              {(['accepted', 'tentative', 'declined'] as const).map((status) => (
                <Button key={status} variant="outline" disabled={mutation.isPending} onClick={() =>
                  mutation.mutate({ url: `/appointments/${appointment.uuid}/rsvp`, method: 'put', data: { status } })
                }>{status === 'accepted' ? 'Accept' : status === 'tentative' ? 'Tentative' : 'Decline'}</Button>
              ))}
            </div>
          )}
          {organizer && active && hasPermission(user, 'appointments.update') && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>Edit appointment</Button>
              <Button variant="destructive" disabled={mutation.isPending} onClick={() => {
                if (window.confirm('Cancel this appointment?')) mutation.mutate({ url: `/appointments/${appointment.uuid}/cancel`, method: 'post' });
              }}>Cancel appointment</Button>
            </div>
          )}
          {organizer && active && hasPermission(user, 'appointments.update') && hasPermission(user, 'users.view_directory') && (
            <>
            <Button variant="outline" onClick={() => { mutation.reset(); setInvitee(null); setInviteOpen(true); }}>Invite participant</Button>
            {inviteOpen && <FormDialog title="Invite participant" description="Choose a person to invite to this appointment." pending={mutation.isPending} onClose={() => setInviteOpen(false)}>
            <form className="grid gap-2" onSubmit={(event) => {
              event.preventDefault();
              if (invitee) {
                mutation.mutate({
                  url: `/appointments/${appointment.uuid}/participants`,
                  method: 'post',
                  data: { user_id: invitee.id },
                }, { onSuccess: () => { setInvitee(null); setInviteOpen(false); } });
              }
            }}>
              <DirectoryUserPicker ariaLabel="Choose participant" enabled excludeIds={appointment.participants?.map((person) => person.user_id) ?? []} selectedId={String(invitee?.id ?? '')} selectedUser={invitee} onSelect={setInvitee} />
              {mutation.isError && <p role="alert" className="text-sm text-destructive">{getSafeErrorMessage(mutation.error)}</p>}
              <FormDialogActions pending={mutation.isPending} submitDisabled={!invitee} submitLabel="Invite participant" />
            </form>
            </FormDialog>}
            </>
          )}
        </section>
      )}
      {bookingForm}
    </section>
  );
}
