import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/app/providers/useTheme';
import type { ThemePreference } from '@/app/providers/theme-context';
import { PageHeader } from '@/components/layout/primitives';
import { Alert } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { ChangePasswordDialog } from './ChangePasswordRoute';
import { ProfileForm } from './ProfileRoute';
import { ProfileAvatarEditor } from './ProfileAvatarEditor';
import { accountApi } from '@/services/api/accountApi';
import type { ApiUser, UpdateProfileRequest } from '@/services/api/contracts';

type UserChange = (user: ApiUser) => void;
type SaveProfile = (changes: UpdateProfileRequest) => Promise<ApiUser>;

const sections = {
  profile: 'My profile',
  security: 'Security & login',
  sessions: 'Sessions & devices',
  notifications: 'Notifications',
  preferences: 'Preferences & appearance',
  privacy: 'Privacy & data',
} as const;
type Section = keyof typeof sections;

export function AccountSettings({ user, save, onUserChanged }: { user: ApiUser; save: SaveProfile; onUserChanged: UserChange }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section') ?? 'profile';
  const section: Section = Object.hasOwn(sections, requested) ? requested as Section : 'profile';
  const complete = [user.avatar_url, user.name, user.email_verified_at, user.profile?.phone, user.profile?.job_title, user.profile?.department, user.profile?.bio].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader eyebrow="Your account" title="Account settings" description="Manage your profile, sign-in security, devices, and personal preferences." />
      <div className="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <Avatar className="size-10">{user.avatar_url && <AvatarImage src={user.avatar_url} />}<AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              <Badge variant="secondary" className="mt-1 capitalize">{user.account_status}</Badge>
            </div>
          </div>
          <nav aria-label="Account settings sections" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {(Object.entries(sections) as [Section, string][]).map(([key, label]) => (
              <Button className="h-auto justify-start whitespace-normal text-left" key={key} aria-current={section === key ? 'page' : undefined} variant={section === key ? 'secondary' : 'ghost'} onClick={() => setParams(key === 'profile' ? {} : { section: key })}>{label}</Button>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 space-y-4" aria-label={sections[section]}>
          <h2 className="text-lg font-semibold">{sections[section]}</h2>
          {section === 'profile' && <>
            <ProfileForm user={user} save={save} />
            <SettingsCard title="Profile picture" description="Upload a JPEG, PNG, or WebP image up to 5 MB.">
              <ProfileAvatarEditor user={user} onChanged={onUserChanged} />
            </SettingsCard>
            <SettingsCard title="Profile completion" description={`${complete} of 7 profile items complete.`}>
              <progress aria-label="Profile completion" className="h-2 w-full accent-primary" max={7} value={complete} />
            </SettingsCard>
            <EmailSettings onChanged={onUserChanged} />
          </>}
          {section === 'security' && <SecuritySettings user={user} />}
          {section === 'sessions' && <SessionSettings user={user} />}
          {section === 'notifications' && <NotificationSettings user={user} save={save} />}
          {section === 'preferences' && <AppearanceSettings user={user} save={save} />}
          {section === 'privacy' && <PrivacySettings />}
        </section>
      </div>
    </div>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>;
}

function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'Unavailable';
}

function LoadingRows() {
  return <div className="grid gap-3" role="status" aria-label="Loading account information">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-12 rounded-md" />)}</div>;
}

function SecuritySettings({ user }: { user: ApiUser }) {
  const activity = useQuery({ queryKey: ['account', user.id, 'activity'], queryFn: accountApi.activity });
  return <>
    <SettingsCard title="Password" description="Update your password using your current credentials."><ChangePasswordDialog onChanged={() => { void activity.refetch(); }} /></SettingsCard>
    <SettingsCard title="Recent security activity" description={`Last successful sign-in: ${date(user.last_login_at)}`}>
      {activity.isPending ? <LoadingRows /> : activity.isError ? <Alert role="alert" variant="destructive">Unable to load security activity. <Button variant="link" onClick={() => void activity.refetch()}>Retry</Button></Alert> :
        activity.data.length ? <ul className="divide-y">{activity.data.map((event) => <li key={event.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{event.description}</span><time className="text-muted-foreground" dateTime={event.created_at}>{date(event.created_at)}</time></li>)}</ul> : <p className="text-sm text-muted-foreground">No security events have been recorded.</p>}
    </SettingsCard>
  </>;
}

function SessionSettings({ user }: { user: ApiUser }) {
  const sessions = useQuery({ queryKey: ['account', user.id, 'sessions'], queryFn: accountApi.sessions });
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<string>();
  const hasOthers = sessions.data?.sessions.some((entry) => !entry.current);
  return <SettingsCard title="Active sessions" description="Review browser sessions and signed-in Hirgal clients. Revoking a session signs out that device.">
    {sessions.isPending ? <LoadingRows /> : sessions.isError ? <Alert role="alert" variant="destructive">Unable to load your sessions. <Button variant="link" onClick={() => void sessions.refetch()}>Retry</Button></Alert> : <>
      {!sessions.data.tracks_browser_sessions && <p className="mb-3 text-sm text-muted-foreground">This installation does not provide a list of browser sessions.</p>}
      {sessions.data.sessions.length ? <ul className="divide-y">{sessions.data.sessions.map((entry) => <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
        <div className="min-w-0 flex-1 space-y-1"><div className="flex flex-wrap items-center gap-2 font-medium">{entry.kind === 'browser' ? 'Browser session' : entry.label}{entry.current && <Badge variant="secondary">Current session</Badge>}</div>
          {entry.kind === 'browser' && <p className="wrap-anywhere text-xs text-muted-foreground">{entry.label}</p>}
          <p className="text-xs text-muted-foreground">Last active: {date(entry.last_active_at)}{entry.ip_address ? ` · IP: ${entry.ip_address}` : ''}</p>
          {entry.created_at && <p className="text-xs text-muted-foreground">Signed in: {date(entry.created_at)}</p>}
        </div>{!entry.current && <Button variant="outline" size="sm" onClick={() => setTarget(entry.id)}>Revoke</Button>}
      </li>)}</ul> : <p className="text-sm text-muted-foreground">No tracked sessions were found.</p>}
      {hasOthers && sessions.data.tracks_browser_sessions && <Button className="mt-4" variant="outline" onClick={() => setTarget('others')}>Sign out other devices</Button>}
    </>}
    {target && <PasswordAction title={target === 'others' ? 'Sign out other devices?' : 'Revoke this session?'} description="Confirm with your password. Your current session will stay active." action="Confirm sign out" onClose={() => setTarget(undefined)} execute={async (password) => {
      await accountApi.revoke(target, password);
      void sessions.refetch();
      void queryClient.invalidateQueries({ queryKey: ['account', user.id, 'activity'] });
      toast.success('Session access revoked.');
    }} />}
  </SettingsCard>;
}

function NotificationSettings({ user, save }: { user: ApiUser; save: SaveProfile }) {
  const preferences = user.profile?.notification_preferences;
  const [email, setEmail] = useState(preferences?.email !== false);
  const [inApp, setInApp] = useState(preferences?.in_app !== false);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await save({ notification_preferences: { ...preferences, email, in_app: inApp } });
      toast.success('Notification preferences saved.');
    } catch (error) { toast.error(getSafeErrorMessage(error)); }
    finally { setPending(false); }
  }
  return <SettingsCard title="Notification channels" description="Choose how to receive supported workspace updates. Invitations and security messages are separate.">
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <label className="flex items-center gap-3 text-sm"><Checkbox checked={email} onCheckedChange={(value) => setEmail(value === true)} />Appointment emails</label>
      <label className="flex items-center gap-3 text-sm"><Checkbox checked={inApp} onCheckedChange={(value) => setInApp(value === true)} />In-app appointments and task reminders</label>
      <Button loading={pending}>Save notifications</Button>
    </form>
  </SettingsCard>;
}

function AppearanceSettings({ user, save }: { user: ApiUser; save: SaveProfile }) {
  const { preference, setPreference } = useTheme();
  const [theme, setTheme] = useState<ThemePreference>(['light', 'dark', 'system'].includes(user.profile?.theme_preference ?? '') ? user.profile!.theme_preference as ThemePreference : preference);
  const [timezone, setTimezone] = useState(user.timezone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      await save({ theme_preference: theme, timezone: timezone.trim() || 'UTC' });
      setPreference(theme);
      toast.success('Appearance preferences saved.');
    } catch (error) { setError(getApiValidationErrors(error).timezone ?? getSafeErrorMessage(error)); }
    finally { setPending(false); }
  }
  return <SettingsCard title="Appearance and region" description="Save your preferred theme and time zone to your account.">
    <form className="max-w-sm space-y-4" onSubmit={(event) => void submit(event)}>
      <FormField htmlFor="settings-theme" label="Theme">{(control) => <Select value={theme} onValueChange={(value: ThemePreference) => setTheme(value)}>
        <SelectTrigger {...control}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="system">Follow system</SelectItem></SelectContent>
      </Select>}</FormField>
      <FormField htmlFor="settings-timezone" label="Time zone" description="Use an IANA time zone such as Africa/Nairobi." error={error}>{(control) => <Input {...control} value={timezone} onChange={(event) => setTimezone(event.target.value)} />}</FormField>
      <Button loading={pending}>Save preferences</Button>
    </form>
  </SettingsCard>;
}

