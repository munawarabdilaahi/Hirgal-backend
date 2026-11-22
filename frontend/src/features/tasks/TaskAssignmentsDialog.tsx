import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FormDialog, FormDialogActions } from '@/components/ui/form-dialog';
import { TaskAssigneesField } from './TaskAssigneesField';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { getSafeErrorMessage } from '@/features/auth/auth-validation';
import { apiClient } from '@/services/api/apiClient';
import { taskApi } from '@/services/api/taskApi';
import type { ApiDirectoryUser } from '@/services/api/contracts';
import type { Task } from './TasksRoute';

interface TaskAssignmentsDialogProps {
  task: Task;
  onClose: () => void;
}

export function TaskAssignmentsDialog({ task, onClose }: TaskAssignmentsDialogProps) {
  const queryClient = useQueryClient();
  const projectUuid = task.project?.uuid;

  const roster = useQuery({
    queryKey: ['tasks', 'assignees', projectUuid],
    queryFn: async () => {
      const response = await taskApi.getAssignees({
        project: projectUuid,
        per_page: 100,
      });
      return response.data;
    },
  });

  const [assignees, setAssignees] = useState<ApiDirectoryUser[]>(() =>
    (task.assignees ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email ?? '',
      avatar_url: item.avatar_url ?? null,
      timezone: item.timezone ?? 'UTC',
      job_title: item.job_title ?? null,
      department: item.department ?? null,
      role: item.role ?? null,
    }))
  );

  const [followers, setFollowers] = useState<ApiDirectoryUser[]>(() =>
    (task.followers ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email ?? '',
      avatar_url: item.avatar_url ?? null,
      timezone: item.timezone ?? 'UTC',
      job_title: item.job_title ?? null,
      department: item.department ?? null,
      role: item.role ?? null,
    }))
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (assignees.length === 0) {
        throw new Error('Please select at least one assignee for this task.');
      }
      return apiClient.post(`/tasks/${task.uuid}/assign`, {
        user_ids: assignees.map((u) => u.id),
        followers: followers.map((u) => u.id),
        reassign: true,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
      toast.success('Task assignments and watchers updated.');
      onClose();
    },
    onError: (err) => {
      setValidationError(getSafeErrorMessage(err));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    if (assignees.length === 0) {
      setValidationError('Please select at least one primary assignee.');
      return;
    }
    saveMutation.mutate();
  }

  const eligibleUsers = roster.data ?? [];

  return (
    <FormDialog
      title="Manage assignees & watchers"
      description={`Update responsible assignees and watchers for "${task.title}".`}
      pending={saveMutation.isPending}
      onClose={onClose}
    >
      {roster.isPending && (
        <div className="py-6">
          <LoadingState label="Loading project members" layout="control" />
        </div>
      )}

      {roster.isError && (
        <div className="py-4">
          <ErrorState
            title="Could not load project members"
            description={getSafeErrorMessage(roster.error)}
            onRetry={() => void roster.refetch()}
          />
        </div>
      )}

      {roster.isSuccess && (
        <form className="grid gap-5 pt-1" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Primary Assignees</span>
            <p className="text-xs text-muted-foreground">
              Team members responsible for completing this task.
            </p>
            <TaskAssigneesField
              label="Primary assignees"
              eligibleUsers={eligibleUsers}
              selectedUsers={assignees}
              onChange={setAssignees}
              isLoading={roster.isPending}
            />
          </div>

          <div className="grid gap-1.5 border-t pt-4">
            <span className="text-sm font-medium">Followed by (Watchers)</span>
            <p className="text-xs text-muted-foreground">
              Secondary members who will be notified of status changes, comments, and task completion.
            </p>
            <TaskAssigneesField
              label="Followed by"
              eligibleUsers={eligibleUsers}
              selectedUsers={followers}
              onChange={setFollowers}
              isLoading={roster.isPending}
            />
          </div>

          {(validationError || saveMutation.isError) && (
            <p className="text-sm text-destructive" role="alert">
              {validationError || getSafeErrorMessage(saveMutation.error)}
            </p>
          )}

          <FormDialogActions
            pending={saveMutation.isPending}
            submitLabel="Save changes"
            submitDisabled={assignees.length === 0}
          />
        </form>
      )}
    </FormDialog>
  );
}
