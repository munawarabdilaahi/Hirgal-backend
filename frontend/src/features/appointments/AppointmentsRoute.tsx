import { SearchInput } from '@/components/ui/search-input';
import { DateField } from '@/components/ui/date-field';
import { DateTimeField } from '@/components/ui/date-time-field';
import { ActionConfirmation } from '@/components/ui/action-confirmation';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ChoiceOption, ChoiceSelect } from '@/components/ui/choice-select';
import { PageHeader } from '@/components/layout/primitives';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  capabilities?: { update: boolean; delete: boolean };
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
  const [status, setStatus] = useState('');
  const [confirmation, setConfirmation] = useState<'cancel' | 'delete' | null>(null);
  const [range, setRange] = useState(upcomingRange);
  const [rangeError, setRangeError] = useState<string | null>(null);
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
    queryKey: ['appointments', 'calendar', range, page, status],
    enabled: !closeCreateDialog,
    queryFn: async () => (await apiClient.get<ApiPaginatedResponse<Appointment>>('/appointments/calendar', {
      params: { from: `${range.from}T00:00:00Z`, to: `${range.to}T00:00:00Z`, status: status || undefined, page },
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
    mutationFn: ({ url, method, data }: { url: string; method: 'post' | 'put' | 'delete'; data?: Record<string, unknown> }) =>
      apiClient.request<ApiSuccess<{ conflicts?: { has_conflicts: boolean } }>>({ url, method, data }),
    onSuccess: async ({ data }) => {
      setConflict(data.data?.conflicts?.has_conflicts === true);
      closeEditor();
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
  const appointment = detail.data;
  const canUpdate = appointment?.capabilities?.update === true;
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
    }, { onSuccess: () => toast.success(appointment ? 'Appointment updated.' : 'Appointment booked.') });
  }

  const bookingForm = editing && (
        <FormDialog title={appointment ? "Edit appointment" : "Schedule an appointment"} description="Set the booking details and time." pending={mutation.isPending} onClose={closeEditor}>
        <form key={selected ?? 'new'} className="grid gap-4" onSubmit={save}>
          {!selected && (
            <>
              <label>Context
                <ChoiceSelect aria-label="Context" value={context} onValueChange={(nextValue) => { setContext(nextValue); setContextSearch(''); }}>
                  <ChoiceOption value="personal">Personal</ChoiceOption>
                  {hasPermission(user, 'projects.view') && <ChoiceOption value="project">Project</ChoiceOption>}
                  {hasPermission(user, 'teams.view') && <ChoiceOption value="team">Team</ChoiceOption>}
                </ChoiceSelect>
              </label>
              {context !== 'personal' && (
                <>
                  <SearchInput aria-label={`Search ${context}s`} placeholder={`Search ${context}s`} value={contextSearch} onChange={(event) => setContextSearch(event.target.value)} />
                  <ChoiceSelect key={context} name={`${context}_uuid`} aria-label={`Choose ${context}`} required>
                    <ChoiceOption value="">Choose {context}</ChoiceOption>
                    {(context === 'project' ? projects.data : teams.data)?.data.map((item) => (
                      <ChoiceOption key={item.uuid} value={item.uuid}>{item.name}</ChoiceOption>
                    ))}
                  </ChoiceSelect>
                  {(context === 'project' ? projects.isPending : teams.isPending) && <LoadingState label={`Loading ${context}s`} layout="inline" />}
                  {(context === 'project' ? projects.isError : teams.isError) && <p role="alert">The available contexts could not be loaded.</p>}
                </>
              )}
            </>
          )}
          <label>Title<Input name="title" defaultValue={appointment?.title} maxLength={255} required /></label>
          <label>Description<Input name="description" defaultValue={appointment?.description ?? ''} /></label>
          <label>Time zone<Input name="timezone" defaultValue={appointment?.timezone ?? 'UTC'} required /></label>
          <DateTimeField label="Starts at" name="start_time" defaultValue={appointment && formatAppointmentTime(appointment.start_time, appointment.timezone)} />
          <DateTimeField label="Ends at" name="end_time" defaultValue={appointment && formatAppointmentTime(appointment.end_time, appointment.timezone)} />
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
      {!editing && !inviteOpen && !confirmation && mutation.isError && <p role="alert">{Object.values(getApiValidationErrors(mutation.error)).join(' ') || getSafeErrorMessage(mutation.error)}</p>}
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const from = String(fields.get('from'));
        const to = String(fields.get('to'));
        const duration = Date.parse(to) - Date.parse(from);
        if (!Number.isFinite(duration) || duration <= 0 || duration > 90 * 86_400_000) {
          setRangeError('Choose an end date after the start date and a range of at most 90 days.');
          return;
        }
        setRangeError(null);
        setRange({ from, to });
        setPage(1);
      }}>
        <div className="grid gap-2"><label htmlFor="appointment-from">From (UTC)</label><DateField id="appointment-from" aria-label="From (UTC)" name="from" defaultValue={range.from} required /></div>
        <div className="grid gap-2"><label htmlFor="appointment-to">Until (UTC)</label><DateField id="appointment-to" aria-label="Until (UTC)" name="to" defaultValue={range.to} required /></div>
        <label className="grid gap-2 text-sm font-medium">Status
          <ChoiceSelect value={status} onValueChange={(nextValue) => { setStatus(nextValue); setPage(1); }}>
            <ChoiceOption value="">All statuses</ChoiceOption>
            <ChoiceOption value="scheduled">Scheduled</ChoiceOption><ChoiceOption value="confirmed">Confirmed</ChoiceOption>
            <ChoiceOption value="completed">Completed</ChoiceOption><ChoiceOption value="cancelled">Cancelled</ChoiceOption>
          </ChoiceSelect>
        </label>
        <Button type="submit" variant="outline">Show date range</Button>
      </form>
      {rangeError && <p role="alert" className="text-sm text-destructive">{rangeError}</p>}
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
          {canUpdate && active && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>Edit appointment</Button>
              <Button variant="destructive" onClick={() => { mutation.reset(); setConfirmation('cancel'); }}>Cancel appointment</Button>
            </div>
          )}
          {appointment.capabilities?.delete && <Button variant="outline" onClick={() => { mutation.reset(); setConfirmation('delete'); }}>Delete appointment</Button>}
          {confirmation && (
            <ActionConfirmation
              title={confirmation === 'cancel' ? 'Cancel this appointment?' : 'Delete this appointment?'}
              description={confirmation === 'cancel' ? 'The booking will be marked cancelled.' : 'The booking will be removed from your appointments.'}
              action={confirmation === 'cancel' ? 'Cancel appointment' : 'Delete appointment'}
              pending={mutation.isPending} error={mutation.isError ? getSafeErrorMessage(mutation.error) : null}
              onCancel={() => { mutation.reset(); setConfirmation(null); }}
              onConfirm={() => mutation.mutate(
                confirmation === 'cancel' ? { url: `/appointments/${appointment.uuid}/cancel`, method: 'post' }
                  : { url: `/appointments/${appointment.uuid}`, method: 'delete' },
                { onSuccess: () => {
                  if (confirmation === 'delete') {
                    setSelected(null);
                    setPage(1);
                    setSearchParams({}, { replace: true });
                  }
                  setConfirmation(null);
                } },
              )}
            />
          )}
          {canUpdate && active && hasPermission(user, 'users.view_directory') && (
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
