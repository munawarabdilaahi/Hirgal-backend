import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function NotFoundRoute() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-5 text-sm text-muted-foreground">
            The requested route does not exist.
          </p>
          <Button asChild>
            <Link to="/dashboard">Return to the application</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
