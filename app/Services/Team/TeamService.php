<?php

namespace App\Services\Team;

use App\Actions\Teams\AddTeamMemberAction;
use App\Actions\Teams\AllocateTeamToProjectAction;
use App\Actions\Teams\CreateTeamAction;
use App\Actions\Teams\DeallocateTeamFromProjectAction;
use App\Actions\Teams\DeleteTeamAction;
use App\Actions\Teams\RemoveTeamMemberAction;
use App\Actions\Teams\UpdateTeamAction;
use App\Actions\Teams\UpdateTeamMemberRoleAction;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectTeam;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Policies\TeamPolicy;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class TeamService
{
    public function __construct(
        protected CreateTeamAction $createTeamAction,
        protected UpdateTeamAction $updateTeamAction,
        protected DeleteTeamAction $deleteTeamAction,
        protected AddTeamMemberAction $addTeamMemberAction,
        protected UpdateTeamMemberRoleAction $updateTeamMemberRoleAction,
        protected RemoveTeamMemberAction $removeTeamMemberAction,
        protected AllocateTeamToProjectAction $allocateTeamToProjectAction,
        protected DeallocateTeamFromProjectAction $deallocateTeamFromProjectAction,
    ) {}

    /**
     * List the teams the actor is authorized to access, with filtering and pagination.
     *
     * @param  array<string, mixed>  $filters
     */
    public function listTeams(User $actor, array $filters): LengthAwarePaginator
    {
        $query = Team::query()
            ->with([
                'leader:id,name,email,avatar_url,timezone',
                'leader.profile:id,user_id,job_title,department',
            ])
            ->withCount(['teamMembers as members_count']);

        if (! $actor->isSystemAdmin()) {
            $accessibleProjectIds = $this->accessibleProjectIds($actor);

            $query->where(function ($teamQuery) use ($actor, $accessibleProjectIds): void {
                $teamQuery->where('leader_id', $actor->id)
                    ->orWhereHas('teamMembers', fn ($memberQuery) => $memberQuery->where('user_id', $actor->id))
                    ->orWhereHas('projects', fn ($projectQuery) => $projectQuery->whereIn('projects.id', $accessibleProjectIds));
            });
        }

        if (! empty($filters['search'])) {
            $search = '%'.$filters['search'].'%';
            $query->where(function ($searchQuery) use ($search): void {
                $searchQuery->where('name', 'like', $search)
                    ->orWhere('slug', 'like', $search);
            });
        }

        $sortBy = $filters['sort_by'] ?? 'created_at';
        $sortDirection = $filters['sort_direction'] ?? 'desc';
        $perPage = (int) ($filters['per_page'] ?? 15);

        return $query->orderBy($sortBy, $sortDirection)->paginate($perPage);
    }

    /**
     * Resolve a team by UUID, enforcing the tenant boundary with a 404 response.
     */
    public function resolveScopedTeam(string $uuid, User $actor): Team
    {
        $team = Team::query()->where('uuid', $uuid)->firstOrFail();

        abort_unless(TeamPolicy::isWithinScope($actor, $team), 404);

        return $team;
    }

    /**
     * List a team's contextual membership roster.
     *
     * @param  array<string, mixed>  $filters
     */
    public function listMembers(Team $team, array $filters): LengthAwarePaginator
    {
        $perPage = (int) ($filters['per_page'] ?? 15);

        return TeamMember::query()
            ->with(['user:id,name,email,avatar_url,timezone', 'user.profile:id,user_id,job_title,department'])
            ->where('team_id', $team->id)
            ->orderBy('joined_at', 'asc')
            ->paginate($perPage);
    }

    /**
     * List the teams allocated to a project.
     *
     * @return Collection<int, Team>
     */
    public function listAllocatedTeams(Project $project): Collection
    {
        return $project->teams()
            ->with([
                'leader:id,name,email,avatar_url,timezone',
                'leader.profile:id,user_id,job_title,department',
            ])
            ->orderBy('teams.name', 'asc')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createTeam(User $actor, array $data): Team
    {
        return $this->createTeamAction->execute($actor, $data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateTeam(Team $team, array $data): Team
    {
        return $this->updateTeamAction->execute($team, $data);
    }

    public function deleteTeam(Team $team): Team
    {
        return $this->deleteTeamAction->execute($team);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function addMember(Team $team, array $data): TeamMember
    {
        return $this->addTeamMemberAction->execute($team, $data);
    }

    public function updateMemberRole(TeamMember $member, string $role): TeamMember
    {
        return $this->updateTeamMemberRoleAction->execute($member, $role);
    }

    public function removeMember(TeamMember $member): TeamMember
    {
        return $this->removeTeamMemberAction->execute($member);
    }

    public function allocateTeam(Project $project, Team $team): ProjectTeam
    {
        return $this->allocateTeamToProjectAction->execute($project, $team);
    }

    public function deallocateTeam(Project $project, Team $team): ProjectTeam
    {
        return $this->deallocateTeamFromProjectAction->execute($project, $team);
    }

    /**
     * @return Collection<int, int>
     */
    private function accessibleProjectIds(User $actor): Collection
    {
        $memberProjectIds = ProjectMember::query()
            ->where('user_id', $actor->id)
            ->pluck('project_id');

        $ownedProjectIds = Project::query()
            ->where('owner_id', $actor->id)
            ->pluck('id');

        return $memberProjectIds->merge($ownedProjectIds)->map(fn ($id): int => (int) $id)->unique()->values();
    }
}
