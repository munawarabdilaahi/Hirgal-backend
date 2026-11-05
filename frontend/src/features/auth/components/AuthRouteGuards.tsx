import { useState, type PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasAnyPermission, hasPermission } from '@/features/auth/permissions';
import type { ApiUser } from '@/services/api/contracts';

interface RequirePermissionProps extends PropsWithChildren {
  permission: string;
}

interface RequireAnyPermissionProps extends PropsWithChildren {
  permissions: readonly string[];
}

export function RequireAuthenticated({ children }: PropsWithChildren) {
  const location = useLocation();
  const auth = useAuth();

  if (!auth.hasSession) {
    return (
      <Navigate
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
        to="/login"
      />
    );
  }

  if (auth.isInitializing) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <LoadingState label="Checking your session" />
      </main>
    );
  }

  if (auth.sessionError) {
    return <SessionUnavailable onRetry={auth.retrySession} />;
  }

  if (!auth.isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  return children;
}

export function RedirectAuthenticatedUser({ children }: PropsWithChildren) {
  const auth = useAuth();

  if (auth.isInitializing) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <LoadingState label="Checking your session" />
      </main>
    );
  }

  if (auth.sessionError) {
    return <SessionUnavailable onRetry={auth.retrySession} />;
  }

  if (auth.isAuthenticated) {
    return <Navigate replace to="/dashboard" />;
  }

  return children;
}

export function RequirePermission({
  children,
  permission,
}: RequirePermissionProps) {
  const { user } = useAuth();

  if (!hasPermission(user, permission)) {
    return (
      <section className="mx-auto max-w-2xl rounded-xl border bg-card p-8 text-center shadow-card">
        <h1 className="text-xl font-semibold">Access unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your account does not have permission to open this area. If you believe this is an
          error, contact your Hirgal administrator.
        </p>
      </section>
    );
  }

  return children;
}

export function RequireAnyPermission({
  children,
  permissions,
}: RequireAnyPermissionProps) {
  const { user } = useAuth();

  if (!hasAnyPermission(user, permissions)) {
    return (
      <section className="mx-auto max-w-2xl rounded-xl border bg-card p-8 text-center shadow-card">
        <h1 className="text-xl font-semibold">Access unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your account does not have permission to open this area. If you believe this is an
          error, contact your Hirgal administrator.
        </p>
      </section>
    );
  }

  return children;
}

function SessionUnavailable({ onRetry }: { onRetry: () => Promise<ApiUser> }) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const retry = async () => {
    setIsRetrying(true);
    setRetryMessage(null);

    try {
      await onRetry();
    } catch {
      setRetryMessage('The session could not be verified. Check your connection and retry.');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unable to verify your session</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            Hirgal could not confirm your account right now. Your in-memory session has been
            kept; retry when your connection is available.
          </p>
          {retryMessage ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {retryMessage}
            </p>
          ) : null}
          <Button className="mt-5 w-full" loading={isRetrying} onClick={() => void retry()}>
            Retry session check
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
