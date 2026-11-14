<?php

namespace App\Actions\Tasks;

use App\Enums\TaskStatus;
use App\Models\Project;
use App\Models\Task;
use App\Services\Task\TaskService;
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
    public function execute(Task $task, array $data): Task
    {
        return DB::transaction(function () use ($task, $data): Task {
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

            if (array_key_exists('status', $updates)) {
                $status = TaskStatus::tryFrom((string) $updates['status']);

                $updates['completed_at'] = $status === TaskStatus::Done
                    ? ($task->completed_at ?? now())
                    : null;
            }

            $task->update($updates);

            return $task->fresh(TaskService::EAGER);
        });
    }
}
