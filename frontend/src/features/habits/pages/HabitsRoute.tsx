import { DateField } from '@/components/ui/date-field';
import { HabitFormDialog } from './HabitFormDialog';
import { ChoiceOption, ChoiceSelect } from '@/components/ui/choice-select';
import { PageHeader } from '@/components/layout/primitives';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
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
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/features/auth/auth-hooks';
import { useDailyOverview, useHabits, useLogHabit, useRemoveHabitLog } from '../habit-queries';
import { habitErrorMessage, habitTargetDayLabel } from '../habit-validation';
import type {
  ApiDailyOverviewItem,
  ApiHabit,
  HabitFilters,
  HabitFrequency,
  HabitLogStatus,
} from '@/services/api/contracts';

function todayForUser(timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone ?? 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
}

const logStatusBadges = {
  completed: { status: 'complete', label: 'Completed' },
  skipped: { status: 'pending', label: 'Skipped' },
  failed: { status: 'blocked', label: 'Failed' },
} as const;

export function HabitsRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  function closeEditor(): void {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('editor');
      return next;
    }, { replace: true });
  }
  const { user } = useAuth();
  const today = todayForUser(user?.timezone);
  const [viewDate, setViewDate] = useState(today);
  const [archived, setArchived] = useState(false);
  const [frequency, setFrequency] = useState('');
  const [page, setPage] = useState(1);

  const overview = useDailyOverview(viewDate);
  const filters: HabitFilters = {
    page,
    per_page: 12,
    is_archived: archived,
    ...(frequency ? { frequency: frequency as HabitFrequency } : {}),
  };
  const query = useHabits(filters);
  const habits = query.data?.data ?? [];

  return (
    <section aria-labelledby="habits-title" className="space-y-6">
      <PageHeader>
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Personal</p>
          <h1 className="text-2xl font-semibold tracking-tight" id="habits-title">Habits</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Build consistent routines and record daily progress.
          </p>
        </div>
        <Button asChild>
          <Link to="?editor=create">
            <Plus aria-hidden="true" className="size-4" />
            New habit
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Daily check-in</CardTitle>
              <CardDescription>Record progress for each scheduled habit.</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                aria-label="Previous day"
                onClick={() => setViewDate((current) => addDays(current, -1))}
                size="icon"
                variant="outline"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Button>
              <DateField aria-label="Check-in date" calendarOnly className="w-36" max={today}
                onValueChange={setViewDate} value={viewDate} />
              <Button
                aria-label="Next day"
                disabled={viewDate >= today}
                onClick={() => setViewDate((current) => addDays(current, 1))}
                size="icon"
                variant="outline"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {overview.isPending ? (
            <LoadingState label="Loading check-in" />
          ) : overview.isError ? (
            <ErrorState
              description={habitErrorMessage(overview.error)}
              onRetry={() => void overview.refetch()}
              title="Check-in could not be loaded"
            />
          ) : overview.data.habits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active habits to check in for this date.
            </p>
          ) : (
            <ul className="divide-y">
              {overview.data.habits.map((item) => (
                <CheckInRow date={viewDate} item={item} key={item.habit.uuid} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="sr-only">Filter by archive status</span>
            <ChoiceSelect
              aria-label="Filter by archive status"
              className="w-full"
              onValueChange={(nextValue) => {
                setArchived(nextValue === 'archived');
                setPage(1);
              }}
              value={archived ? 'archived' : 'active'}
            >
              <ChoiceOption value="active">Active habits</ChoiceOption>
              <ChoiceOption value="archived">Archived habits</ChoiceOption>
            </ChoiceSelect>
          </label>
          <label className="space-y-1 text-sm">
            <span className="sr-only">Filter by frequency</span>
            <ChoiceSelect
              aria-label="Filter by frequency"
              className="w-full"
              onValueChange={(nextValue) => {
                setFrequency(nextValue);
                setPage(1);
              }}
              value={frequency}
            >
              <ChoiceOption value="">All frequencies</ChoiceOption>
              <ChoiceOption value="daily">Daily</ChoiceOption>
              <ChoiceOption value="custom">Custom days</ChoiceOption>
            </ChoiceSelect>
          </label>
        </CardContent>
      </Card>

      {query.isPending ? (
        <LoadingState label="Loading habits" layout="cards" />
      ) : query.isError ? (
        <ErrorState
          description={habitErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
          title="Habits could not be loaded"
        />
      ) : habits.length === 0 ? (
        <EmptyState
          description={
            archived
              ? 'Habits you archive will remain available here.'
              : 'Create your first habit to start tracking daily progress.'
          }
          title="No habits found"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {habits.map((habit) => (
            <HabitCard habit={habit} key={habit.uuid} />
          ))}
        </div>
      )}

      {query.data?.meta ? (
        <Pagination
          currentPage={query.data.meta.current_page}
          onPageChange={setPage}
          totalPages={query.data.meta.last_page}
        />
      ) : null}
      {searchParams.get('editor') === 'create' && <HabitFormDialog onClose={closeEditor} />}
    </section>
  );
}

function HabitCard({ habit }: { habit: ApiHabit }) {
  const stats = habit.stats;
  const targetDays = (habit.target_days ?? []).map(habitTargetDayLabel).join(', ');

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <Activity aria-hidden="true" className="size-5 text-primary" />
          <StatusBadge
            label={habit.is_archived ? 'Archived' : 'Active'}
            status={habit.is_archived ? 'neutral' : 'active'}
          />
        </div>
        <CardTitle>
          <Link
            className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to={`/habits/${habit.uuid}`}
          >
            {habit.title}
          </Link>
        </CardTitle>
        <CardDescription>{habit.description || 'No description provided.'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between gap-3 text-muted-foreground">
          <span>
            {habit.frequency === 'daily' ? 'Every day' : `Days: ${targetDays || 'Not set'}`}
          </span>
          <span>{stats ? `${stats.current_streak} day streak` : 'No activity yet'}</span>
        </div>
        {stats ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Completion rate</span>
              <span>{stats.completion_rate}%</span>
            </div>
            <Progress
              aria-label={`Completion rate for ${habit.title}`}
              value={stats.completion_rate}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CheckInRow({ date, item }: { date: string; item: ApiDailyOverviewItem }) {
  const { habit, is_scheduled, log } = item;
  const logHabit = useLogHabit(habit.uuid);
  const removeHabitLog = useRemoveHabitLog(habit.uuid);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function record(status: HabitLogStatus): Promise<void> {
    setActionError(null);
    try {
      await logHabit.mutateAsync({ logged_date: date, status });
    } catch (error) {
      setActionError(habitErrorMessage(error));
    }
  }

  async function confirmRemove(): Promise<void> {
    setActionError(null);
    try {
      await removeHabitLog.mutateAsync(date);
      setConfirmRemoval(false);
    } catch (error) {
      setActionError(habitErrorMessage(error));
    }
  }

  const badge = log ? logStatusBadges[log.status] : null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: habit.color ?? '#94a3b8' }}
        />
        <div className="min-w-0">
          <Link
            className="text-sm font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to={`/habits/${habit.uuid}`}
          >
            {habit.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {!is_scheduled
              ? 'Not scheduled on this date'
              : badge
                ? `Checked in for ${date}`
                : 'Scheduled for this date'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!is_scheduled ? null : badge ? (
          <>
            <StatusBadge label={badge.label} status={badge.status} />
            <Button
              aria-label={`Remove check-in for ${habit.title}`}
              disabled={removeHabitLog.isPending}
              onClick={() => setConfirmRemoval(true)}
              size="sm"
              variant="outline"
            >
              Remove
            </Button>
          </>
        ) : (
          <>
            <Button
              aria-label={`Mark ${habit.title} as completed`}
              loading={logHabit.isPending}
              onClick={() => void record('completed')}
              size="sm"
            >
              Complete
            </Button>
            <Button
              aria-label={`Mark ${habit.title} as skipped`}
              disabled={logHabit.isPending}
              onClick={() => void record('skipped')}
              size="sm"
              variant="outline"
            >
              Skip
            </Button>
            <Button
              aria-label={`Mark ${habit.title} as failed`}
              disabled={logHabit.isPending}
              onClick={() => void record('failed')}
              size="sm"
              variant="outline"
            >
              Fail
            </Button>
          </>
        )}
      </div>
      {actionError ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !removeHabitLog.isPending) setConfirmRemoval(false);
        }}
        open={confirmRemoval}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this check-in?</AlertDialogTitle>
            <AlertDialogDescription>
              The record for {date} will be deleted and streak statistics will be recalculated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeHabitLog.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {habitErrorMessage(removeHabitLog.error)}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button disabled={removeHabitLog.isPending} variant="outline">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                disabled={removeHabitLog.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  void confirmRemove();
                }}
                variant="destructive"
              >
                {removeHabitLog.isPending ? 'Working…' : 'Remove check-in'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
