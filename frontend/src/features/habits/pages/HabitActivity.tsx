import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ApiHabitActivity } from '@/services/api/contracts';
import { useHabitActivity } from '../habit-queries';
import { habitErrorMessage } from '../habit-validation';

const levels = [
  'bg-muted',
  'bg-success/25',
  'bg-success/45',
  'bg-success/70',
  'bg-success',
];
const monthName = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: 'UTC' });
const dayMs = 86_400_000;
const weekdays = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const dayOffsets = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 } as const;

interface ActivityProps {
  today: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function HabitActivity({ today, selectedDate, onSelectDate }: ActivityProps) {
  const activity = useHabitActivity(today);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Habit activity</CardTitle>
        <CardDescription>Completed check-ins over the last year. Select a day to review it.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.isPending ? (
          <div aria-label="Loading habit activity" className="space-y-3" role="status">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : activity.isError ? (
          <ErrorState title="Habit activity could not be loaded" description={habitErrorMessage(activity.error)}
            onRetry={() => void activity.refetch()} />
        ) : (
          <ContributionGrid activity={activity.data} selectedDate={selectedDate} onSelectDate={onSelectDate} />
        )}
      </CardContent>
    </Card>
  );
}

function ContributionGrid({ activity, selectedDate, onSelectDate }: Omit<ActivityProps, 'today'> & { activity: ApiHabitActivity }) {
  const first = new Date(activity.from + 'T00:00:00Z');
  const last = new Date(activity.through + 'T00:00:00Z');
  const counts = new Map(activity.days.map(({ date, completed }) => [date, completed]));
  const total = activity.days.reduce((sum, day) => sum + day.completed, 0);
  const offset = first.getUTCDay();
  const start = first.getTime() - offset * dayMs;
  const weekCount = Math.ceil(((last.getTime() - start) / dayMs + 1) / 7);
  const scrollArea = useRef<HTMLDivElement>(null);
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const [focusedDate, setFocusedDate] = useState<string>();
  const activeDate = focusedDate ?? (selectedDate >= activity.from && selectedDate <= activity.through ? selectedDate : activity.through);

  useEffect(() => {
    const area = scrollArea.current;
    if (area) area.scrollLeft = area.scrollWidth;
  }, [activity.through]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const offset = dayOffsets[event.key as keyof typeof dayOffsets];
    if (offset === undefined) return;
    event.preventDefault();
    const shifted = new Date(new Date(date + 'T00:00:00Z').getTime() + offset * dayMs).toISOString().slice(0, 10);
    dayButtons.current.get(shifted)?.focus();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium tabular-nums">{total.toLocaleString()} completed {total === 1 ? 'check-in' : 'check-ins'}</p>
      <div className="flex min-w-0 gap-2">
        <div aria-hidden="true" className="grid shrink-0 grid-rows-[1rem_repeat(7,minmax(0,1fr))] gap-1 pb-2 text-[0.625rem] leading-none text-muted-foreground">
          <span />
          {weekdays.map((day, index) => <span className="self-center" key={index}>{day}</span>)}
        </div>
        <div aria-label="Daily habit completions" className="min-w-0 flex-1 overflow-x-auto px-1 pb-2" ref={scrollArea} role="group">
          <div className="grid auto-cols-[minmax(0.65rem,1fr)] grid-flow-col gap-1">
            {Array.from({ length: weekCount }, (_, column) => {
              const week = new Date(start + column * 7 * dayMs);
              const showMonth = week.getUTCDate() <= 7 && column < weekCount - 2;
              return (
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[1rem_repeat(7,minmax(0,1fr))] gap-1" key={column}>
                  <span aria-hidden="true" className="overflow-visible whitespace-nowrap text-[0.625rem] leading-4 text-muted-foreground">
                    {showMonth ? monthName.format(week) : ''}
                  </span>
                  {Array.from({ length: 7 }, (_, row) => {
                    const day = new Date(week.getTime() + row * dayMs);
                    const date = day.toISOString().slice(0, 10);
                    if (date < activity.from || date > activity.through) return <span aria-hidden="true" className="aspect-square" key={date} />;
                    const count = counts.get(date) ?? 0;
                    const label = `${fullDate.format(day)}: ${count} completed ${count === 1 ? 'check-in' : 'check-ins'}`;
                    return (
                      <button
                        aria-label={label}
                        aria-pressed={date === selectedDate}
                        className={cn('aspect-square w-full rounded-[3px] border border-foreground/10 hover:border-foreground/50 focus-visible:ring-offset-0', levels[Math.min(count, 4)], date === selectedDate && 'ring-1 ring-ring')}
                        key={date}
                        onClick={() => onSelectDate(date)}
                        onFocus={() => setFocusedDate(date)}
                        onKeyDown={(event) => moveFocus(event, date)}
                        ref={(button) => {
                          if (button) dayButtons.current.set(date, button);
                          else dayButtons.current.delete(date);
                        }}
                        tabIndex={date === activeDate ? 0 : -1}
                        title={label}
                        type="button"
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{fullDate.format(first)} – {fullDate.format(last)}</span>
        <div aria-label="Completion scale: 0, 1, 2, 3, and 4 or more" className="flex items-center gap-1.5" role="group">
          <span>Less</span>
          {levels.map((level) => <span aria-hidden="true" className={cn('size-3 rounded-[3px] border border-foreground/10', level)} key={level} />)}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
