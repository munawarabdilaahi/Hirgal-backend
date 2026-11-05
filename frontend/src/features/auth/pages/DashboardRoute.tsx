import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-hooks';

export function DashboardRoute() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {user?.name ?? 'back'}
        </h1>
        <p className="text-muted-foreground">
          Your account is connected. Workspace dashboards are part of a later feature phase.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Your account is ready</CardTitle>
          <CardDescription>
            Review your profile details or update your password and session settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/profile">View profile</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/change-password">Change password</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
