<?php

namespace App\Actions\Tasks;

use App\Enums\TaskStatus;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Notification\NotificationService;
use App\Services\Task\TaskService;
use App\Support\TaskDescription;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateTaskAction
{
    /**
     * Update task fields inside a database transaction, keeping completed_at in sync.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(Task $task, array $data, ?User $actor = null): Task
    {
        return DB::transaction(function () use ($task, $data, $actor): Task {
            $oldStatus = $task->status;
            $oldDueDate = $task->due_date?->format('Y-m-d H:i:s');

            $updates = Arr::only($data, [
                'title',
                'description',
                'status',
                'priority',
                'due_date',
                'estimated_hours',
                'actual_hours',
                'order_column',
            ]);

            if (array_key_exists('description', $updates)) {
                $updates['description_is_rich_text'] = (bool) ($data['description_is_rich_text'] ?? false);
                if ($updates['description_is_rich_text']) {
                    $updates['description'] = TaskDescription::sanitize($updates['description']);
                }
            }

            if (array_key_exists('parent', $data)) {
                Project::query()->lockForUpdate()->findOrFail($task->project_id);

                if ($data['parent'] === null) {
                    $updates['parent_id'] = null;
                } else {
                    $parent = Task::query()
                        ->where('uuid', $data['parent'])
                        ->where('project_id', $task->project_id)
                        ->lockForUpdate()
                        ->first(['id', 'parent_id']);

                    if ($parent === null) {
                        throw ValidationException::withMessages([
                            'parent' => 'The selected parent task was not found in this project.',
                        ]);
                    }

                    $updates['parent_id'] = $parent->id;
                    $visited = [$task->id => true];

                    while ($parent !== null) {
                        if (isset($visited[$parent->id])) {
                            throw ValidationException::withMessages([
                                'parent' => ['The selected parent would create or join a task hierarchy cycle.'],
                            ]);
                        }

                        $visited[$parent->id] = true;
                        $parent = $parent->parent_id === null
                            ? null
                            : Task::withTrashed()->where('project_id', $task->project_id)
                                ->lockForUpdate()->find($parent->parent_id, ['id', 'parent_id']);
                    }
                }
            }

            $newStatus = $oldStatus;

            if (array_key_exists('status', $updates)) {
                $status = TaskStatus::tryFrom((string) $updates['status']);
                $newStatus = $status ?? $oldStatus;

                $updates['completed_at'] = $newStatus === TaskStatus::Done
                    ? ($task->completed_at ?? now())
                    : null;
            }

            $task->update($updates);

            if (array_key_exists('followers', $data)) {
                $newFollowerIds = collect($data['followers'] ?? [])->map(fn ($id): int => (int) $id)->diff($task->followers->pluck('id'));
                $task->followers()->sync($data['followers'] ?? []);

                if ($newFollowerIds->isNotEmpty()) {
                    $newFollowers = User::query()->whereIn('id', $newFollowerIds)->get();
                    app(NotificationService::class)->notifyTask($task, 'task_followed', $actor, $newFollowers);
                }
            }

            $followers = $task->followers;

            if (array_key_exists('status', $updates) && $newStatus !== $oldStatus) {
                if ($newStatus === TaskStatus::Done) {
                    $recipients = $task->assignees
                        ->merge($task->creator ? [$task->creator] : [])
                        ->merge($followers);
                    app(NotificationService::class)->notifyTask($task, 'task_completed', $actor, $recipients);
                } elseif ($newStatus === TaskStatus::InReview) {
                    $leadRecipients = $task->project ? $task->project->members()->whereIn('role', ['owner', 'lead'])->get()->pluck('user')->filter() : collect();
                    $recipients = $leadRecipients
                        ->merge($task->creator ? [$task->creator] : [])
                        ->merge($followers);
                    app(NotificationService::class)->notifyTask($task, 'task_review_requested', $actor, $recipients);
                } else {
                    $recipients = $task->assignees->merge($followers);
                    app(NotificationService::class)->notifyTask($task, 'task_status_changed', $actor, $recipients);
                }
            }

            if (array_key_exists('due_date', $updates)) {
                $newDueDate = $task->due_date?->format('Y-m-d H:i:s');
                if ($newDueDate !== $oldDueDate) {
                    $recipients = $task->assignees->merge($followers);
                    app(NotificationService::class)->notifyTask($task, 'task_due_date_changed', $actor, $recipients);
                }
            }

            return $task->fresh([...TaskService::EAGER, 'followers.profile']);
        });
    }
}
