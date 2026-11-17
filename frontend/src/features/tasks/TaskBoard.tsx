import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GripVertical, MoveRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getSafeErrorMessage } from '@/features/auth/auth-validation';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api/apiClient';
import type { Task } from './TasksRoute';

type Status = Task['status'];

export function TaskBoard({ tasks, statuses, onOpenTask }: {
  tasks: Task[];
  statuses: Record<Status, string>;
  onOpenTask: (uuid: string, trigger: HTMLButtonElement) => void;
}) {
  const queryClient = useQueryClient();
  const board = useRef<HTMLDivElement>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [destination, setDestination] = useState<Status | null>(null);
  const dragged = tasks.find((task) => task.uuid === draggedId);

  const movement = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: Status; restoreFocus: boolean }) =>
      apiClient.put(`/tasks/${task.uuid}`, { status }),
    onSuccess: async (_, { task, status, restoreFocus }) => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`Moved ${task.title} to ${statuses[status]}.`);
      if (restoreFocus) {
        requestAnimationFrame(() => {
          if (!board.current) return;
          const card = document.getElementById(`board-task-${task.uuid}`);
          (card ?? board.current).focus();
        });
      }
    },
    onError: (error) => toast.error(getSafeErrorMessage(error)),
  });

  function move(task: Task, status: Status, restoreFocus = false) {
    if (movement.isPending || task.can_update !== true || task.status === status) return;
    movement.mutate({ task, status, restoreFocus });
  }

  function clearDrag() {
    setDraggedId(null);
    setDestination(null);
  }

  const columns = Object.entries(statuses) as [Status, string][];
  return (
    <div ref={board} tabIndex={-1} role="region" aria-label="Task board" aria-busy={movement.isPending}
      className="grid grid-cols-[repeat(6,minmax(11rem,1fr))] gap-3 overflow-x-auto pb-2">
      {columns.map(([status, label]) => {
        const cards = tasks.filter((task) => task.status === status);
        const acceptsDrop = Boolean(dragged?.can_update && dragged.status !== status && !movement.isPending);
        return (
          <section key={status} aria-label={label} className={cn(
            'min-h-44 rounded-xl border bg-card p-3 shadow-card',
            acceptsDrop && 'border-dashed',
            destination === status && acceptsDrop && 'border-primary bg-accent ring-1 ring-primary ring-inset',
          )}
            onDragOver={(event) => {
              if (!acceptsDrop) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDestination(status);
            }}
            onDragLeave={(event) => {
              if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
                setDestination((current) => current === status ? null : current);
              }
            }}
            onDrop={(event) => {
              if (!acceptsDrop || !dragged) return;
              event.preventDefault();
              clearDrag();
              move(dragged, status);
            }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{label}</h2>
              <Badge variant="secondary" className="tabular-nums">{cards.length}</Badge>
            </div>
            {cards.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">No tasks</p> : (
              <ul className="space-y-2">
                {cards.map((task) => {
                  const canMove = task.can_update === true;
                  return (
                    <li key={task.uuid} draggable={canMove && !movement.isPending}
                      className={cn('flex items-start gap-1 rounded-lg border bg-background p-1', canMove && 'cursor-grab', task.uuid === draggedId && 'opacity-50')}
                      onDragStart={(event) => {
                        if (!canMove || movement.isPending) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', task.uuid);
                        setDraggedId(task.uuid);
                      }}
                      onDragEnd={clearDrag}>
                      {canMove && <GripVertical aria-hidden="true" className="ml-0.5 mt-2 size-3.5 shrink-0 text-muted-foreground" />}
                      <Button id={`board-task-${task.uuid}`} aria-haspopup="dialog" variant="ghost"
                        className="h-auto min-h-8 min-w-0 flex-1 justify-start px-1.5 text-left whitespace-normal wrap-anywhere"
                        onClick={(event) => onOpenTask(task.uuid, event.currentTarget)}>{task.title}</Button>
                      {canMove && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0"
                              aria-label={`Move ${task.title}`} disabled={movement.isPending}>
                              <MoveRight aria-hidden="true" className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {columns.filter(([value]) => value !== status).map(([value, name]) => (
                              <DropdownMenuItem key={value} onSelect={() => move(task, value, true)}>{name}</DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
