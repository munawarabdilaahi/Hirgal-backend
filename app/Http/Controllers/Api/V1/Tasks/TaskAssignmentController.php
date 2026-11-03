<?php

namespace App\Http\Controllers\Api\V1\Tasks;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Tasks\RemoveTaskAssignmentRequest;
use App\Http\Requests\Api\V1\Tasks\StoreTaskAssignmentRequest;
use App\Http\Resources\Api\V1\TaskResource;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Policies\ProjectPolicy;
use App\Services\Task\TaskService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class TaskAssignmentController extends Controller
{
    public function __construct(
        protected TaskService $taskService,
    ) {}

    /**
     * Assign the task to one or more project members.
     */
    public function store(StoreTaskAssignmentRequest $request, Task $task): JsonResponse
    {
        Gate::authorize('create', [TaskAssignment::class, $task]);

        $task = $this->taskService->assignTask(
            $request->user(),
            $task,
            $request->validated('user_ids')
        );

        return ApiResponse::success(
            data: new TaskResource($task),
            message: 'Task assigned successfully.'
        );
    }

    /**
     * Remove a single user's assignment from the task.
     *
     * The route parameter stays a string so malformed identifiers reach the
     * request validator (422) instead of a scalar type coercion error (500).
     */
    public function destroy(RemoveTaskAssignmentRequest $request, Task $task, string $user): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $task->project), 404);

        $assignment = TaskAssignment::query()
            ->where('task_id', $task->id)
            ->where('user_id', (int) $user)
            ->first();

        abort_unless($assignment !== null, 404);

        Gate::authorize('delete', $assignment);

        $task = $this->taskService->unassignTask($task, $assignment);

        return ApiResponse::success(
            data: new TaskResource($task),
            message: 'Task assignment removed successfully.'
        );
    }
}
