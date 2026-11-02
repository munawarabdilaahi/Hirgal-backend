<?php

namespace App\Http\Controllers\Api\V1\Tasks;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Tasks\ListTasksRequest;
use App\Http\Requests\Api\V1\Tasks\StoreTaskRequest;
use App\Http\Requests\Api\V1\Tasks\UpdateTaskRequest;
use App\Http\Resources\Api\V1\TaskResource;
use App\Models\Project;
use App\Models\Task;
use App\Policies\ProjectPolicy;
use App\Services\Task\TaskService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class TaskController extends Controller
{
    public function __construct(
        protected TaskService $taskService,
    ) {}

    /**
     * List tasks visible to the actor with filtering and pagination.
     */
    public function index(ListTasksRequest $request): JsonResponse
    {
        $paginator = $this->taskService->listTasks($request->user(), $request->validated());

        return ApiResponse::success(
            data: TaskResource::collection($paginator->items()),
            message: 'Tasks retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Create a task inside the project.
     */
    public function store(StoreTaskRequest $request, Project $project): JsonResponse
    {
        Gate::authorize('create', [Task::class, $project]);

        $task = $this->taskService->createTask($request->user(), $project, $request->validated());

        return ApiResponse::success(
            data: new TaskResource($task),
            message: 'Task created successfully.',
            status: Response::HTTP_CREATED
        );
    }

    /**
     * Display a task the actor is scoped to.
     */
    public function show(Request $request, Task $task): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $task->project), 404);

        Gate::authorize('view', $task);

        $task->load(TaskService::EAGER);

        return ApiResponse::success(
            data: new TaskResource($task),
            message: 'Task details retrieved.'
        );
    }

    /**
     * Update permitted task fields.
     */
    public function update(UpdateTaskRequest $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $task = $this->taskService->updateTask($task, $request->validated());

        return ApiResponse::success(
            data: new TaskResource($task),
            message: 'Task updated successfully.'
        );
    }

    /**
     * Soft-delete the task.
     */
    public function destroy(Request $request, Task $task): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $task->project), 404);

        Gate::authorize('delete', $task);

        $this->taskService->deleteTask($task);

        return ApiResponse::success(
            data: null,
            message: 'Task deleted successfully.'
        );
    }
}
