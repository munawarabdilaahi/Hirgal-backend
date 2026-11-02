<?php

namespace App\Actions\Teams;

use App\Models\TeamMember;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class RemoveTeamMemberAction
{
    /**
     * Remove a roster member after re-validating the designated leader protection.
     *
     * @throws AuthorizationException
     */
    public function execute(TeamMember $member): TeamMember
    {
        return DB::transaction(function () use ($member): TeamMember {
            if ($member->user_id === $member->team->leader_id) {
                throw new AuthorizationException('The designated team leader cannot be removed from the roster. Transfer team leadership first.');
            }

            $snapshot = clone $member;
            $member->delete();

            return $snapshot;
        });
    }
}
