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
     *
     * @param  string  $email
     * @return void
     */
    public function execute(string $email): void
    {
        $rawToken = Str::random(64);
        $hashedToken = hash('sha256', $rawToken);

        // Store hashed token in password_reset_tokens
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            [
                'token' => $hashedToken,
                'created_at' => now(),
            ]
        );

        $user = User::where('email', $email)->first();

        if ($user) {
            $user->notify(new ResetPasswordNotification($rawToken, $email));
        }
    }
}
