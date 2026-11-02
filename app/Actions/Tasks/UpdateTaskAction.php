<?php

namespace App\Actions\Tasks;

use App\Enums\TaskStatus;
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
                if ($data['parent'] === null) {
                    $updates['parent_id'] = null;
                } else {
                    $parentId = Task::query()
                        ->where('uuid', $data['parent'])
                        ->where('project_id', $task->project_id)
                        ->value('id');

                    if ($parentId === null) {
                        throw ValidationException::withMessages([
                            'parent' => 'The selected parent task was not found in this project.',
                        ]);
                    }

                    $updates['parent_id'] = $parentId;
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
