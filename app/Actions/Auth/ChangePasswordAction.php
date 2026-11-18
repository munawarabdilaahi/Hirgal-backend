<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Notifications\PasswordChangedNotification;
use App\Services\Audit\ActivityLogger;
use Illuminate\Support\Facades\Hash;

class ChangePasswordAction
{
    public function __construct(
        protected ActivityLogger $audit,
    ) {}

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

        $user->notify(new PasswordChangedNotification);

        $this->audit->record(
            'account.password_changed',
            $user,
            $user,
            'Changed their account password.',
            ['other_devices_revoked' => $logoutOtherDevices]
        );
    }
}
