<?php

namespace App\Policies;

use App\Enums\ProjectMemberRole;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskAssignment;
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
        return ($task->project_id === null || $this->viewAny($actor))
            && static::isWithinScope($actor, $task);
    }

    public static function isWithinScope(User $actor, Task $task): bool
    {
        return $task->project_id === null
            ? $task->creator_id === $actor->id
            : ProjectPolicy::isWithinScope($actor, $task->project);
    }

    /**
     * Determine whether the user can create tasks inside the project.
     */
    public function create(User $actor, ?Project $project = null): bool
    {
        return $project === null || ProjectPolicy::isWithinScope($actor, $project);
    }

    public function assignOnCreation(User $actor, Project $project): bool
    {
        return $actor->can('create', [TaskAssignment::class, new Task([
            'project_id' => $project->id,
            'creator_id' => $actor->id,
        ])->setRelation('project', $project)]);
    }

    /**
     * Determine whether the user can update the task.
     */
    public function update(User $actor, Task $task): bool
    {
        if ($task->project_id === null) {
            return $task->creator_id === $actor->id && $actor->hasPermission('tasks.update');
        }

        $contextualRole = ProjectPolicy::contextualRole($actor, $task->project);
        if ($contextualRole === null || $contextualRole === ProjectMemberRole::Viewer) {
            return false;
        }

        if ($task->assignments()->where('user_id', $actor->id)->exists()) {
            return true;
        }

        if (! $actor->hasPermission('tasks.update')) {
            return false;
        }

        return in_array($contextualRole, [
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
