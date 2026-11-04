import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatusBadge } from '@/components/ui/status-badge';

function FeedbackSection() {
  return (
    <section aria-labelledby="feedback-title" className="space-y-4">
      <div>
        <h2 className="text-section-title font-semibold tracking-tight" id="feedback-title">
          Feedback and actions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use text and icon cues alongside semantic color; status is never conveyed by color alone.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Buttons, badges, and alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link action</Button>
            <Button loading>Saving</Button>
            <Button aria-label="Icon action" size="icon" variant="outline">
              <Info aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Neutral</Badge>
            <StatusBadge status="active" />
            <StatusBadge status="pending" />
            <StatusBadge status="blocked" />
            <StatusBadge status="planned" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Alert variant="success">
              <CheckCircle2 className="size-4" />
              <AlertTitle>Changes saved</AlertTitle>
              <AlertDescription>Your preferences are up to date.</AlertDescription>
            </Alert>
            <Alert variant="info">
              <Info className="size-4" />
              <AlertTitle>Helpful information</AlertTitle>
              <AlertDescription>This is an informational message.</AlertDescription>
            </Alert>
            <Alert variant="warning">
              <TriangleAlert className="size-4" />
              <AlertTitle>Review needed</AlertTitle>
              <AlertDescription>Some details may need your attention.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Could not complete the action</AlertTitle>
              <AlertDescription>Please review the information and try again.</AlertDescription>
            </Alert>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <LoadingState label="Loading items" />
            <Spinner label="Updating" />
            <Skeleton className="h-4 w-32" />
            <Button onClick={() => toast.success('This is a showcase notification.')}>
              Show toast
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <EmptyState
          description="When data is genuinely empty, explain what belongs here and what the user can do next."
          title="Nothing here yet"
        />
        <ErrorState
          description="A clear message and recovery action can be supplied by the page using this state."
          title="Unable to load this section"
          action={<Button variant="outline">Try again</Button>}
        />
      </div>
    </section>
  );
}

export { FeedbackSection };
