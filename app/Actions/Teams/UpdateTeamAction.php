<?php

namespace App\Actions\Teams;

use App\Enums\TeamMemberRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\TeamMember;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateTeamAction
{
    /**
     * Update team information inside a database transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(Team $team, array $data): Team
    {
        return DB::transaction(function () use ($team, $data): Team {
            $updates = Arr::only($data, ['name', 'description', 'leader_id']);

            if (array_key_exists('leader_id', $updates)) {
                $newLeaderId = (int) $updates['leader_id'];

                $this->assertLeaderEligible($team, $newLeaderId);

                TeamMember::firstOrCreate(
                    [
                        'team_id' => $team->id,
                        'user_id' => $newLeaderId,
                    ],
                    [
                        'role' => TeamMemberRole::Leader,
                        'joined_at' => now(),
                    ]
                );
            }

            $team->update($updates);

            return $team->fresh();
        });
    }

    /**
     * A new designated leader must already belong to every project the team is allocated to.
     *
     * @throws ValidationException
     */
    private function assertLeaderEligible(Team $team, int $leaderId): void
    {
        $allocatedProjectIds = $team->projects()->pluck('projects.id')->map(fn ($id): int => (int) $id);

        if ($allocatedProjectIds->isEmpty()) {
            return;
        }

        $memberOfProjectIds = ProjectMember::query()
            ->where('user_id', $leaderId)
            ->whereIn('project_id', $allocatedProjectIds)
            ->pluck('project_id')
            ->map(fn ($id): int => (int) $id);

        $ownedProjectIds = Project::query()
            ->where('owner_id', $leaderId)
            ->whereIn('id', $allocatedProjectIds)
            ->pluck('id')
            ->map(fn ($id): int => (int) $id);

        $covered = $memberOfProjectIds->merge($ownedProjectIds)->unique();
        $missing = $allocatedProjectIds->diff($covered);

        if ($missing->isNotEmpty()) {
            throw ValidationException::withMessages([
                'leader_id' => 'The designated leader must be a member of every project the team is allocated to.',
            ]);
        }
    }
}
