<?php

namespace App\Http\Controllers\Api\V1\Tasks;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Tasks\ListTaskAssigneesRequest;
use App\Http\Requests\Api\V1\Tasks\RemoveTaskAssignmentRequest;
use App\Http\Requests\Api\V1\Tasks\StoreTaskAssignmentRequest;
use App\Http\Resources\Api\V1\TaskResource;
use App\Http\Resources\Api\V1\UserDirectoryResource;
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
     * List users eligible to be assigned to tasks.
     */
    public function index(ListTaskAssigneesRequest $request): JsonResponse
    {
        $paginator = $this->taskService->listAssignableUsers(
            $request->user(),
            $request->validated()
        );

        return ApiResponse::success(
            data: UserDirectoryResource::collection($paginator->items()),
            message: 'Assignable users retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Assign the task to one or more project members.
     */
    public function store(StoreTaskAssignmentRequest $request, Task $task): JsonResponse
    {
        Gate::authorize('create', [TaskAssignment::class, $task]);

        $isReassignment = (bool) ($request->boolean('reassign') || $request->boolean('is_reassignment'));

        $task = $this->taskService->assignTask(
            $request->user(),
            $task,
            $request->validated('user_ids'),
            $isReassignment
        );

        if ($request->has('followers')) {
            $task->followers()->sync($request->validated('followers') ?? []);
        }

        return ApiResponse::success(
            data: new TaskResource($task->load([...TaskService::EAGER, 'followers.profile'])),
            message: $isReassignment ? 'Task reassigned successfully.' : 'Task assigned successfully.'
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

        $task = $this->taskService->unassignTask($task, $assignment, $request->user());

        return ApiResponse::success(
            data: new TaskResource($task),
            message: 'Task assignment removed successfully.'
        );
    }
}
