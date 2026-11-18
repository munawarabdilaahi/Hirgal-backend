import { useQuery } from '@tanstack/react-query';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ChangePasswordDialog } from '@/features/auth/pages/ChangePasswordRoute';
import { accountApi } from '@/services/api/accountApi';
import type { ApiUser } from '@/services/api/contracts';
import { TwoFactorSettings } from './TwoFactorSettings';
import { formatDateTime, LoadingRows, QueryError, SettingsCard } from './shared';

const actionLabels: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'account.password_changed': 'Password changed',
  'account.email_change_requested': 'Email change requested',
  'account.email_changed': 'Email address changed',
  'account.two_factor_enabled': 'Two-factor authentication enabled',
  'account.two_factor_disabled': 'Two-factor authentication disabled',
  'account.recovery_codes_regenerated': 'Recovery codes regenerated',
  'account.sessions_revoked': 'Sessions revoked',
  'account.deactivated': 'Account deactivated',
  'account.deleted': 'Account deleted',
  'account.data_exported': 'Data exported',
};

export function SecuritySection({
  user,
  onUserChanged,
  timeFormat,
}: {
  user: ApiUser;
  onUserChanged: (user: ApiUser) => void;
  timeFormat: string;
}) {
  const activity = useQuery({
    queryKey: ['account', 'security-activity'],
    queryFn: () => accountApi.activity(),
  });

  return (
    <div className="space-y-6">
      <SettingsCard
        description="Use a strong, unique password and review your sign-in activity regularly."
        title="Password"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              <KeyRound aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="font-medium">Password</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Changing your password signs out other devices when you choose to.
              </p>
            </div>
          </div>
          <ChangePasswordDialog />
        </div>
      </SettingsCard>

      <TwoFactorSettings onUserChanged={onUserChanged} user={user} />

      <SettingsCard
        description="Recent security-related events on your account. This list is limited to the last 20 events."
        title="Recent security activity"
      >
        {activity.isPending ? <LoadingRows rows={4} /> : null}
        {activity.isError ? (
          <QueryError message="Security activity could not be loaded." onRetry={() => void activity.refetch()} />
        ) : null}
        {activity.data?.length ? (
          <ul className="divide-y">
            {activity.data.map((event) => (
              <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0" key={event.id}>
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{actionLabels[event.action] ?? event.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at, undefined, timeFormat)}</p>
                </div>
                <Badge className="shrink-0" variant="outline">{event.action.replace(/^account\./, '')}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        {activity.data && !activity.data.length ? (
          <p className="text-sm text-muted-foreground">No security activity has been recorded yet.</p>
        ) : null}
      </SettingsCard>
    </div>
  );
}
