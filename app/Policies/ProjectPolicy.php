<?php

namespace App\Policies;

use App\Enums\ProjectMemberRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;

class ProjectPolicy
{
    /**
     * Determine whether the user can view project lists.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('projects.view');
    }

    /**
     * Determine whether the user can view a specific project.
     */
    public function view(User $actor, Project $project): bool
    {
        if (! $actor->hasPermission('projects.view')) {
            return false;
        }

        return static::isWithinScope($actor, $project);
    }

    /**
     * Determine whether the user can create new projects.
     */
    public function create(User $actor): bool
    {
        return $actor->hasPermission('projects.create');
    }

    /**
     * Determine whether the user can update the project's metadata.
     */
    public function update(User $actor, Project $project): bool
    {
        if (! $actor->hasPermission('projects.update')) {
            return false;
        }

        return in_array(static::contextualRole($actor, $project), [
            ProjectMemberRole::Owner,
            ProjectMemberRole::Lead,
        ], true);
    }

    /**
     * Determine whether the user can archive the project.
     */
    public function archive(User $actor, Project $project): bool
    {
        if (! $actor->hasPermission('projects.archive')) {
            return false;
        }

        return in_array(static::contextualRole($actor, $project), [
            ProjectMemberRole::Owner,
            ProjectMemberRole::Lead,
        ], true);
    }

    /**
     * Determine whether the user can restore a soft-deleted project.
     */
    public function restore(User $actor, Project $project): bool
    {
        if (! $actor->hasPermission('projects.delete')) {
            return false;
        }

        return static::isProjectOwner($actor, $project);
    }

    /**
     * Determine whether the user can soft-delete the project.
     */
    public function delete(User $actor, Project $project): bool
    {
        if ($actor->isSystemAdmin()) {
            return true;
        }

        if (! $actor->hasPermission('projects.delete')) {
            return false;
        }

        return static::isProjectOwner($actor, $project);
    }

    /**
     * Determine whether the user can allocate a team to the project.
     */
    public function allocateTeam(User $actor, Project $project): bool
    {
        if (! $actor->hasPermission('projects.update')) {
            return false;
        }

        return in_array(static::contextualRole($actor, $project), [
            ProjectMemberRole::Owner,
            ProjectMemberRole::Lead,
        ], true);
    }

    /**
     * Determine whether the user can remove an allocated team from the project.
     */
    public function deallocateTeam(User $actor, Project $project): bool
    {
        if (! $actor->hasPermission('projects.update')) {
            return false;
        }

        return in_array(static::contextualRole($actor, $project), [
            ProjectMemberRole::Owner,
            ProjectMemberRole::Lead,
        ], true);
    }

    /**
     * Determine whether the project lies inside the actor's tenant boundary.
     *
     * Used to return 404 for cross-tenant resource access before ability checks.
     */
    public static function isWithinScope(User $actor, Project $project): bool
    {
        if ($actor->isSystemAdmin()) {
            return true;
        }

        if ($project->owner_id === $actor->id) {
            return true;
        }

        return ProjectMember::query()
            ->where('project_id', $project->id)
            ->where('user_id', $actor->id)
            ->exists();
    }

    /**
     * Resolve the actor's contextual project role, or null when not a member.
     */
    public static function contextualRole(User $actor, Project $project): ?ProjectMemberRole
    {
        if ($actor->isSystemAdmin()) {
            return ProjectMemberRole::Owner;
        }

        if ($project->owner_id === $actor->id) {
            return ProjectMemberRole::Owner;
        }

        $role = ProjectMember::query()
            ->where('project_id', $project->id)
            ->where('user_id', $actor->id)
            ->value('role');

        if ($role === null) {
            return null;
        }

        return $role instanceof ProjectMemberRole ? $role : ProjectMemberRole::tryFrom((string) $role);
    }

    /**
     * Determine whether the actor is the designated project owner.
     */
    public static function isProjectOwner(User $actor, Project $project): bool
    {
        if ($project->owner_id === $actor->id) {
            return true;
        }

        return ProjectMember::query()
            ->where('project_id', $project->id)
            ->where('user_id', $actor->id)
            ->where('role', ProjectMemberRole::Owner->value)
            ->exists();
    }
}
