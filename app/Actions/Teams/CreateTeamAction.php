<?php

namespace App\Actions\Teams;

use App\Enums\TeamMemberRole;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CreateTeamAction
{
    /**
     * Create a team with a designated leader together with the leader roster row.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(User $actor, array $data): Team
    {
        return DB::transaction(function () use ($actor, $data): Team {
            $leaderId = (int) ($data['leader_id'] ?? $actor->id);

            $team = Team::create([
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'leader_id' => $leaderId,
            ]);

            TeamMember::firstOrCreate(
                [
                    'team_id' => $team->id,
                    'user_id' => $leaderId,
                ],
                [
                    'role' => TeamMemberRole::Leader,
                    'joined_at' => now(),
                ]
            );

            return $team;
        });
    }
}