function EmailSettings({ onChanged }: { onChanged: UserChange }) {
  const [stage, setStage] = useState<'send' | 'verify'>();
  return <SettingsCard title="Email address" description="Hirgal keeps your current address until you confirm the code sent to the new one.">
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setStage('send')}>Change email</Button><Button variant="ghost" onClick={() => setStage('verify')}>Enter verification code</Button></div>
    {stage && <EmailChangeDialog key={stage} stage={stage} onClose={() => setStage(undefined)} onChanged={onChanged} onCodeSent={() => setStage('verify')} />}
  </SettingsCard>;
}

function EmailChangeDialog({ stage, onClose, onChanged, onCodeSent }: { stage: 'send' | 'verify'; onClose: () => void; onChanged: UserChange; onCodeSent: () => void }) {
  const [value, setValue] = useState('');
  return <PasswordAction title={stage === 'send' ? 'Change email address' : 'Verify your new email'}
    description={stage === 'send' ? 'Confirm your current password to request a verification code.' : 'Enter the code from your new inbox and confirm your current password.'}
    action={stage === 'send' ? 'Send verification code' : 'Verify email'} onClose={onClose} closeOnSuccess={stage === 'verify'}
    fields={(errors) => <FormField htmlFor="settings-email-change" required label={stage === 'send' ? 'New email address' : 'Verification code'} error={errors[stage === 'send' ? 'email' : 'code']}>
      {(control) => <Input {...control} type={stage === 'send' ? 'email' : 'text'} autoComplete={stage === 'send' ? 'email' : 'one-time-code'} value={value} onChange={(event) => setValue(event.target.value)} />}
    </FormField>}
    execute={async (password) => {
      if (stage === 'send') {
        await accountApi.requestEmail(value.trim(), password);
        toast.success('Check your new inbox for a verification code.');
        onCodeSent();
      } else {
        onChanged(await accountApi.confirmEmail(value.trim(), password));
        toast.success('Your new email address has been verified.');
      }
    }} />;
}

