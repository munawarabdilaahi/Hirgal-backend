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
     * @param  array<string, mixed>  $data
     *
     * @throws AuthorizationException
     */
    public function execute(User $actor, User $targetUser, array $data): User
    {
        return DB::transaction(function () use ($actor, $targetUser, $data) {
            // SEC-01: Disallow self-modification of system role or account status
            if (isset($data['role_id'])) {
                if ($actor->id === $targetUser->id) {
                    throw new AuthorizationException('Users are not permitted to modify their own system role.');
                }
                if (! $actor->isSystemAdmin()) {
                    throw new AuthorizationException('Only System Administrators can assign or modify system roles.');
                }
            }

            if (isset($data['account_status'])) {
                if ($actor->id === $targetUser->id) {
                    throw new AuthorizationException('Users are not permitted to modify their own account status.');
                }
                if (! $actor->isSystemAdmin()) {
                    throw new AuthorizationException('Only System Administrators can directly modify user account statuses.');
                }
            }

            // SEC-03: Concurrency protection for the last remaining System Administrator
            $isDemotingOrDeactivatingAdmin = false;

            if ($targetUser->isSystemAdmin()) {
                if (isset($data['account_status']) && $data['account_status'] !== AccountStatus::Active->value) {
                    $isDemotingOrDeactivatingAdmin = true;
                }
                if (isset($data['role_id'])) {
                    $targetRole = Role::findOrFail($data['role_id']);
                    if ($targetRole->slug !== UserRole::SystemAdmin->value) {
                        $isDemotingOrDeactivatingAdmin = true;
                    }
                }
            }

            if ($isDemotingOrDeactivatingAdmin) {
                // Acquire shared pessimistic exclusive row lock on the System Admin coordination record
                Role::where('slug', UserRole::SystemAdmin->value)
                    ->lockForUpdate()
                    ->firstOrFail();

                // Re-read and count active administrators inside the locked transaction
                $activeAdminCount = User::whereHas('roles', function ($q) {
                    $q->where('slug', UserRole::SystemAdmin->value);
                })->where('account_status', AccountStatus::Active)->count();

                if ($activeAdminCount <= 1) {
                    throw new AuthorizationException('Cannot demote or alter the account status of the only active System Administrator.');
                }
            }

            $userUpdates = Arr::only($data, ['name', 'email', 'timezone']);

            if (isset($data['account_status'])) {
                $userUpdates['account_status'] = $data['account_status'];
            }

            if (! empty($userUpdates)) {
                $targetUser->update($userUpdates);
            }

            // Handle Role Assignment
            if (isset($data['role_id'])) {
                $targetRole = Role::findOrFail($data['role_id']);
                $targetUser->roles()->sync([$targetRole->id]);
            }

            return $targetUser->fresh(['roles.permissions', 'profile']);
        });
    }
}
