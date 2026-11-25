import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getSafeErrorMessage } from '@/features/auth/auth-validation';
import type { AccountNotificationPreferences, ApiUserProfile, UpdateProfileRequest } from '@/services/api/contracts';
import { SettingsCard } from './shared';

const defaults: Required<Pick<AccountNotificationPreferences,
  'email_notifications' | 'in_app_notifications' | 'workspace_invitations' | 'system_announcements' | 'activity_notifications'
>> = {
  email_notifications: true,
  in_app_notifications: true,
  workspace_invitations: true,
  system_announcements: true,
  activity_notifications: true,
};

const rows: { key: keyof typeof defaults; title: string; description: string }[] = [
  {
    key: 'email_notifications',
    title: 'Email notifications',
    description: 'Send account and workspace updates to your email address.',
  },
  {
    key: 'in_app_notifications',
    title: 'In-app notifications',
    description: 'Show notifications inside Hirgal while you work.',
  },
  {
    key: 'workspace_invitations',
    title: 'Workspace invitations',
    description: 'Notify you when someone invites you to a workspace.',
  },
  {
    key: 'system_announcements',
    title: 'Product announcements',
    description: 'Occasional updates about new Hirgal features and maintenance.',
  },
  {
    key: 'activity_notifications',
    title: 'Activity updates',
    description: 'Updates about tasks, projects, and comments you follow.',
  },
];

export function NotificationsSection({
  profile,
  save,
}: {
  profile: ApiUserProfile | null;
  save: (payload: UpdateProfileRequest) => Promise<void>;
}) {
  const stored = (profile?.notification_preferences ?? {}) as AccountNotificationPreferences;
  const [preferences, setPreferences] = useState(defaults);
  const [baseline, setBaseline] = useState(defaults);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const next = {
      email_notifications: stored.email_notifications ?? stored.email ?? defaults.email_notifications,
      in_app_notifications: stored.in_app_notifications ?? stored.in_app ?? defaults.in_app_notifications,
      workspace_invitations: stored.workspace_invitations ?? defaults.workspace_invitations,
      system_announcements: stored.system_announcements ?? defaults.system_announcements,
      activity_notifications: stored.activity_notifications ?? defaults.activity_notifications,
    };
    setPreferences(next);
    setBaseline(next);
  }, [
    stored.email_notifications,
    stored.email,
    stored.in_app_notifications,
    stored.in_app,
    stored.workspace_invitations,
    stored.system_announcements,
    stored.activity_notifications,
  ]);

  const dirty = rows.some((row) => preferences[row.key] !== baseline[row.key]);

  async function submit() {
    setPending(true);
    setError(undefined);
    setSaved(false);
    try {
      await save({
        notification_preferences: {
          ...preferences,
          security_alerts: true,
          login_alerts: true,
        },
      });
      setSaved(true);
      toast.success('Notification preferences saved.');
    } catch (caught) {
      setError(getSafeErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsCard
      description="Choose what Hirgal notifies you about. Security and login alerts are always enabled."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Security and login alerts cannot be disabled.</p>
          <Button disabled={!dirty || pending} loading={pending} onClick={() => void submit()} size="sm">
            Save preferences
          </Button>
        </div>
      }
      title="Notifications"
    >
      <div className="space-y-4">
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        {saved && !dirty ? <Alert variant="success">Notification preferences saved.</Alert> : null}
        {rows.map((row) => (
          <div className="flex items-start justify-between gap-4" key={row.key}>
            <div className="min-w-0">
              <Label htmlFor={`notification-${row.key}`}>{row.title}</Label>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{row.description}</p>
            </div>
            <Switch
              checked={preferences[row.key]}
              id={`notification-${row.key}`}
              onCheckedChange={(checked) => {
                setSaved(false);
                setPreferences((current) => ({ ...current, [row.key]: checked }));
              }}
            />
          </div>
        ))}
        <div className="flex items-start justify-between gap-4 border-t pt-4">
          <div className="min-w-0">
            <Label htmlFor="notification-security-alerts">Security and login alerts</Label>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Required alerts about new sign-ins, password changes, email changes, and two-factor changes.
            </p>
          </div>
          <Switch aria-readonly checked disabled id="notification-security-alerts" />
        </div>
      </div>
    </SettingsCard>
  );
}
