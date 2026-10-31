<?php

namespace App\Actions\User;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class DeactivateUserAction
{
    /**
     * Deactivate a user account and immediately revoke their active tokens.
     *
     * @param  User  $actor
     * @param  User  $targetUser
     * @return User
     *
     * @throws AuthorizationException
     */
    public function execute(User $actor, User $targetUser): User
    {
        if ($actor->id === $targetUser->id) {
            throw new AuthorizationException('You cannot deactivate your own account.');
        }

        if ($targetUser->isSystemAdmin()) {
            if (! $actor->isSystemAdmin()) {
                throw new AuthorizationException('Only a System Administrator can deactivate another System Administrator.');
            }

            $activeAdminCount = User::whereHas('roles', function ($q) {
                $q->where('slug', UserRole::SystemAdmin->value);
            })->where('account_status', AccountStatus::Active)->count();

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
    }
}
