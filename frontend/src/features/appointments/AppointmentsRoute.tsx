import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { ApiDirectoryUser, ApiPaginatedResponse, ApiSuccess } from '@/services/api/contracts';

interface Appointment {
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
  const queryClient = useQueryClient();
  const [range, setRange] = useState(upcomingRange);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [context, setContext] = useState('personal');
  const [contextSearch, setContextSearch] = useState('');
  const [invitee, setInvitee] = useState<ApiDirectoryUser | null>(null);
  const [conflict, setConflict] = useState(false);
  const appointments = useQuery({
    queryKey: ['appointments', 'calendar', range, page],
    queryFn: async () => (await apiClient.get<ApiPaginatedResponse<Appointment>>('/appointments/calendar', {
      params: { from: `${range.from}T00:00:00Z`, to: `${range.to}T00:00:00Z`, page },
    })).data,
  });
  const detail = useQuery({
    queryKey: ['appointments', selected],
    queryFn: async () => (await apiClient.get<ApiSuccess<Appointment>>(`/appointments/${selected}`)).data.data,
    enabled: selected !== null,
  });
  const mutation = useMutation({
    mutationFn: ({ url, method, data }: { url: string; method: 'post' | 'put'; data?: Record<string, unknown> }) =>
      apiClient.request<ApiSuccess<{ conflicts?: { has_conflicts: boolean } }>>({ url, method, data }),
    onSuccess: async ({ data }) => {
      setConflict(data.data?.conflicts?.has_conflicts === true);
      setEditing(false);
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

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Appointments</h1>
        {hasPermission(user, 'appointments.create') && (
          <Button onClick={() => { setSelected(null); setContext('personal'); setContextSearch(''); setEditing(true); mutation.reset(); }}>New appointment</Button>
        )}
      </div>
      {conflict && <p role="status">Saved with a scheduling conflict. Review participant availability.</p>}
      {mutation.isError && <p role="alert">{Object.values(getApiValidationErrors(mutation.error)).join(' ') || getSafeErrorMessage(mutation.error)}</p>}
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
          {appointments.data.data.length === 0 && <p>No appointments in this range.</p>}
          <ul className="grid gap-2">
            {appointments.data.data.map((item) => (
              <li key={item.uuid} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <Button variant="ghost" onClick={() => { setSelected(item.uuid); setInvitee(null); setEditing(false); mutation.reset(); }}>{item.title}</Button>
                <span className="text-sm text-muted-foreground">{new Date(item.start_time).toLocaleString()} · {item.status}</span>
              </li>
            ))}
          </ul>
          <Pagination currentPage={page} totalPages={appointments.data.meta.last_page} onPageChange={setPage} />
        </>
      )}
      {selected && detail.isPending && <LoadingState label="Loading appointment details" />}
      {detail.isError && <ErrorState title="Could not load appointment" description={getSafeErrorMessage(detail.error)} onRetry={() => void detail.refetch()} />}
      {appointment && !editing && (
        <section className="grid gap-3 rounded-lg border p-4" aria-label="Appointment details">
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
            <form className="grid gap-2" onSubmit={(event) => {
              event.preventDefault();
              if (invitee) {
                mutation.mutate({
                  url: `/appointments/${appointment.uuid}/participants`,
                  method: 'post',
                  data: { user_id: invitee.id },
                }, { onSuccess: () => setInvitee(null) });
              }
            }}>
              <DirectoryUserPicker ariaLabel="Choose participant" enabled excludeIds={appointment.participants?.map((person) => person.user_id) ?? []} selectedId={String(invitee?.id ?? '')} selectedUser={invitee} onSelect={setInvitee} />
              <Button type="submit" variant="outline" disabled={!invitee || mutation.isPending}>Invite participant</Button>
            </form>
          )}
        </section>
      )}
      {editing && (
        <form key={selected ?? 'new'} className="grid gap-3 rounded-lg border p-4" onSubmit={save}>
          <h2 className="text-lg font-semibold">{appointment ? 'Edit appointment' : 'Schedule an appointment'}</h2>
          {!selected && (
            <>
              <label>Context
                <select className="ml-2 rounded-md border bg-background p-2" value={context} onChange={(event) => { setContext(event.target.value); setContextSearch(''); }}>
                  <option value="personal">Personal</option>
                  {hasPermission(user, 'projects.view') && <option value="project">Project</option>}
                  {hasPermission(user, 'teams.view') && <option value="team">Team</option>}
                </select>
              </label>
              {context !== 'personal' && (
                <>
                  <Input aria-label={`Search ${context}s`} placeholder={`Search ${context}s`} value={contextSearch} onChange={(event) => setContextSearch(event.target.value)} />
                  <select key={context} name={`${context}_uuid`} aria-label={`Choose ${context}`} className="rounded-md border bg-background p-2" required>
                    <option value="">Choose {context}</option>
                    {(context === 'project' ? projects.data : teams.data)?.data.map((item) => (
                      <option key={item.uuid} value={item.uuid}>{item.name}</option>
                    ))}
                  </select>
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
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={mutation.isPending}>Save appointment</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Close form</Button>
          </div>
        </form>
      )}
    </section>
  );
}
