<?php

namespace App\Policies;

use App\Models\Habit;
use App\Models\User;

class HabitPolicy
{
    /**
     * Determine whether the user can view any habits.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('habits.manage');
    }

    /**
     * Determine whether the user can view the habit.
     */
    public function view(User $actor, Habit $habit): bool
    {
        return $actor->hasPermission('habits.manage') && $habit->user_id === $actor->id;
    }

    /**
     * Determine whether the user can create habits.
     */
    public function create(User $actor): bool
    {
        return $actor->hasPermission('habits.manage');
    }

    /**
     * Determine whether the user can update the habit.
     */
    public function update(User $actor, Habit $habit): bool
    {
        return $actor->hasPermission('habits.manage') && $habit->user_id === $actor->id;
    }

    /**
     * Determine whether the user can delete the habit.
     */
    public function delete(User $actor, Habit $habit): bool
    {
        return $actor->hasPermission('habits.manage') && $habit->user_id === $actor->id;
    }
}
