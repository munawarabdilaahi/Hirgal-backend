<?php

namespace App\Actions\Auth;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ResetPasswordAction
{
    /**
     * Verify token and reset user password.
     *
     *
     * @throws ValidationException
     */
    public function execute(string $email, string $token, string $password): void
    {
        $record = DB::table('password_reset_tokens')->where('email', $email)->first();

        if (! $record) {
            throw ValidationException::withMessages([
                'token' => ['Invalid password reset request.'],
            ]);
        }

        $expectedHash = hash('sha256', $token);

        if (! hash_equals($record->token, $expectedHash)) {
            throw ValidationException::withMessages([
                'token' => ['Invalid or mismatched reset token.'],
            ]);
        }

        // 60-minute token expiration
        $createdAt = Carbon::parse($record->created_at);
        if ($createdAt->addMinutes(60)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            throw ValidationException::withMessages([
                'token' => ['Password reset token has expired. Please request a new link.'],
            ]);
        }

        $user = User::where('email', $email)->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => ['No user found with this email address.'],
            ]);
        }

        DB::transaction(function () use ($user, $password, $email) {
            $user->forceFill([
                'password' => Hash::make($password),
            ])->save();

            // Revoke all existing tokens for security
            $user->tokens()->delete();

            // Clean up reset token
            DB::table('password_reset_tokens')->where('email', $email)->delete();
        });
    }
}
