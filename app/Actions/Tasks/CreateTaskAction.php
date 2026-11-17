<?php

namespace App\Actions\Tasks;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;
use App\Services\Task\TaskService;
use App\Support\TaskDescription;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateTaskAction
{
    /**
     * Create a task inside the project together with its initial assignments.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(User $actor, ?Project $project, array $data): Task
    {
        return DB::transaction(function () use ($actor, $project, $data): Task {
            $status = TaskStatus::tryFrom((string) ($data['status'] ?? TaskStatus::Todo->value))
                ?? TaskStatus::Todo;

            $parentId = null;

            if (! empty($data['parent'])) {
                $parentId = Task::query()
                    ->where('uuid', $data['parent'])
                    ->where('project_id', $project?->id)
                    ->value('id');

                if ($parentId === null) {
                    throw ValidationException::withMessages([
                        'parent' => 'The selected parent task was not found in this project.',
                    ]);
                }
            }

            $task = Task::create([
                'project_id' => $project?->id,
                'parent_id' => $parentId,
                'title' => $data['title'],
                'description' => ($data['description_is_rich_text'] ?? false)
                    ? TaskDescription::sanitize($data['description'] ?? null)
                    : ($data['description'] ?? null),
                'description_is_rich_text' => $data['description_is_rich_text'] ?? false,
                'context' => $data['context'] ?? 'project',
                'department' => $data['department'] ?? null,
                'start_date' => $data['start_date'] ?? null,
                'remind_on' => $data['remind_on'] ?? null,
                'reminder_due_at' => isset($data['remind_on'])
                    ? CarbonImmutable::parse($data['remind_on'], $actor->timezone)->startOfDay()->utc()
                    : null,
                'tags' => $data['tags'] ?? [],
                'status' => $status,
                'priority' => $data['priority'] ?? TaskPriority::Medium->value,
                'creator_id' => $actor->id,
                'due_date' => $data['due_date'] ?? null,
                'estimated_hours' => $data['estimated_hours'] ?? null,
                'order_column' => $data['order_column'] ?? 0,
                'completed_at' => $status === TaskStatus::Done ? now() : null,
            ]);

            $assigneeIds = collect($data['assignees'] ?? [])->map(fn ($id): int => (int) $id)->unique();

            foreach ($assigneeIds as $assigneeId) {
                TaskAssignment::firstOrCreate(
                    [
                        'task_id' => $task->id,
                        'user_id' => $assigneeId,
                    ],
                    [
                        'assigned_by' => $actor->id,
                        'assigned_at' => now(),
                    ]
                );
            }

            $task->followers()->sync($data['followers'] ?? []);

            return $task->load([...TaskService::EAGER, 'followers.profile']);
        });
    }
}
