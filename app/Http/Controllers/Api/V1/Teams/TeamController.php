<?php

namespace App\Http\Controllers\Api\V1\Teams;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Teams\ListTeamsRequest;
use App\Http\Requests\Api\V1\Teams\StoreTeamRequest;
use App\Http\Requests\Api\V1\Teams\UpdateTeamRequest;
use App\Http\Resources\Api\V1\TeamResource;
use App\Models\Team;
use App\Policies\TeamPolicy;
use App\Services\Team\TeamService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class TeamController extends Controller
{
    public function __construct(
        protected TeamService $teamService,
    ) {}

    /**
     * List teams visible to the actor with filtering and pagination.
     */
    public function index(ListTeamsRequest $request): JsonResponse
    {
        $paginator = $this->teamService->listTeams($request->user(), $request->validated());

        return ApiResponse::success(
            data: TeamResource::collection($paginator->items()),
            message: 'Teams retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Create a new team with a designated leader.
     */
    public function store(StoreTeamRequest $request): JsonResponse
    {
        Gate::authorize('create', Team::class);

        $team = $this->teamService->createTeam($request->user(), $request->validated());
        $team->load($this->leaderRelations());

        return ApiResponse::success(
            data: new TeamResource($team),
            message: 'Team created successfully.',
            status: Response::HTTP_CREATED
        );
    }

    /**
     * Display a team the actor is scoped to.
     */
    public function show(Request $request, Team $team): JsonResponse
    {
        abort_unless(TeamPolicy::isWithinScope($request->user(), $team), 404);

        Gate::authorize('view', $team);

        $team->load($this->leaderRelations());

        return ApiResponse::success(
            data: new TeamResource($team),
            message: 'Team details retrieved.'
        );
    }

    /**
     * Update team information, including leadership transfer.
     */
    public function update(UpdateTeamRequest $request, Team $team): JsonResponse
    {
        Gate::authorize('update', $team);

        $team = $this->teamService->updateTeam($team, $request->validated());
        $team->load($this->leaderRelations());

        return ApiResponse::success(
            data: new TeamResource($team),
            message: 'Team updated successfully.'
        );
    }

    /**
     * Soft-delete the team.
     */
    public function destroy(Request $request, Team $team): JsonResponse
    {
        abort_unless(TeamPolicy::isWithinScope($request->user(), $team), 404);

        Gate::authorize('delete', $team);

        $this->teamService->deleteTeam($team);

        return ApiResponse::success(
            data: null,
            message: 'Team deleted successfully.'
        );
    }

    /**
     * @return array<int, string>
     */
    private function leaderRelations(): array
    {
        return [
            'leader:id,name,email,avatar_url,timezone',
            'leader.profile:id,user_id,job_title,department',
        ];
    }
}
