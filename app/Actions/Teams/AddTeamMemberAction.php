<?php

namespace App\Actions\Teams;

use App\Enums\TeamMemberRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\TeamMember;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AddTeamMemberAction
{
    /**
     * Add a user to the team roster while preserving the team/project membership invariant.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws ValidationException
     */
    public function execute(Team $team, array $data): TeamMember
    {
        return DB::transaction(function () use ($team, $data): TeamMember {
            $userId = (int) $data['user_id'];
            $role = TeamMemberRole::tryFrom((string) ($data['role'] ?? TeamMemberRole::Member->value))
                ?? TeamMemberRole::Member;

            $this->assertCandidateSharesEveryAllocatedProject($team, $userId);

            return TeamMember::firstOrCreate(
                [
                    'team_id' => $team->id,
                    'user_id' => $userId,
                ],
                [
                    'role' => $role,
                    'joined_at' => now(),
                ]
            );
        });
    }

    /**
     * Every team member must belong to each project the team is allocated to.
     *
     * @throws ValidationException
     */
    private function assertCandidateSharesEveryAllocatedProject(Team $team, int $userId): void
    {
        $allocatedProjectIds = $team->projects()->pluck('projects.id')->map(fn ($id): int => (int) $id);

        if ($allocatedProjectIds->isEmpty()) {
            return;
        }

        $memberOfProjectIds = ProjectMember::query()
            ->where('user_id', $userId)
            ->whereIn('project_id', $allocatedProjectIds)
            ->pluck('project_id')
            ->map(fn ($id): int => (int) $id);

        $ownedProjectIds = Project::query()
            ->where('owner_id', $userId)
            ->whereIn('id', $allocatedProjectIds)
            ->pluck('id')
            ->map(fn ($id): int => (int) $id);

        $covered = $memberOfProjectIds->merge($ownedProjectIds)->unique();
        $missing = $allocatedProjectIds->diff($covered);

        if ($missing->isNotEmpty()) {
            throw ValidationException::withMessages([
                'user_id' => 'The user must be a member of every project this team is allocated to.',
            ]);
        }
    }
}
