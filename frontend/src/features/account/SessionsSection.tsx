import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, LogOut, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { accountApi } from '@/services/api/accountApi';
import type { AccountSession } from '@/services/api/contracts';
import { formatDateTime, LoadingRows, PasswordAction, QueryError, SettingsCard } from './shared';

export function SessionsSection({ timeFormat }: { timeFormat: string }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<AccountSession | null>(null);
  const sessions = useQuery({ queryKey: ['account', 'sessions'], queryFn: () => accountApi.sessions() });

  async function revoke(session: AccountSession, password: string) {
    await accountApi.revoke(session.id, password);
    await queryClient.invalidateQueries({ queryKey: ['account', 'sessions'] });
    toast.success('Session signed out.');
  }

  return (
    <>
      <SettingsCard
        description="Devices and apps currently signed in to your account. Sign out anything you do not recognize."
        title="Sessions and devices"
      >
        <div className="space-y-4">
          <Alert variant="info">
            {sessions.data?.tracks_browser_sessions
              ? 'Browser sessions are tracked. Signing out a browser session also revokes its access token.'
              : 'Browser sessions are authenticated by cookie and are not individually tracked in this deployment, so only API sign-ins can be revoked here.'}
          </Alert>
          {sessions.isPending ? <LoadingRows rows={3} /> : null}
          {sessions.isError ? (
            <QueryError message="Sessions could not be loaded." onRetry={() => void sessions.refetch()} />
          ) : null}
          {sessions.data ? (
            <ul className="divide-y">
              {sessions.data.sessions.map((session) => (
                <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0" key={`${session.kind}-${session.id}`}>
                  <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                    {session.kind === 'browser'
                      ? <Laptop aria-hidden="true" className="size-4" />
                      : <Smartphone aria-hidden="true" className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{session.label}</p>
                      {session.current ? <Badge variant="success">This device</Badge> : null}
                      <Badge variant="outline">{session.kind === 'browser' ? 'Browser' : 'API token'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.ip_address ?? 'Unknown IP'} · Last active {formatDateTime(session.last_active_at, undefined, timeFormat)}
                    </p>
                  </div>
                  {!session.current ? (
                    <Button onClick={() => setTarget(session)} size="sm" variant="outline">
                      <LogOut aria-hidden="true" className="size-4" /> Sign out
                    </Button>
                  ) : null}
                </li>
              ))}
              {!sessions.data.sessions.length ? (
                <li className="py-2 text-sm text-muted-foreground">No active sessions found.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </SettingsCard>

      {target ? (
        <PasswordAction
          action="Sign out session"
          description={`Sign out "${target.label}"? This cannot be undone.`}
          execute={(password) => revoke(target, password)}
          onClose={() => setTarget(null)}
          title="Sign out session"
        />
      ) : null}
    </>
  );
}
