import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronDown, ChevronRight, CircleAlert, ListChecks } from 'lucide-react';
import { useId, useState } from 'react';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getSafeErrorMessage } from '@/features/auth/auth-validation';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api/apiClient';
import type { ApiPaginatedResponse } from '@/services/api/contracts';
import type { Task } from './TasksRoute';

type ScheduleGroup = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'other';
export type TaskSchedule = Record<ScheduleGroup | 'due_today' | 'due_tomorrow' | 'done_today', number>;
export type TaskListResponse = ApiPaginatedResponse<Task> & { meta: ApiPaginatedResponse<Task>['meta'] & { schedule?: TaskSchedule } };
type QueryParams = Record<string, string | number | undefined>;

const groups = [
  { key: 'overdue', title: 'Overdue tasks' },
  { key: 'today', title: 'Today’s tasks' },
  { key: 'tomorrow', title: 'Tomorrow’s tasks' },
  { key: 'upcoming', title: 'Day after tomorrow' },
  { key: 'other', title: 'Later, unscheduled & past closed tasks' },
] as const;

export function TaskSummary({ schedule, pending }: { schedule: TaskSchedule | undefined; pending: boolean }) {
  const plannedToday = (schedule?.due_today ?? 0) + (schedule?.done_today ?? 0);
  const progress = plannedToday ? Math.round(((schedule?.done_today ?? 0) / plannedToday) * 100) : 0;
  const cards = [
    { title: 'Due today', count: schedule?.due_today, icon: ListChecks, color: 'text-primary' },
    { title: 'Due tomorrow', count: schedule?.due_tomorrow, icon: CalendarClock, color: 'text-warning' },
    { title: 'Overdue', count: schedule?.overdue, icon: CircleAlert, color: 'text-destructive' },
  ];
  return (
    <section aria-label="Task overview" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map(({ title, count, icon: Icon, color }) => (
        <Card className="min-w-0 px-3 py-3 sm:px-4 sm:py-4" key={title}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
            <span className={cn('shrink-0 rounded-md bg-muted p-2', color)}><Icon className="size-4" aria-hidden="true" /></span>
          </div>
          {pending ? <LoadingState className="mt-2" label={'Loading ' + title.toLowerCase()} layout="inline" /> :
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">{count ?? '—'}</p>}
        </Card>
      ))}
      <Card className="min-w-0 space-y-2 px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-2">
          <h2 className="text-sm font-medium text-muted-foreground">Today’s progress</h2>
          <span className="text-sm font-semibold tabular-nums">{schedule ? progress + '%' : '—'}</span>
        </div>
        {pending ? <LoadingState label="Loading today’s progress" layout="inline" /> : schedule && (
          <>
            <Progress aria-label="Completion of tasks due today" value={progress} />
            <p className="text-xs text-muted-foreground">{schedule.done_today} of {plannedToday} due today completed</p>
          </>
        )}
      </Card>
    </section>
  );
}

interface TaskAgendaProps {
  actorId?: number | undefined;
  params: QueryParams;
  schedule: TaskSchedule | undefined;
  open: Partial<Record<ScheduleGroup, boolean>>;
  onToggle: (group: ScheduleGroup) => void;
  onOpenTask: (uuid: string, trigger: HTMLButtonElement) => void;
  statusLabels: Record<Task['status'], string>;
}

export function TaskAgenda(props: TaskAgendaProps) {
  return (
    <section aria-label="Tasks by date" className="grid min-w-0 gap-3 2xl:grid-cols-2">
      {groups.map((group) => (
        <TaskGroup key={group.key} group={group.key} title={group.title} {...props} />
      ))}
    </section>
  );
}

function TaskGroup({ group, title, actorId, params, schedule, open, onToggle, onOpenTask, statusLabels }: TaskAgendaProps & {
  group: ScheduleGroup; title: string;
}) {
  const [page, setPage] = useState(1);
  const contentId = useId();
  const triggerId = group === 'overdue' ? 'task-overdue' : contentId + '-button';
  const expanded = open[group] ?? group === 'today';
  const count = schedule?.[group];
  const query = useQuery({
    queryKey: ['tasks', 'schedule', actorId, group, params, page],
    queryFn: async () => (await apiClient.get<ApiPaginatedResponse<Task>>('/tasks', {
      params: { ...params, schedule: group, page },
    })).data,
    enabled: expanded && count !== 0,
  });
  const total = count ?? query.data?.meta.total;
  const tasks = query.data?.data ?? [];
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <Card className={cn('min-w-0 overflow-hidden', group !== 'tomorrow' && group !== 'upcoming' && '2xl:col-span-2', group === 'overdue' && 'border-destructive/30')}>
      <Button aria-controls={contentId} aria-expanded={expanded} className={cn(
        'min-h-11 w-full justify-start gap-2.5 rounded-none bg-muted/40 px-4 text-left text-sm font-semibold whitespace-normal hover:bg-muted focus-visible:ring-inset',
        group === 'overdue' && 'bg-destructive/5 text-destructive hover:bg-destructive/10',
      )} id={triggerId} onClick={() => onToggle(group)} type="button" variant="ghost">
        <Chevron aria-hidden="true" className="size-4 shrink-0" />
        {title}
        <span className="font-normal tabular-nums text-muted-foreground">{total === undefined ? '' : '(' + total + ')'}</span>
      </Button>
      <div aria-labelledby={triggerId} className="border-t" hidden={!expanded} id={contentId} role="region">
        {expanded && (count === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No tasks in this group.</p> :
          query.isPending ? <LoadingState className="p-3" label={'Loading ' + title.toLowerCase()} layout="table" columns={4} rows={2} /> :
          query.isError ? <div className="p-3"><ErrorState title="Could not load tasks" description={getSafeErrorMessage(query.error)} onRetry={() => void query.refetch()} /></div> :
          tasks.length > 0 ? (
            <>
              <Table aria-label={title} className="min-w-[32rem]">
                <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Assigned to</TableHead><TableHead>Due date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.uuid}>
                      <TableCell>
                        <Button className="h-auto p-0 text-left whitespace-normal text-foreground hover:text-primary" variant="link" aria-haspopup="dialog"
                          onClick={(event) => onOpenTask(task.uuid, event.currentTarget)}>{task.title}</Button>
                        <p className="mt-0.5 text-xs text-muted-foreground">{task.project.name} · <span className="capitalize">{task.priority}</span></p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{task.assignees.map((assignee) => assignee.name).join(', ') || 'Unassigned'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {task.due_date ? <time dateTime={task.due_date}>{task.due_date.slice(0, 10)}</time> : '—'}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{statusLabels[task.status]}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {query.data.meta.last_page > 1 && <div className="border-t p-3"><Pagination currentPage={page} onPageChange={setPage} totalPages={query.data.meta.last_page} /></div>}
            </>
          ) : <p className="px-4 py-3 text-sm text-muted-foreground">No tasks in this group.</p>)}
      </div>
    </Card>
  );
}

