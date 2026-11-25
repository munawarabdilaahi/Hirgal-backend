<?php

namespace App\Actions\User;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class DeactivateUserAction
{
    /**
     * Deactivate a user account and immediately revoke their active tokens.
     *
     *
     * @throws AuthorizationException
     */
    public function execute(User $actor, User $targetUser): User
    {
        return DB::transaction(function () use ($actor, $targetUser) {
            if ($actor->id === $targetUser->id) {
                throw new AuthorizationException('You cannot deactivate your own account.');
            }

            if ($targetUser->isSystemAdmin()) {
                if (! $actor->isSystemAdmin()) {
                    throw new AuthorizationException('Only a System Administrator can deactivate another System Administrator.');
                }

                // SEC-03: Acquire shared pessimistic exclusive row lock on the System Admin coordination record
                Role::where('slug', UserRole::SystemAdmin->value)
                    ->lockForUpdate()
                    ->firstOrFail();

                $activeAdminCount = User::query()->join('user_roles', 'users.id', '=', 'user_roles.user_id')
                    ->join('roles', 'roles.id', '=', 'user_roles.role_id')
                    ->where('roles.slug', UserRole::SystemAdmin->value)
                    ->where('users.account_status', AccountStatus::Active)
                    ->lockForUpdate()->get(['users.id'])->count();

                if ($activeAdminCount <= 1) {
                    throw new AuthorizationException('Cannot deactivate the last active System Administrator.');
                }
            }

            $targetUser->update([
                'account_status' => AccountStatus::Suspended,
            ]);

            // Revoke active sessions / tokens immediately
            $targetUser->tokens()->delete();

            return $targetUser->fresh(['roles.permissions', 'profile']);
        });
    }
}
