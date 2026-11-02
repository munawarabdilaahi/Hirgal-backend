<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectTeam;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RemoveProjectMemberAction
{
    /**
     * Remove a project member, cascading team roster removal for teams that no
     * longer share any allocated project with the removed user.
     *
     * @return array{member: ProjectMember, removed_teams: array<int, string>}
     *
     * @throws AuthorizationException|ValidationException
     */
    public function execute(User $actor, ProjectMember $member): array
    {
        return DB::transaction(function () use ($actor, $member): array {
            $project = $member->project;
            $userId = $member->user_id;

            if ($member->user_id === $project->owner_id && ! $actor->isSystemAdmin()) {
                throw new AuthorizationException('The project owner membership cannot be removed.');
            }

            $allocatedTeamIds = ProjectTeam::query()
                ->where('project_id', $project->id)
                ->pluck('team_id');

            $teamIdsToCascade = [];

            if ($allocatedTeamIds->isNotEmpty()) {
                $rosterTeamIds = TeamMember::query()
                    ->whereIn('team_id', $allocatedTeamIds)
                    ->where('user_id', $userId)
                    ->pluck('team_id');

                foreach ($rosterTeamIds as $teamId) {
                    if ($this->stillSharesAllocatedProject($userId, (int) $teamId, (int) $project->id)) {
                        continue;
                    }

                    $team = Team::find($teamId);

                    if ($team !== null && $team->leader_id === $userId) {
                        throw ValidationException::withMessages([
                            'project' => "The user is the designated leader of allocated team \"{$team->name}\". Transfer team leadership or remove the team from the project first.",
                        ]);
                    }

                    $teamIdsToCascade[] = (int) $teamId;
                }
            }

            $removedTeams = [];

            if ($teamIdsToCascade !== []) {
                $removedTeams = Team::whereIn('id', $teamIdsToCascade)->pluck('name')->all();

                TeamMember::query()
                    ->whereIn('team_id', $teamIdsToCascade)
                    ->where('user_id', $userId)
                    ->delete();
            }

            $snapshot = clone $member;
            $member->delete();

            return [
                'member' => $snapshot,
                'removed_teams' => $removedTeams,
            ];
        });
    }

    /**
     * Determine whether the user still belongs to another project allocated to the team.
     */
    private function stillSharesAllocatedProject(int $userId, int $teamId, int $removedProjectId): bool
    {
        $allocatedProjectIds = ProjectTeam::query()
            ->where('team_id', $teamId)
            ->pluck('project_id')
            ->map(fn ($projectId): int => (int) $projectId)
            ->reject(fn (int $projectId): bool => $projectId === $removedProjectId);

        if ($allocatedProjectIds->isEmpty()) {
            return false;
        }

        $sharedViaMembership = ProjectMember::query()
            ->where('user_id', $userId)
            ->whereIn('project_id', $allocatedProjectIds)
            ->exists();

        if ($sharedViaMembership) {
            return true;
        }

        return Project::query()
            ->where('owner_id', $userId)
            ->whereIn('id', $allocatedProjectIds)
            ->exists();
    }
}
