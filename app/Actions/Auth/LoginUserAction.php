<?php

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUserAction
{
    /**
     * Authenticate user credentials and issue an access token.
     *
     * @return array{user: User, token: string}
     *
     * @throws ValidationException|AuthorizationException
     */
    public function execute(string $email, string $password, ?string $deviceName = null): array
    {
        $user = User::with(['roles.permissions', 'profile'])
            ->where('email', $email)
            ->first();

        // SEC-05: Mitigation for timing-based user enumeration
        if (! $user) {
            // Perform dummy bcrypt verification to balance execution time with genuine credentials
            Hash::check($password, '$2y$12$u4cijEATRWhZzLoDUX.K.uGPM0S75v0v3Bu71m5IWJZxrNrFjbnG2');

            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if (! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        // Account status check
        if ($user->account_status !== AccountStatus::Active) {
            $status = $user->account_status?->value ?? 'inactive';

            throw new AuthorizationException(
                "Your account is {$status}. Please contact an administrator."
            );
        }

        // Record last login timestamp
        $user->forceFill([
            'last_login_at' => now(),
        ])->saveQuietly();

        $tokenName = $deviceName ?: 'auth-token';
        $token = $user->createToken($tokenName)->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }
}
