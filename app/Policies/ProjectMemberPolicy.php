<?php

namespace App\Policies;

use App\Enums\ProjectMemberRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;

class ProjectMemberPolicy
{
    /**
     * Determine whether the user can list the project's members.
     */
    public function viewAny(User $actor, Project $project): bool
    {
        return $actor->can('view', $project);
    }

    /**
     * Determine whether the user can add a member to the project.
     *
     * @param  string|null  $role  Contextual project role being granted
     */
    public function create(User $actor, Project $project, ?string $role = null): bool
    {
        if (! $actor->hasPermission('projects.invite')) {
            return false;
        }

        $actorRole = ProjectPolicy::contextualRole($actor, $project);

        if (! in_array($actorRole, [ProjectMemberRole::Owner, ProjectMemberRole::Lead], true)) {
            return false;
        }

        if ($role === null) {
            return true;
        }

        return $this->roleIsAssignable($actorRole, ProjectMemberRole::tryFrom($role));
    }

    /**
     * Determine whether the user can change the member's contextual role.
     *
     * @param  string|null  $role  Contextual project role being granted
     */
    public function update(User $actor, ProjectMember $member, ?string $role = null): bool
    {
        $project = $member->project;

        if (! $actor->hasPermission('projects.invite')) {
            return false;
        }

        $actorRole = ProjectPolicy::contextualRole($actor, $project);

        if (! in_array($actorRole, [ProjectMemberRole::Owner, ProjectMemberRole::Lead], true)) {
            return false;
        }

        // The project owner's membership row is protected from demotion.
        if ($member->user_id === $project->owner_id) {
            return false;
        }

        if ($role === null) {
            return true;
        }

        return $this->roleIsAssignable($actorRole, ProjectMemberRole::tryFrom($role));
    }

    /**
     * Determine whether the user can remove the member from the project.
     */
    public function delete(User $actor, ProjectMember $member): bool
    {
        if ($actor->isSystemAdmin()) {
            return true;
        }

        $project = $member->project;

        if (! $actor->hasPermission('projects.invite')) {
            return false;
        }

        $actorRole = ProjectPolicy::contextualRole($actor, $project);

        if (! in_array($actorRole, [ProjectMemberRole::Owner, ProjectMemberRole::Lead], true)) {
            return false;
        }

        // The project owner's membership row is protected from removal.
        return $member->user_id !== $project->owner_id;
    }

    /**
     * Determine which contextual roles the actor's own role may grant.
     */
    private function roleIsAssignable(?ProjectMemberRole $actorRole, ?ProjectMemberRole $targetRole): bool
    {
        if ($actorRole === null || $targetRole === null) {
            return false;
        }

        $assignable = $actorRole === ProjectMemberRole::Owner
            ? [ProjectMemberRole::Lead, ProjectMemberRole::Member, ProjectMemberRole::Viewer]
            : [ProjectMemberRole::Member, ProjectMemberRole::Viewer];

        return in_array($targetRole, $assignable, true);
    }
}
