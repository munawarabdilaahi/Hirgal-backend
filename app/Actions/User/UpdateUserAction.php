<?php

namespace App\Actions\User;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class UpdateUserAction
{
    /**
     * Update target user information and role assignments safely.
     *
     * @param  User  $actor
     * @param  User  $targetUser
     * @param  array<string, mixed>  $data
     * @return User
     *
     * @throws AuthorizationException
     */
    public function execute(User $actor, User $targetUser, array $data): User
    {
        return DB::transaction(function () use ($actor, $targetUser, $data) {
            $userUpdates = Arr::only($data, ['name', 'email', 'timezone']);

            if (isset($data['account_status'])) {
                // If attempting to suspend or change status of a System Admin
                if ($targetUser->isSystemAdmin() && $data['account_status'] !== AccountStatus::Active->value) {
                    $activeAdminCount = User::whereHas('roles', function ($q) {
                        $q->where('slug', UserRole::SystemAdmin->value);
                    })->where('account_status', AccountStatus::Active)->count();

                    if ($activeAdminCount <= 1) {
                        throw new AuthorizationException('Cannot alter the account status of the only active System Administrator.');
                    }
                }

                $userUpdates['account_status'] = $data['account_status'];
            }

            if (! empty($userUpdates)) {
                $targetUser->update($userUpdates);
            }

            // Handle Role Assignment
            if (isset($data['role_id'])) {
                $targetRole = Role::findOrFail($data['role_id']);

                // If removing System Admin role from this user
                if ($targetUser->isSystemAdmin() && $targetRole->slug !== UserRole::SystemAdmin->value) {
                    $adminCount = User::whereHas('roles', function ($q) {
                        $q->where('slug', UserRole::SystemAdmin->value);
                    })->where('account_status', AccountStatus::Active)->count();

                    if ($adminCount <= 1) {
                        throw new AuthorizationException('Cannot demote the last remaining System Administrator.');
                    }
                }

                $targetUser->roles()->sync([$targetRole->id]);
            }

            return $targetUser->fresh(['roles.permissions', 'profile']);
        });
    }
}
