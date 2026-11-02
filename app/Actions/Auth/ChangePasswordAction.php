<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class ChangePasswordAction
{
    /**
     * Change password for the authenticated user and optionally revoke other tokens.
     */
    public function execute(User $user, string $newPassword, bool $logoutOtherDevices = false): void
    {
        $user->forceFill([
            'password' => Hash::make($newPassword),
        ])->save();

        if ($logoutOtherDevices) {
            $currentTokenId = $user->currentAccessToken()?->id;

            if ($currentTokenId) {
                $user->tokens()->where('id', '!=', $currentTokenId)->delete();
            } else {
                $user->tokens()->delete();
            }
        }
    }
}