function PrivacySettings() {
  const [open, setOpen] = useState(false);
  return <SettingsCard title="Download account data" description="Export your identity, profile, and preferences as a JSON file. Workspace records and authentication credentials are excluded.">
    <Button variant="outline" onClick={() => setOpen(true)}>Download personal data</Button>
    {open && <PasswordAction title="Download personal data" description="Confirm your password before downloading account information. Keep the file somewhere private." action="Download data" onClose={() => setOpen(false)} execute={async (password) => {
      const data = await accountApi.export(password);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const download = document.createElement('a');
      download.href = url;
      download.download = 'hirgal-account-data.json';
      download.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }} />}
  </SettingsCard>;
}

function PasswordAction({ title, description, action, onClose, execute, fields, closeOnSuccess = true }: {
  title: string; description: string; action: string; onClose: () => void; execute: (password: string) => Promise<void>;
  fields?: (errors: Record<string, string>) => ReactNode; closeOnSuccess?: boolean;
}) {
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    setErrors({});
    try {
      await execute(password);
      if (closeOnSuccess) onClose();
    } catch (error) {
      const validation = getApiValidationErrors(error);
      setErrors(validation);
      if (!Object.keys(validation).length) setError(getSafeErrorMessage(error));
    } finally { setPending(false); }
  }
  return <FormDialog title={title} description={description} onClose={onClose} pending={pending}>
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      {error && <Alert variant="destructive" role="alert">{error}</Alert>}
      {fields?.(errors)}
      <FormField htmlFor="settings-current-password" label="Current password" error={errors.current_password} required>
        {(control) => <Input {...control} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />}
      </FormField>
      <FormDialogActions submitLabel={action} pending={pending} />
    </form>
  </FormDialog>;
}
