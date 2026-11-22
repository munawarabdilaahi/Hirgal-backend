<?php

namespace App\Actions\Tasks;

use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;
use App\Services\Notification\NotificationService;
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
    public function execute(User $actor, Task $task, array $userIds, bool $isReassignment = false): Task
    {
        return DB::transaction(function () use ($actor, $task, $userIds, $isReassignment): Task {
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

            if ($isReassignment) {
                $previousAssignments = TaskAssignment::query()
                    ->where('task_id', $task->id)
                    ->whereNotIn('user_id', $candidateIds)
                    ->with('user')
                    ->get();

                foreach ($previousAssignments as $previous) {
                    $unassignedUser = $previous->user;
                    $previous->delete();

                    if ($unassignedUser !== null && $unassignedUser->id !== $actor->id) {
                        app(NotificationService::class)->notifyTask($task, 'task_unassigned', $actor, [$unassignedUser]);
                    }
                }
            }

            $newlyAssignedIds = [];

            foreach ($candidateIds as $userId) {
                $assignment = TaskAssignment::firstOrCreate(
                    [
                        'task_id' => $task->id,
                        'user_id' => $userId,
                    ],
                    [
                        'assigned_by' => $actor->id,
                        'assigned_at' => now(),
                    ]
                );

                if ($assignment->wasRecentlyCreated && $userId !== $actor->id) {
                    $newlyAssignedIds[] = $userId;
                }
            }

            if (! empty($newlyAssignedIds)) {
                $event = $isReassignment ? 'task_reassigned' : 'task_assigned';
                $recipients = User::query()->whereIn('id', $newlyAssignedIds)->get();
                app(NotificationService::class)->notifyTask($task, $event, $actor, $recipients);
            }

            return $task->fresh(TaskService::EAGER);
        });
    }
}
