<?php

namespace App\Policies;

use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;

class TeamMemberPolicy
{
    /**
     * Determine whether the user can list the team's members.
     */
    public function viewAny(User $actor, Team $team): bool
    {
        return $actor->can('view', $team);
    }

    /**
     * Determine whether the user can add a member to the team.
     */
    public function create(User $actor, Team $team): bool
    {
        if (! $actor->hasPermission('teams.manage')) {
            return false;
        }

        return TeamPolicy::hasContextualAuthority($actor, $team);
    }

    /**
     * Determine whether the user can change the team member's roster role.
     */
    public function update(User $actor, TeamMember $member): bool
    {
        if (! $actor->hasPermission('teams.manage')) {
            return false;
        }

        if (! TeamPolicy::hasContextualAuthority($actor, $member->team)) {
            return false;
        }

        // The designated team leader's roster row is protected.
        return $member->user_id !== $member->team->leader_id;
    }

    /**
     * Determine whether the user can remove the member from the team.
     */
    public function delete(User $actor, TeamMember $member): bool
    {
        if ($actor->isSystemAdmin()) {
            return true;
        }

        if (! $actor->hasPermission('teams.manage')) {
            return false;
        }

        if (! TeamPolicy::hasContextualAuthority($actor, $member->team)) {
            return false;
        }

        // The designated team leader's roster row is protected.
        return $member->user_id !== $member->team->leader_id;
    }
}
