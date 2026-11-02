<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SendPasswordResetLinkAction
{
    /**
     * Generate a password reset token and dispatch the notification.
     */
    public function execute(string $email): void
    {
        $user = User::where('email', $email)->first();

        // SEC-06: Do not store orphaned tokens or allocate resources for non-existent emails
        if ($user) {
            $rawToken = Str::random(64);
            $hashedToken = hash('sha256', $rawToken);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email],
                [
                    'token' => $hashedToken,
                    'created_at' => now(),
                ]
            );

            $user->notify(new ResetPasswordNotification($rawToken, $email));
        }
    }
}
