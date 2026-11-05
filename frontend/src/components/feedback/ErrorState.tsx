import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  onRetry?: () => void;
}

export function ErrorState({ title, description, action, onRetry }: ErrorStateProps) {
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
        {onRetry ? <div className="mt-5"><Button onClick={onRetry} variant="outline">Try again</Button></div> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
