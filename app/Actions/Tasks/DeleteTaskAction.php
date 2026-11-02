<?php

namespace App\Actions\Tasks;

use App\Models\Task;
use Illuminate\Support\Facades\DB;

class DeleteTaskAction
{
    /**
     * Soft-delete the task so it can be recovered from trash semantics.
     */
    public function execute(Task $task): Task
    {
        return DB::transaction(function () use ($task): Task {
            $task->delete();

            return $task;
        });
    }
}
