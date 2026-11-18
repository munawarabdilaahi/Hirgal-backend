<?php

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Models\User;
use App\Services\Security\TwoFactorAuthenticationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUserAction
{
    public function __construct(
        protected TwoFactorAuthenticationService $twoFactor,
    ) {}

    /**
     * Authenticate user credentials and issue an access token.
     *
     * @return array{user: User, token: string}
     *
     * @throws ValidationException|AuthorizationException
     */
    public function execute(string $email, string $password, ?string $deviceName = null, ?string $twoFactorCode = null): array
    {
        $user = $this->authenticate($email, $password, $twoFactorCode);
        $token = $user->createToken($deviceName ?: 'auth-token')->plainTextToken;

        return ['user' => $user, 'token' => $token];
    }

    public function authenticate(string $email, string $password, ?string $twoFactorCode = null): User
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

        if ($user->hasTwoFactorAuthentication()) {
            $this->verifyTwoFactorChallenge($user, $twoFactorCode);
        }

        // Record last login timestamp
        $user->forceFill([
            'last_login_at' => now(),
        ])->saveQuietly();

        return $user;
    }

    private function verifyTwoFactorChallenge(User $user, ?string $code): void
    {
        if ($code === null || trim($code) === '') {
            throw ValidationException::withMessages([
                'two_factor_code' => ['Enter the six-digit code from your authenticator app.'],
            ]);
        }

        $secret = (string) $user->two_factor_secret;

        if ($secret !== '' && $this->twoFactor->confirmCode($user, $secret, $code)) {
            return;
        }

        $recoveryCodes = $user->two_factor_recovery_codes ?? [];
        $remaining = $this->twoFactor->consumeRecoveryCode($recoveryCodes, $code);

        if ($remaining === null) {
            throw ValidationException::withMessages([
                'two_factor_code' => ['The authentication code is invalid or has expired.'],
            ]);
        }

        $user->forceFill(['two_factor_recovery_codes' => $remaining])->save();
    }
}
