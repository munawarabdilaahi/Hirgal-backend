import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DeferredRouteProps {
  name: string;
}

export function DeferredRoute({ name }: DeferredRouteProps) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">{name}</p>
          <CardTitle>Frontend foundation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            This route is reserved for a future Hirgal feature. Its screen and API
            integration have not been implemented.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
