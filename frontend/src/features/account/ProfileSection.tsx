import { useEffect, useState, type FormEvent } from 'react';
import { AtSign, BriefcaseBusiness, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { accountApi } from '@/services/api/accountApi';
import type { ApiUser, ApiUserProfile, UpdateProfileRequest } from '@/services/api/contracts';
import { ProfileAvatarEditor } from './ProfileAvatarEditor';
import { formatDateTime, SettingsCard } from './shared';

function completion(user: ApiUser, profile: ApiUserProfile | null): { score: number; items: string[]; missing: string[] } {
  const checks: [string, boolean][] = [
    ['Profile picture', Boolean(user.avatar_url)],
    ['Job title', Boolean(profile?.job_title)],
    ['Department', Boolean(profile?.department)],
    ['Phone number', Boolean(profile?.phone)],
    ['Bio', Boolean(profile?.bio)],
    ['Email verified', Boolean(user.email_verified_at)],
    ['Two-factor authentication', Boolean(user.two_factor_enabled)],
  ];
  const items = checks.filter(([, done]) => done).map(([label]) => label);
  const missing = checks.filter(([, done]) => !done).map(([label]) => label);
  return { score: Math.round((items.length / checks.length) * 100), items, missing };
}

export function ProfileSection({
  user,
  profile,
  save,
  onUserChanged,
  timeFormat,
}: {
  user: ApiUser;
  profile: ApiUserProfile | null;
  save: (payload: UpdateProfileRequest) => Promise<void>;
  onUserChanged: (user: ApiUser) => void;
  timeFormat: string;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [jobTitle, setJobTitle] = useState(profile?.job_title ?? '');
  const [department, setDepartment] = useState(profile?.department ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [emailDialog, setEmailDialog] = useState<'request' | 'confirm' | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  useEffect(() => {
    setPhone(profile?.phone ?? '');
    setJobTitle(profile?.job_title ?? '');
    setDepartment(profile?.department ?? '');
    setBio(profile?.bio ?? '');
  }, [profile?.phone, profile?.job_title, profile?.department, profile?.bio]);

  const progress = completion(user, profile);

  const dirty = name !== user.name
    || phone !== (profile?.phone ?? '')
    || jobTitle !== (profile?.job_title ?? '')
    || department !== (profile?.department ?? '')
    || bio !== (profile?.bio ?? '');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setError(undefined);
    try {
      await save({
        name: name.trim(),
        phone: phone.trim() || null,
        job_title: jobTitle.trim() || null,
        department: department.trim() || null,
        bio: bio.trim() || null,
      });
      toast.success('Profile updated.');
    } catch (caught) {
      const validation = getApiValidationErrors(caught);
      setErrors(validation);
      if (!Object.keys(validation).length) {
        setError(getSafeErrorMessage(caught));
      }
    } finally {
      setPending(false);
    }
  }

  function closeEmail() {
    setEmailDialog(null);
    setEmail('');
    setCode('');
    setPassword('');
    setErrors({});
    setError(undefined);
  }

  async function requestEmail(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setError(undefined);
    try {
      await accountApi.requestEmail(email.trim(), password);
      toast.success('Verification code sent to the new address.');
      setCode('');
      setPassword('');
      setEmailDialog('confirm');
    } catch (caught) {
      const validation = getApiValidationErrors(caught);
      setErrors(validation);
      if (!Object.keys(validation).length) {
        setError(getSafeErrorMessage(caught));
      }
    } finally {
      setPending(false);
    }
  }

  async function confirmEmail(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setError(undefined);
    try {
      const updated = await accountApi.confirmEmail(code.trim(), password);
      onUserChanged(updated);
      toast.success('Email address updated.');
      closeEmail();
    } catch (caught) {
      const validation = getApiValidationErrors(caught);
      setErrors(validation);
      if (!Object.keys(validation).length) {
        setError(getSafeErrorMessage(caught));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <SettingsCard
        description="This is how you appear to teammates across Hirgal."
        title="Profile picture"
      >
        <ProfileAvatarEditor onChanged={onUserChanged} user={user} />
      </SettingsCard>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SettingsCard
          description="Keep your contact details and role information up to date."
          footer={
            <div className="flex justify-end">
              <Button disabled={!dirty || pending} form="account-profile-form" loading={pending} size="sm" type="submit">
                Save changes
              </Button>
            </div>
          }
          title="Account information"
        >
          <form className="grid gap-5" id="account-profile-form" noValidate onSubmit={(event) => void submit(event)}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <FormField htmlFor="account-name" label="Full name" error={errors.name} required>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </FormField>
            <div className="grid gap-2">
              <FormField htmlFor="account-email" label="Email address">
                {(control) => <Input {...control} readOnly value={user.email} />}
              </FormField>
              {user.pending_email ? (
                <Alert variant="info">
                  <p className="flex items-center gap-2 font-medium">
                    <Mail aria-hidden="true" className="size-4" /> Verification pending for {user.pending_email}
                  </p>
                  <Button className="mt-2" onClick={() => setEmailDialog('confirm')} size="sm" variant="outline">
                    Enter verification code
                  </Button>
                </Alert>
              ) : null}
              <Button className="w-fit" onClick={() => setEmailDialog('request')} size="sm" type="button" variant="outline">
                Change email address
              </Button>
            </div>
            <FormField htmlFor="account-phone" label="Phone number" error={errors.phone}>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="tel"
                  placeholder="+254 700 000 000"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              )}
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField htmlFor="account-job-title" label="Job title" error={errors.job_title}>
                {(control) => (
                  <Input
                    {...control}
                    autoComplete="organization-title"
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                  />
                )}
              </FormField>
              <FormField htmlFor="account-department" label="Department" error={errors.department}>
                {(control) => (
                  <Input
                    {...control}
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                  />
                )}
              </FormField>
            </div>
            <FormField
              description={`${bio.length}/500 characters`}
              error={errors.bio}
              htmlFor="account-bio"
              label="Bio"
            >
              {(control) => (
                <Textarea
                  {...control}
                  maxLength={500}
                  rows={4}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                />
              )}
            </FormField>
          </form>
        </SettingsCard>

        <div className="space-y-6">
          <SettingsCard description="Profile completeness across key account details." title="Your account">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{progress.score}% complete</span>
                  <span className="text-muted-foreground">{progress.items.length}/7</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.score}%` }} />
                </div>
                {progress.missing.length ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Add {progress.missing.slice(0, 2).join(' and ')} to improve your profile.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-success">Your profile is complete.</p>
                )}
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd><Badge variant={user.account_status === 'active' ? 'success' : 'warning'}>{user.account_status.replace(/_/g, ' ')}</Badge></dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Email verified</dt>
                  <dd className="flex items-center gap-1">
                    {user.email_verified_at ? (
                      <><CheckCircle2 aria-hidden="true" className="size-4 text-success" /> Verified</>
                    ) : 'Not verified'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Two-factor</dt>
                  <dd className="flex items-center gap-1">
                    <ShieldCheck aria-hidden="true" className={`size-4 ${user.two_factor_enabled ? 'text-success' : 'text-muted-foreground'}`} />
                    {user.two_factor_enabled ? 'Enabled' : 'Disabled'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Member since</dt>
                  <dd>{formatDateTime(user.created_at, profile?.date_format, timeFormat)}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-1.5 border-t pt-3">
                {(user.roles ?? []).map((role) => <Badge key={role.id} variant="secondary">{role.name}</Badge>)}
                {!(user.roles ?? []).length ? <span className="text-xs text-muted-foreground">No roles assigned</span> : null}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard description="Your account identifiers and access level." title="Identifiers">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <AtSign aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium">User ID</p>
                  <p className="break-all text-muted-foreground">{user.id}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BriefcaseBusiness aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium">Last sign-in</p>
                  <p className="break-all text-muted-foreground">
                    {formatDateTime(user.last_login_at, profile?.date_format, timeFormat)}
                  </p>
                </div>
              </div>
            </div>
          </SettingsCard>
        </div>
      </div>

      {emailDialog === 'request' ? (
        <FormDialog
          description="We will email a six-digit verification code to the new address."
          onClose={closeEmail}
          pending={pending}
          title="Change email address"
        >
          <form className="space-y-4" onSubmit={(event) => void requestEmail(event)}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <FormField htmlFor="email-new" label="New email address" error={errors.email} required>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="email"
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
            </FormField>
            <FormField htmlFor="email-password" label="Current password" error={errors.current_password} required>
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </FormField>
            <FormDialogActions pending={pending} submitLabel="Send verification code" />
          </form>
        </FormDialog>
      ) : null}

      {emailDialog === 'confirm' ? (
        <FormDialog
          description={`Enter the six-digit code sent to ${user.pending_email ?? (email || 'your new email address')}.`}
          onClose={closeEmail}
          pending={pending}
          title="Verify new email address"
        >
          <form className="space-y-4" onSubmit={(event) => void confirmEmail(event)}>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <FormField htmlFor="email-code" label="Verification code" error={errors.code} required>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              )}
            </FormField>
            <FormField htmlFor="email-confirm-password" label="Current password" error={errors.current_password} required>
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </FormField>
            <FormDialogActions pending={pending} submitLabel="Verify email" />
          </form>
        </FormDialog>
      ) : null}
    </>
  );
}
