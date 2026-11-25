<?php

namespace App\Actions\Tasks;

use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;
use App\Services\Notification\NotificationService;
use App\Services\Task\TaskService;
use Illuminate\Support\Facades\DB;

class UnassignTaskAction
{
    /**
     * Remove a single user assignment from the task.
     */
    public function execute(Task $task, TaskAssignment $assignment, ?User $actor = null): Task
    {
        return DB::transaction(function () use ($task, $assignment, $actor): Task {
            $unassignedUser = $assignment->user;
            $assignment->delete();

            if ($unassignedUser !== null) {
                app(NotificationService::class)->notifyTask($task, 'task_unassigned', $actor, [$unassignedUser]);
            }

            return $task->fresh(TaskService::EAGER);
        });
    }
}
