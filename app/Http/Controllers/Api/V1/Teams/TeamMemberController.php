<?php

namespace App\Http\Controllers\Api\V1\Teams;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Teams\ListTeamMembersRequest;
use App\Http\Requests\Api\V1\Teams\StoreTeamMemberRequest;
use App\Http\Requests\Api\V1\Teams\UpdateTeamMemberRequest;
use App\Http\Resources\Api\V1\TeamMemberResource;
use App\Models\Team;
use App\Models\TeamMember;
use App\Policies\TeamPolicy;
use App\Services\Team\TeamService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class TeamMemberController extends Controller
{
    public function __construct(
        protected TeamService $teamService,
    ) {}

    /**
     * List the team's contextual membership roster.
     */
    public function index(ListTeamMembersRequest $request, Team $team): JsonResponse
    {
        Gate::authorize('viewAny', [TeamMember::class, $team]);

        $paginator = $this->teamService->listMembers($team, $request->validated());

        return ApiResponse::success(
            data: TeamMemberResource::collection($paginator->items()),
            message: 'Team members retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Add a user to the team roster.
     */
    public function store(StoreTeamMemberRequest $request, Team $team): JsonResponse
    {
        Gate::authorize('create', [TeamMember::class, $team]);

        $member = $this->teamService->addMember($team, $request->validated());
        $member->load($this->userRelations());

        return ApiResponse::success(
            data: new TeamMemberResource($member),
            message: 'Team member added successfully.',
            status: Response::HTTP_CREATED
        );
    }

    /**
     * Change a roster member's team role.
     */
    public function update(UpdateTeamMemberRequest $request, Team $team, TeamMember $member): JsonResponse
    {
        abort_unless($member->team_id === $team->id, 404);

        Gate::authorize('update', [TeamMember::class, $member]);

        $member = $this->teamService->updateMemberRole($member, $request->validated('role'));
        $member->load($this->userRelations());

        return ApiResponse::success(
            data: new TeamMemberResource($member),
            message: 'Team member role updated successfully.'
        );
    }

    /**
     * Remove a user from the team roster.
     */
    public function destroy(Request $request, Team $team, TeamMember $member): JsonResponse
    {
        abort_unless(TeamPolicy::isWithinScope($request->user(), $team), 404);
        abort_unless($member->team_id === $team->id, 404);

        Gate::authorize('delete', $member);

        $member = $this->teamService->removeMember($member);
        $member->load($this->userRelations());

        return ApiResponse::success(
            data: new TeamMemberResource($member),
            message: 'Team member removed successfully.'
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
