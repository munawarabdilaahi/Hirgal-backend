<?php

namespace App\Http\Controllers\Api\V1\Projects;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\TeamResource;
use App\Models\Project;
use App\Models\Team;
use App\Policies\ProjectPolicy;
use App\Policies\TeamPolicy;
use App\Services\Team\TeamService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class ProjectTeamController extends Controller
{
    public function __construct(
        protected TeamService $teamService,
    ) {}

    /**
     * List the teams allocated to the project.
     */
    public function index(Request $request, Project $project): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $project), 404);

        Gate::authorize('view', $project);
        Gate::authorize('viewAny', Team::class);

        $teams = $this->teamService->listAllocatedTeams($project);

        return ApiResponse::success(
            data: TeamResource::collection($teams),
            message: 'Allocated teams retrieved successfully.'
        );
    }

    /**
     * Allocate a team to the project.
     */
    public function store(Request $request, Project $project, Team $team): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $project), 404);
        abort_unless(TeamPolicy::isWithinScope($request->user(), $team), 404);

        Gate::authorize('allocateTeam', $project);

        $this->teamService->allocateTeam($project, $team);
        $team->load([
            'leader:id,name,email,avatar_url,timezone',
            'leader.profile:id,user_id,job_title,department',
        ]);

        return ApiResponse::success(
            data: new TeamResource($team),
            message: 'Team allocated to project successfully.',
            status: Response::HTTP_CREATED
        );
    }

    /**
     * Remove the team from the project.
     */
    public function destroy(Request $request, Project $project, Team $team): JsonResponse
    {
        abort_unless(ProjectPolicy::isWithinScope($request->user(), $project), 404);
        abort_unless(TeamPolicy::isWithinScope($request->user(), $team), 404);

        Gate::authorize('deallocateTeam', $project);

        $this->teamService->deallocateTeam($project, $team);

        return ApiResponse::success(
            data: null,
            message: 'Team deallocated from project successfully.'
        );
    }
}
