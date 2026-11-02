<?php

namespace App\Http\Controllers\Api\V1\Projects;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Projects\ListProjectsRequest;
use App\Http\Requests\Api\V1\Projects\StoreProjectRequest;
use App\Http\Requests\Api\V1\Projects\UpdateProjectRequest;
use App\Http\Resources\Api\V1\ProjectResource;
use App\Models\Project;
use App\Policies\ProjectPolicy;
use App\Services\Project\ProjectService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class ProjectController extends Controller
{
    public function __construct(
        protected ProjectService $projectService,
    ) {}

    /**
     * List projects visible to the actor with filtering and pagination.
     */
    public function index(ListProjectsRequest $request): JsonResponse
    {
        $paginator = $this->projectService->listProjects($request->user(), $request->validated());

        return ApiResponse::success(
            data: ProjectResource::collection($paginator->items()),
            message: 'Projects retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Create a new project owned by the actor.
     */
    public function store(StoreProjectRequest $request): JsonResponse
    {
        $project = $this->projectService->createProject($request->user(), $request->validated());
        $project->loadCount('projectMembers as members_count');

        return ApiResponse::success(
            data: new ProjectResource($project),
            message: 'Project created successfully.',
            status: Response::HTTP_CREATED
        );
    }

    /**
     * Display a project the actor is scoped to.
     */
    public function show(Request $request, Project $project): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $project), 404);

        Gate::authorize('view', $project);

        $project->loadCount('projectMembers as members_count');

        return ApiResponse::success(
            data: new ProjectResource($project),
            message: 'Project details retrieved.'
        );
    }

    /**
     * Update permitted project fields.
     */
    public function update(UpdateProjectRequest $request, Project $project): JsonResponse
    {
        Gate::authorize('update', $project);

        $project = $this->projectService->updateProject($project, $request->validated());
        $project->loadCount('projectMembers as members_count');

        return ApiResponse::success(
            data: new ProjectResource($project),
            message: 'Project updated successfully.'
        );
    }

    /**
     * Archive the project.
     */
    public function archive(Request $request, Project $project): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $project), 404);

        Gate::authorize('archive', $project);

        $project = $this->projectService->archiveProject($project);
        $project->loadCount('projectMembers as members_count');

        return ApiResponse::success(
            data: new ProjectResource($project),
            message: 'Project archived successfully.'
        );
    }

    /**
     * Restore a soft-deleted project.
     */
    public function restore(Request $request, Project $project): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $project), 404);

        Gate::authorize('restore', $project);

        $project = $this->projectService->restoreProject($project);
        $project->loadCount('projectMembers as members_count');

        return ApiResponse::success(
            data: new ProjectResource($project),
            message: 'Project restored successfully.'
        );
    }

    /**
     * Soft-delete the project.
     */
    public function destroy(Request $request, Project $project): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $project), 404);

        Gate::authorize('delete', $project);

        $this->projectService->deleteProject($project);

        return ApiResponse::success(
            data: null,
            message: 'Project deleted successfully.'
        );
    }
}
