import { SearchInput } from '@/components/ui/search-input';
import { Check, ChevronLeft, ChevronRight, Minus, Plus, SkipForward, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PageHeader } from '@/components/layout/primitives';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/features/auth/auth-hooks';
import { useDebouncedValue } from '@/features/users/use-debounced-value';
import { cn } from '@/lib/utils';
import type { ApiDailyOverviewItem, ApiHabit, ApiHabitWeekDay, HabitFilters, HabitLogStatus } from '@/services/api/contracts';
import { useHabits, useLogHabit, useRemoveHabitLog } from '../habit-queries';
import { habitErrorMessage, habitTargetDayLabel } from '../habit-validation';
import { HabitActivity } from './HabitActivity';
import { HabitFormDialog } from './HabitFormDialog';

const weekDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' });

function calendarDate(date: string): Date {
  return new Date(date + 'T00:00:00Z');
}

function addDays(date: string, offset: number): string {
  const shifted = calendarDate(date);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

function weekStart(date: string): string {
  return addDays(date, -((calendarDate(date).getUTCDay() + 6) % 7));
}

function todayForUser(timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const logStatusBadges = {
  completed: { status: 'complete', label: 'Completed' },
  skipped: { status: 'pending', label: 'Skipped' },
  failed: { status: 'blocked', label: 'Failed' },
} as const;

export function HabitsRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const today = todayForUser(user?.timezone);
  const thisWeek = weekStart(today);
  const [viewDate, setViewDate] = useState(today);
  const firstDay = weekStart(viewDate);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(firstDay, index));
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState('');
  const searchText = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ uuid: string; date: string } | null>(null);
  const cellTrigger = useRef<HTMLButtonElement>(null);
  const filters: HabitFilters = {
    page, per_page: 12, is_archived: archived, week_start: firstDay,
    ...(searchText ? { search: searchText } : {}),
  };
  const query = useHabits(filters, search.trim() === searchText);
  const habits = query.data?.data ?? [];
  const selectedHabit = habits.find((habit) => habit.uuid === selected?.uuid);
  const selectedDay = selectedHabit?.week?.find((day) => day.date === selected?.date);

  function closeEditor() {
    const next = new URLSearchParams(searchParams);
    next.delete('editor');
    setSearchParams(next, { replace: true });
  }

  return (
    <section aria-labelledby="habits-title" className="space-y-6">
      <PageHeader>
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Personal</p>
          <h1 className="text-2xl font-semibold tracking-tight" id="habits-title">Habits</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Plan your week and record daily progress.</p>
        </div>
        <Button asChild><Link to="?editor=create"><Plus aria-hidden="true" className="size-4" />New habit</Link></Button>
      </PageHeader>

      <Tabs className="space-y-6" value={archived ? 'archived' : 'active'} onValueChange={(value) => { setArchived(value === 'archived'); setPage(1); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Habit status">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2" aria-label="Week navigation" role="group">
            <Button aria-label="Previous week" size="icon" variant="outline" onClick={() => setViewDate(addDays(firstDay, -7))}><ChevronLeft aria-hidden="true" className="size-4" /></Button>
            <DateField aria-label="Check-in date" calendarOnly className="w-36" max={today} onValueChange={setViewDate} value={viewDate} />
            <Button aria-label="Next week" size="icon" variant="outline" disabled={firstDay >= thisWeek}
              onClick={() => { const next = addDays(firstDay, 7); setViewDate(next >= thisWeek ? today : next); }}><ChevronRight aria-hidden="true" className="size-4" /></Button>
            <Button variant="outline" disabled={viewDate === today} onClick={() => setViewDate(today)}>Today</Button>
          </div>
        </div>

        <Card className="p-4 shadow-card sm:p-6">
          <SearchInput aria-label="Search habits" maxLength={100} placeholder="Search habits" value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </Card>

        <HabitActivity today={today} selectedDate={viewDate} onSelectDate={setViewDate} />

        <TabsContent value={archived ? 'archived' : 'active'} className="mt-0 space-y-4">
          {query.isPending ? <LoadingState columns={9} label="Loading habits" layout="table" /> : query.isError ? (
            <ErrorState title="Habits could not be loaded" description={habitErrorMessage(query.error)} onRetry={() => void query.refetch()} />
          ) : habits.length === 0 ? (
            <EmptyState title="No habits found" description={searchText ? 'Try a different search.' : archived ? 'Archived habits will appear here.' : 'Create a habit to start tracking daily progress.'} />
          ) : (
            <Card className="overflow-hidden shadow-card">
              <Table aria-label="Weekly habit tracking" className="min-w-[43rem] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 w-36 border-r bg-muted sm:w-48">Habit</TableHead>
                    {dates.map((date) => (
                      <TableHead aria-current={date === today ? 'date' : undefined} className={cn('px-1 text-center', date === viewDate && 'bg-accent text-accent-foreground')} key={date}>
                        {weekday.format(calendarDate(date))}
                        <time className="block font-normal" dateTime={date}>{weekDate.format(calendarDate(date))}</time>
                      </TableHead>
                    ))}
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {habits.map((habit) => (
                    <TableRow key={habit.uuid}>
                      <TableCell className="sticky left-0 z-10 border-r bg-card wrap-anywhere">
                        <Link className="font-semibold hover:text-primary hover:underline" to={'/habits/' + habit.uuid}>{habit.title}</Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {habit.frequency === 'daily' ? 'Daily' : habit.target_days?.map(habitTargetDayLabel).join(', ') || 'Custom days'}
                          {habit.stats && ' · ' + habit.stats.current_streak + ' day streak'}
                        </p>
                      </TableCell>
                      {dates.map((date) => {
                        const day = habit.week?.find((entry) => entry.date === date);
                        return (
                          <TableCell className={cn('px-1 py-2 text-center', date === viewDate && 'bg-accent/30')} key={date}>
                            <WeekCheckIn habit={habit} day={day} date={date} onOpen={(trigger) => {
                              cellTrigger.current = trigger;
                              setSelected({ uuid: habit.uuid, date });
                            }} />
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost"><Link aria-label={'View ' + habit.title} to={'/habits/' + habit.uuid}>View</Link></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {query.data && query.data.meta.last_page > 1 && <Pagination currentPage={query.data.meta.current_page} onPageChange={setPage} totalPages={query.data.meta.last_page} />}
        </TabsContent>
      </Tabs>
      <Dialog open={Boolean(selected && selectedHabit && selectedDay)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); cellTrigger.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>Daily check-in</DialogTitle>
            <DialogDescription>{selectedDay && fullDate.format(calendarDate(selectedDay.date))}</DialogDescription>
          </DialogHeader>
          {selectedHabit && selectedDay && (
            <ul>
              <CheckInRow
                date={selectedDay.date}
                item={{ habit: selectedHabit, ...selectedDay }}
                key={selectedHabit.uuid + selectedDay.date}
                onClose={() => setSelected(null)}
              />
            </ul>
          )}
        </DialogContent>
      </Dialog>
      {searchParams.get('editor') === 'create' && <HabitFormDialog onClose={closeEditor} />}
    </section>
  );
}

function WeekCheckIn({ habit, day, date, onOpen }: {
  habit: ApiHabit; day: ApiHabitWeekDay | undefined; date: string; onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const status = day?.log?.status;
  const Icon = status === 'completed' ? Check : status === 'failed' ? X : status === 'skipped' ? SkipForward : Minus;
  const description = status ? logStatusBadges[status].label : day?.is_scheduled ? 'No check-in' : 'Not scheduled';
  const label = habit.title + ', ' + fullDate.format(calendarDate(date)) + ': ' + description;
  const color = status === 'completed' ? 'border-primary/30 bg-primary/10 text-primary' :
    status === 'failed' ? 'text-destructive' : 'text-muted-foreground';

  if (!day?.can_check_in) {
    return <span role="img" aria-label={label} title={label} className={cn('inline-flex size-8 items-center justify-center rounded-md border border-transparent', color)}><Icon aria-hidden="true" className="size-4" /></span>;
  }

  return (
    <Button aria-haspopup="dialog" aria-label={label} title={label} className={cn('size-8', color)}
      onClick={(event) => onOpen(event.currentTarget)} size="icon" variant="outline">
      {status ? <Icon aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
    </Button>
  );
}


function CheckInRow({
  date,
  item,
  onClose,
}: {
  date: string;
  item: ApiDailyOverviewItem;
  onClose?: () => void;
}) {
  const { habit, is_scheduled, log } = item;
  const logHabit = useLogHabit(habit.uuid);
  const removeHabitLog = useRemoveHabitLog(habit.uuid);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function record(status: HabitLogStatus): Promise<void> {
    if (logHabit.isPending) {
      return;
    }
    setActionError(null);
    try {
      await logHabit.mutateAsync({ logged_date: date, status });
      if (status === 'completed') {
        onClose?.();
        toast.success('Habit completed successfully!');
      } else if (status === 'skipped') {
        onClose?.();
        toast.success('Habit marked as skipped.');
      } else if (status === 'failed') {
        onClose?.();
        toast.success('Habit marked as failed.');
      }
    } catch (error) {
      const message = habitErrorMessage(error);
      setActionError(message);
      toast.error(message);
    }
  }

  async function confirmRemove(): Promise<void> {
    if (removeHabitLog.isPending) {
      return;
    }
    setActionError(null);
    try {
      await removeHabitLog.mutateAsync(date);
      setConfirmRemoval(false);
      onClose?.();
      toast.success('Habit check-in removed.');
    } catch (error) {
      const message = habitErrorMessage(error);
      setActionError(message);
      toast.error(message);
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
              disabled={logHabit.isPending}
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
