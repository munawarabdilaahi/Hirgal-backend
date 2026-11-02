<?php

namespace App\Actions\Auth;

use App\Models\User;

class LogoutUserAction
{
    /**
     * Revoke tokens for the authenticated user.
     */
    public function execute(User $user, bool $allDevices = false): void
    {
        if ($allDevices) {
            $user->tokens()->delete();
        } else {
            $user->currentAccessToken()?->delete();
        }
    }
}
