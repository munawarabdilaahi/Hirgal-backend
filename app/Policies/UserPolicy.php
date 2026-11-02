<?php

namespace App\Policies;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;

class UserPolicy
{
    /**
     * Determine whether the user can view the user list.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('users.view');
    }

    /**
     * Determine whether the user can view the collaborative user directory.
     */
    public function viewDirectory(User $actor): bool
    {
        return $actor->hasPermission('users.view_directory') || $actor->hasPermission('users.view');
    }

    /**
     * Determine whether the user can view an individual user profile.
     */
    public function view(User $actor, User $target): bool
    {
        if ($actor->id === $target->id) {
            return true;
        }

        return $actor->hasPermission('users.view');
    }

    /**
     * Determine whether the user can create new users.
     */
    public function create(User $actor): bool
    {
        return $actor->hasPermission('users.create');
    }

    /**
     * Determine whether the user can update the target user via administrative endpoint.
     */
    public function update(User $actor, User $target): bool
    {
        // Administrative user update requires explicit users.update capability
        if (! $actor->hasPermission('users.update')) {
            return false;
        }

        // Only a System Admin can modify another user possessing the System Admin role
        if ($target->isSystemAdmin() && ! $actor->isSystemAdmin()) {
            return false;
        }

        return true;
    }

    /**
     * Determine whether the user can activate the target user.
     */
    public function activate(User $actor, User $target): bool
    {
        if (! $actor->hasPermission('users.update')) {
            return false;
        }

        // Only a System Admin can activate another System Admin
        if ($target->isSystemAdmin() && ! $actor->isSystemAdmin()) {
            return false;
        }

        return true;
    }

    /**
     * Determine whether the user can deactivate the target user.
     */
    public function deactivate(User $actor, User $target): bool
    {
        // Users cannot deactivate their own account
        if ($actor->id === $target->id) {
            return false;
        }

        if (! $actor->hasPermission('users.delete')) {
            return false;
        }

        // Only a System Admin can deactivate another user with System Admin role
        if ($target->isSystemAdmin()) {
            if (! $actor->isSystemAdmin()) {
                return false;
            }

            // Cannot deactivate if target is the last active System Admin
            $activeAdminCount = User::whereHas('roles', function ($q) {
                $q->where('slug', UserRole::SystemAdmin->value);
            })->where('account_status', AccountStatus::Active)->count();

            if ($activeAdminCount <= 1) {
                return false;
            }
        }

        return true;
    }

    /**
     * Determine whether the user can delete the target user.
     */
    public function delete(User $actor, User $target): bool
    {
        // Users cannot delete their own account
        if ($actor->id === $target->id) {
            return false;
        }

        if (! $actor->hasPermission('users.delete')) {
            return false;
        }

        if ($target->isSystemAdmin() && ! $actor->isSystemAdmin()) {
            return false;
        }

        return true;
    }
}
