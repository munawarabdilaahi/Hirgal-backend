import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import { useHabit, useHabitAction, useHabitLogs } from '../habit-queries';
import { habitErrorMessage, habitTargetDayLabel } from '../habit-validation';
import type { HabitLogStatus } from '@/services/api/contracts';

const logStatusBadges = {
  completed: { status: 'complete', label: 'Completed' },
  skipped: { status: 'pending', label: 'Skipped' },
  failed: { status: 'blocked', label: 'Failed' },
} as const;

export function HabitDetailsRoute() {
  const { habitUuid = '' } = useParams();
  const navigate = useNavigate();
  const habitQuery = useHabit(habitUuid);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyStatus, setHistoryStatus] = useState('');
  const historyQuery = useHabitLogs(
    habitUuid,
    {
      page: historyPage,
      per_page: 10,
      ...(historyStatus ? { status: historyStatus as HabitLogStatus } : {}),
    },
    habitQuery.isSuccess,
  );
  const archive = useHabitAction('archive');
  const restore = useHabitAction('restore');
  const remove = useHabitAction('delete');
  const [confirmAction, setConfirmAction] = useState<'archive' | 'restore' | 'delete' | null>(
    null,
  );
  const habit = habitQuery.data;
  const actionPending = archive.isPending || restore.isPending || remove.isPending;

  async function confirm(): Promise<void> {
    try {
      if (confirmAction === 'archive') await archive.mutateAsync(habitUuid);
      if (confirmAction === 'restore') await restore.mutateAsync(habitUuid);
      if (confirmAction === 'delete') {
        await remove.mutateAsync(habitUuid);
        navigate('/habits');
      }
      setConfirmAction(null);
    } catch {
      return;
    }
  }

  if (habitQuery.isPending) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <LoadingState label="Loading habit" />
      </div>
    );
  }
  if (habitQuery.isError || !habit) {
    return (
      <ErrorState
        description={habitErrorMessage(habitQuery.error)}
        onRetry={() => void habitQuery.refetch()}
        title="Habit unavailable"
      />
    );
  }

  const stats = habit.stats;

  return (
    <section aria-labelledby="habit-detail-title" className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link className="text-sm text-primary hover:underline" to="/habits">
            Habits
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 rounded-full"
              style={{ backgroundColor: habit.color ?? '#94a3b8' }}
            />
            <h1 className="text-2xl font-semibold tracking-tight" id="habit-detail-title">
              {habit.title}
            </h1>
            <StatusBadge
              label={habit.is_archived ? 'Archived' : 'Active'}
              status={habit.is_archived ? 'neutral' : 'active'}
            />
            <StatusBadge
              label={habit.frequency === 'daily' ? 'Daily' : 'Custom days'}
              status="planned"
            />
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {habit.description || 'No description provided.'}
          </p>
          {habit.frequency === 'custom' && habit.target_days?.length ? (
            <p className="text-xs text-muted-foreground">
              Scheduled on: {habit.target_days.map(habitTargetDayLabel).join(', ')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={`/habits/${habitUuid}/edit`}>Edit habit</Link>
          </Button>
          {habit.is_archived ? (
            <Button onClick={() => setConfirmAction('restore')} variant="outline">
              Restore
            </Button>
          ) : (
            <Button onClick={() => setConfirmAction('archive')} variant="outline">
              <Archive aria-hidden="true" className="size-4" />
              Archive
            </Button>
          )}
          <Button onClick={() => setConfirmAction('delete')} variant="destructive">
            <Trash2 aria-hidden="true" className="size-4" />
            Delete
          </Button>
        </div>
      </header>

      {archive.isError || restore.isError || remove.isError ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {habitErrorMessage(archive.error ?? restore.error ?? remove.error)}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {stats ? `${stats.current_streak} days` : 'Not available'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Longest streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {stats ? `${stats.longest_streak} days` : 'Not available'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">
              {stats ? `${stats.completion_rate}%` : 'Not available'}
            </p>
            {stats ? (
              <Progress
                aria-label={`Completion rate for ${habit.title}`}
                value={stats.completion_rate}
              />
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Check-ins</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {stats ? (
              <>
                <p>{stats.total_completed} completed</p>
                <p>{stats.total_skipped} skipped</p>
                <p>{stats.total_failed} failed</p>
              </>
            ) : (
              <p className="text-2xl font-semibold text-foreground">Not available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>History</CardTitle>
              <CardDescription>Recorded check-ins for this habit.</CardDescription>
            </div>
            <label className="space-y-1 text-sm">
              <span className="sr-only">Filter history by status</span>
              <select
                aria-label="Filter history by status"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(event) => {
                  setHistoryStatus(event.target.value);
                  setHistoryPage(1);
                }}
                value={historyStatus}
              >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped</option>
                <option value="failed">Failed</option>
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {historyQuery.isPending ? (
            <LoadingState label="Loading history" />
          ) : historyQuery.isError ? (
            <ErrorState
              description={habitErrorMessage(historyQuery.error)}
              onRetry={() => void historyQuery.refetch()}
              title="History could not be loaded"
            />
          ) : historyQuery.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No check-ins recorded for this habit yet.
            </p>
          ) : (
            <>
              <ul className="divide-y">
                {historyQuery.data.data.map((entry) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                    key={entry.id}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{entry.logged_date}</p>
                      {entry.notes ? (
                        <p className="text-muted-foreground">{entry.notes}</p>
                      ) : null}
                    </div>
                    <StatusBadge
                      label={logStatusBadges[entry.status].label}
                      status={logStatusBadges[entry.status].status}
                    />
                  </li>
                ))}
              </ul>
              {historyQuery.data.meta ? (
                <Pagination
                  currentPage={historyQuery.data.meta.current_page}
                  onPageChange={setHistoryPage}
                  totalPages={historyQuery.data.meta.last_page}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !actionPending) setConfirmAction(null);
        }}
        open={Boolean(confirmAction)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'archive'
                ? 'Archive this habit?'
                : confirmAction === 'restore'
                  ? 'Restore this habit?'
                  : 'Delete this habit?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'archive'
                ? 'The habit will be hidden from daily check-ins. Its history stays available under archived habits.'
                : confirmAction === 'restore'
                  ? 'The habit will return to active daily check-ins.'
                  : 'The habit and its check-in history will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archive.isError || restore.isError || remove.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {habitErrorMessage(archive.error ?? restore.error ?? remove.error)}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button disabled={actionPending} variant="outline">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                disabled={actionPending}
                onClick={(event) => {
                  event.preventDefault();
                  void confirm();
                }}
                variant={confirmAction === 'delete' ? 'destructive' : 'default'}
              >
                {actionPending
                  ? 'Working…'
                  : confirmAction === 'archive'
                    ? 'Archive habit'
                    : confirmAction === 'restore'
                      ? 'Restore habit'
                      : 'Delete habit'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
