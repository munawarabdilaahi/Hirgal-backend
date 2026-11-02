<?php

namespace App\Policies;

use App\Enums\ProjectMemberRole;
use App\Enums\TeamMemberRole;
use App\Models\ProjectTeam;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;

class TeamPolicy
{
    /**
     * Determine whether the user can view team lists.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('teams.view');
    }

    /**
     * Determine whether the user can view a specific team.
     */
    public function view(User $actor, Team $team): bool
    {
        if (! $actor->hasPermission('teams.view')) {
            return false;
        }

        return static::isWithinScope($actor, $team);
    }

    /**
     * Determine whether the user can create new teams.
     */
    public function create(User $actor): bool
    {
        return $actor->hasPermission('teams.create');
    }

    /**
     * Determine whether the user can update the team's information.
     */
    public function update(User $actor, Team $team): bool
    {
        if (! $actor->hasPermission('teams.update')) {
            return false;
        }

        return static::hasContextualAuthority($actor, $team);
    }

    /**
     * Determine whether the user can soft-delete the team.
     */
    public function delete(User $actor, Team $team): bool
    {
        if ($actor->isSystemAdmin()) {
            return true;
        }

        return $actor->hasPermission('teams.delete');
    }

    /**
     * Determine whether the team lies inside the actor's tenant boundary.
     *
     * Used to return 404 for cross-tenant resource access before ability checks.
     */
    public static function isWithinScope(User $actor, Team $team): bool
    {
        if ($actor->isSystemAdmin()) {
            return true;
        }

        if ($team->leader_id === $actor->id) {
            return true;
        }

        $isRosterMember = TeamMember::query()
            ->where('team_id', $team->id)
            ->where('user_id', $actor->id)
            ->exists();

        if ($isRosterMember) {
            return true;
        }

        return static::sharesAllocatedProject($actor, $team);
    }

    /**
     * Determine whether the user holds contextual leadership authority over the team.
     */
    public static function hasContextualAuthority(User $actor, Team $team): bool
    {
        if ($actor->isSystemAdmin()) {
            return true;
        }

        if ($team->leader_id === $actor->id) {
            return true;
        }

        $isRosterLeader = TeamMember::query()
            ->where('team_id', $team->id)
            ->where('user_id', $actor->id)
            ->where('role', TeamMemberRole::Leader->value)
            ->exists();

        if ($isRosterLeader) {
            return true;
        }

        return ProjectTeam::query()
            ->where('team_id', $team->id)
            ->whereHas('project', function ($query) use ($actor): void {
                $query->where(function ($projectQuery) use ($actor): void {
                    $projectQuery->where('owner_id', $actor->id)
                        ->orWhereHas('projectMembers', function ($memberQuery) use ($actor): void {
                            $memberQuery->where('user_id', $actor->id)
                                ->whereIn('role', [
                                    ProjectMemberRole::Owner->value,
                                    ProjectMemberRole::Lead->value,
                                ]);
                        });
                });
            })
            ->exists();
    }

    /**
     * Determine whether the user belongs to a project the team is allocated to.
     */
    private static function sharesAllocatedProject(User $actor, Team $team): bool
    {
        return ProjectTeam::query()
            ->where('team_id', $team->id)
            ->whereHas('project', function ($query) use ($actor): void {
                $query->where(function ($projectQuery) use ($actor): void {
                    $projectQuery->where('owner_id', $actor->id)
                        ->orWhereHas('projectMembers', fn ($memberQuery) => $memberQuery->where('user_id', $actor->id));
                });
            })
            ->exists();
    }
}
