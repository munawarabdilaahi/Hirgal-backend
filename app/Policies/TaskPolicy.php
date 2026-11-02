<?php

namespace App\Policies;

use App\Enums\ProjectMemberRole;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;

class TaskPolicy
{
    /**
     * Determine whether the user can view task lists.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('tasks.view');
    }

    /**
     * Determine whether the user can view a specific task.
     */
    public function view(User $actor, Task $task): bool
    {
        if (! $actor->hasPermission('tasks.view')) {
            return false;
        }

        return ProjectPolicy::isWithinScope($actor, $task->project);
    }

    /**
     * Determine whether the user can create tasks inside the project.
     */
    public function create(User $actor, Project $project): bool
    {
        if (! $actor->hasPermission('tasks.create')) {
            return false;
        }

        return in_array(ProjectPolicy::contextualRole($actor, $project), [
            ProjectMemberRole::Owner,
            ProjectMemberRole::Lead,
            ProjectMemberRole::Member,
        ], true);
    }

    /**
     * Determine whether the user can update the task.
     */
    public function update(User $actor, Task $task): bool
    {
        if (! $actor->hasPermission('tasks.update')) {
            return false;
        }

        return in_array(ProjectPolicy::contextualRole($actor, $task->project), [
            ProjectMemberRole::Owner,
            ProjectMemberRole::Lead,
            ProjectMemberRole::Member,
        ], true);
    }

    /**
     * Determine whether the user can soft-delete the task.
     */
    public function delete(User $actor, Task $task): bool
    {
        if ($actor->isSystemAdmin()) {
            return true;
        }

        if (! $actor->hasPermission('tasks.delete')) {
            return false;
        }

        return in_array(ProjectPolicy::contextualRole($actor, $task->project), [
            ProjectMemberRole::Owner,
            ProjectMemberRole::Lead,
        ], true);
    }
}
