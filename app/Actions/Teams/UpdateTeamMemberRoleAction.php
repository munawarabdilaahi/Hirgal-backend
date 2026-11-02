<?php

namespace App\Actions\Teams;

use App\Enums\TeamMemberRole;
use App\Models\TeamMember;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class UpdateTeamMemberRoleAction
{
    /**
     * Change a roster member's team role after re-validating the designated leader protection.
     *
     * @throws AuthorizationException
     */
    public function execute(TeamMember $member, string $role): TeamMember
    {
        return DB::transaction(function () use ($member, $role): TeamMember {
            if ($member->user_id === $member->team->leader_id && $role !== TeamMemberRole::Leader->value) {
                throw new AuthorizationException('The designated team leader role cannot be changed. Transfer team leadership first.');
            }

            $targetRole = TeamMemberRole::tryFrom($role);

            if ($targetRole === null) {
                throw new AuthorizationException('Unknown team member role.');
            }

            $member->update(['role' => $targetRole]);

            return $member->fresh();
        });
    }
}
