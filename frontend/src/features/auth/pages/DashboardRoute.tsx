import { ArrowUpRight, KeyRound, UserRound, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AccountStatusBadge } from '@/features/auth/components/AccountStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserIdentity } from '@/components/ui/user-identity';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasAnyPermission } from '@/features/auth/permissions';

export function DashboardRoute() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const canViewPeople = hasAnyPermission(user, ['users.view_directory', 'users.view']);
  const profileDetails = [user.profile?.job_title, user.profile?.department]
    .filter((detail): detail is string => Boolean(detail));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Your workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome, {user.name}</h1>
        <p className="max-w-2xl text-muted-foreground">
          Your account and team shortcuts are ready. Workspace activity will appear here as those
          features become available.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Account overview</CardTitle>
              <CardDescription>Your authenticated Hirgal account details.</CardDescription>
            </div>
            <AccountStatusBadge status={user.account_status} />
          </CardHeader>
          <CardContent className="space-y-6">
            <UserIdentity
              className="items-start"
              detail={profileDetails.join(' · ') || user.email}
              imageUrl={user.avatar_url}
              name={user.name}
            />
            <dl className="grid gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </dt>
                <dd className="mt-1 break-all text-sm">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Time zone
                </dt>
                <dd className="mt-1 text-sm">{user.timezone || 'Not set'}</dd>
              </div>
              {user.profile?.job_title ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Job title
                  </dt>
                  <dd className="mt-1 text-sm">{user.profile.job_title}</dd>
                </div>
              ) : null}
              {user.profile?.department ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Department
                  </dt>
                  <dd className="mt-1 text-sm">{user.profile.department}</dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Global roles
                </dt>
                <dd className="mt-1 text-sm">
                  {user.roles?.length ? user.roles.map((role) => role.name).join(', ') : 'No global role assigned'}
                </dd>
              </div>
            </dl>
            {!profileDetails.length ? (
              <p className="text-sm text-muted-foreground">
                Add a job title or department from your profile to help teammates identify you.
              </p>
            ) : null}
            <Button asChild variant="outline">
              <Link to="/profile">
                <UserRound aria-hidden="true" />
                Manage profile
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
            <CardDescription>Common account and people actions.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild className="justify-between" variant="outline">
              <Link to="/profile">
                <span className="inline-flex items-center gap-2">
                  <UserRound aria-hidden="true" className="size-4" />
                  Your profile
                </span>
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            {canViewPeople ? (
              <Button asChild className="justify-between" variant="outline">
                <Link to="/users">
                  <span className="inline-flex items-center gap-2">
                    <UsersRound aria-hidden="true" className="size-4" />
                    People &amp; access
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            ) : null}
            <Button asChild className="justify-between" variant="outline">
              <Link to="/change-password">
                <span className="inline-flex items-center gap-2">
                  <KeyRound aria-hidden="true" className="size-4" />
                  Password &amp; security
                </span>
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
