import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <Card aria-labelledby="error-state-title" className="w-full" role="alert">
      <CardHeader>
        <div className="flex items-center gap-2 text-destructive">
          <CircleAlert aria-hidden="true" className="size-5" />
          <CardTitle id="error-state-title">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
