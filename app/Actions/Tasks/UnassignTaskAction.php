<?php

namespace App\Actions\Tasks;

use App\Models\Task;
use App\Models\TaskAssignment;
use App\Services\Task\TaskService;
use Illuminate\Support\Facades\DB;

class UnassignTaskAction
{
    /**
     * Remove a single user assignment from the task.
     */
    public function execute(Task $task, TaskAssignment $assignment): Task
    {
        return DB::transaction(function () use ($task, $assignment): Task {
            $assignment->delete();

            return $task->fresh(TaskService::EAGER);
        });
    }
}
