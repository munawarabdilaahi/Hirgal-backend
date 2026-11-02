<?php

namespace App\Http\Controllers\Api\V1\Projects;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Projects\ListProjectMembersRequest;
use App\Http\Requests\Api\V1\Projects\StoreProjectMemberRequest;
use App\Http\Requests\Api\V1\Projects\UpdateProjectMemberRequest;
use App\Http\Resources\Api\V1\ProjectMemberResource;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Policies\ProjectPolicy;
use App\Services\Project\ProjectService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class ProjectMemberController extends Controller
{
    public function __construct(
        protected ProjectService $projectService,
    ) {}

    /**
     * List the project's contextual membership roster.
     */
    public function index(ListProjectMembersRequest $request, Project $project): JsonResponse
    {
        Gate::authorize('viewAny', [ProjectMember::class, $project]);

        $paginator = $this->projectService->listMembers($project, $request->validated());

        return ApiResponse::success(
            data: ProjectMemberResource::collection($paginator->items()),
            message: 'Project members retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Add a user to the project with a contextual role.
     */
    public function store(StoreProjectMemberRequest $request, Project $project): JsonResponse
    {
        Gate::authorize('create', [ProjectMember::class, $project]);

        $member = $this->projectService->addMember($request->user(), $project, $request->validated());
        $member->load($this->userRelations());

        return ApiResponse::success(
            data: new ProjectMemberResource($member),
            message: 'Project member added successfully.',
            status: Response::HTTP_CREATED
        );
    }

    /**
     * Change a member's contextual project role.
     */
    public function update(UpdateProjectMemberRequest $request, Project $project, ProjectMember $member): JsonResponse
    {
        abort_unless($member->project_id === $project->id, 404);

        Gate::authorize('update', [ProjectMember::class, $member]);

        $member = $this->projectService->updateMemberRole(
            $request->user(),
            $member,
            $request->validated('role')
        );
        $member->load($this->userRelations());

        return ApiResponse::success(
            data: new ProjectMemberResource($member),
            message: 'Project member role updated successfully.'
        );
    }

    /**
     * Remove a member from the project, cascading team roster removal.
     */
    public function destroy(Request $request, Project $project, ProjectMember $member): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $project), 404);
        abort_unless($member->project_id === $project->id, 404);

        Gate::authorize('delete', $member);

        $result = $this->projectService->removeMember($request->user(), $member);
        $result['member']->load($this->userRelations());

        return ApiResponse::success(
            data: new ProjectMemberResource($result['member']),
            message: 'Project member removed successfully.',
            meta: [
                'removed_teams' => $result['removed_teams'],
            ]
        );
    }

    /**
     * @return array<int, string>
     */
    private function userRelations(): array
    {
        return [
            'user:id,name,email,avatar_url,timezone',
            'user.profile:id,user_id,job_title,department',
        ];
    }
}
