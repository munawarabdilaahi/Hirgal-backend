<?php

namespace App\Actions\User;

use App\Enums\AccountStatus;
use App\Models\User;

class ActivateUserAction
{
    /**
     * Activate a user account.
     *
     * @param  User  $targetUser
     * @return User
     */
    public function execute(User $targetUser): User
    {
        $targetUser->update([
            'account_status' => AccountStatus::Active,
        ]);

        return $targetUser->fresh(['roles.permissions', 'profile']);
    }
}
