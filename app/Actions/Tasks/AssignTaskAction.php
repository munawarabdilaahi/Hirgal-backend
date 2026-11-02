<?php

namespace App\Actions\Tasks;

use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;
use App\Services\Task\TaskService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssignTaskAction
{
    /**
     * Assign the task to users after verifying every assignee belongs to the project.
     *
     * @param  array<int, int>  $userIds
     *
     * @throws ValidationException
     */
    public function execute(User $actor, Task $task, array $userIds): Task
    {
        return DB::transaction(function () use ($actor, $task, $userIds): Task {
            $candidateIds = collect($userIds)->map(fn ($id): int => (int) $id)->unique()->values();

            $memberIds = ProjectMember::query()
                ->where('project_id', $task->project_id)
                ->whereIn('user_id', $candidateIds)
                ->pluck('user_id')
                ->map(fn ($id): int => (int) $id);

            $missing = $candidateIds->diff($memberIds);

            if ($missing->isNotEmpty()) {
                $missingNames = User::whereIn('id', $missing)->pluck('name')->implode(', ');

                throw ValidationException::withMessages([
                    'user_ids' => "Assignees must be members of the task's project. Not a project member: {$missingNames}.",
                ]);
            }

            foreach ($candidateIds as $userId) {
                TaskAssignment::firstOrCreate(
                    [
                        'task_id' => $task->id,
                        'user_id' => $userId,
                    ],
                    [
                        'assigned_by' => $actor->id,
                        'assigned_at' => now(),
                    ]
                );
            }

            return $task->fresh(TaskService::EAGER);
        });
    }
}
