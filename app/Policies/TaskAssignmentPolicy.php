<?php

namespace App\Policies;

use App\Enums\ProjectMemberRole;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;

class TaskAssignmentPolicy
{
    /**
     * Determine whether the user can view a task's assignments.
     */
    public function viewAny(User $actor, Task $task): bool
    {
        return $actor->can('view', $task);
    }

    /**
     * Determine whether the user can assign the task to project members.
     */
    public function create(User $actor, Task $task): bool
    {
        if (! $actor->hasPermission('tasks.assign')) {
            return false;
        }

        $contextualRole = ProjectPolicy::contextualRole($actor, $task->project);

        if ($contextualRole === null || $contextualRole === ProjectMemberRole::Viewer) {
            return false;
        }

        return in_array($contextualRole, [ProjectMemberRole::Owner, ProjectMemberRole::Lead], true)
            || $actor->id === $task->creator_id;
    }

    /**
     * Determine whether the user can remove an assignment from the task.
     */
    public function delete(User $actor, TaskAssignment $assignment): bool
    {
        if ($actor->isSystemAdmin()) {
            return true;
        }

        return $this->create($actor, $assignment->task);
    }
}
