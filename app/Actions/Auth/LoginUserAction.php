<?php

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Models\User;
use App\Services\Security\TwoFactorAuthenticationService;
use App\Services\Security\TwoFactorChallengeService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUserAction
{
    public function __construct(
        protected TwoFactorAuthenticationService $twoFactor,
        protected TwoFactorChallengeService $challengeService,
    ) {}

    /**
     * Authenticate user credentials and either issue an access token or return a 2FA challenge.
     *
     * @return array{user: ?User, token: ?string, two_factor_required: bool, challenge_token?: string, expires_at?: string}
     *
     * @throws ValidationException|AuthorizationException
     */
    public function execute(string $email, string $password, ?string $deviceName = null, ?string $twoFactorCode = null): array
    {
        $user = $this->validateCredentials($email, $password);

        // If a 2FA code is directly supplied (e.g. backward compatible API request or concurrency tests)
        if ($twoFactorCode !== null && trim($twoFactorCode) !== '') {
            return DB::transaction(function () use ($user, $password, $deviceName, $twoFactorCode): array {
                $locked = User::query()->lockForUpdate()->findOrFail($user->id);

                if (! hash_equals($user->password, $locked->password) && ! Hash::check($password, $locked->password)) {
                    throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
                }

                if ($locked->account_status !== AccountStatus::Active) {
                    $status = $locked->account_status?->value ?? 'inactive';

                    throw new AuthorizationException("Your account is {$status}. Please contact an administrator.");
                }

                if ($locked->hasTwoFactorAuthentication()) {
                    $this->verifyTwoFactorChallenge($locked, $twoFactorCode);
                }

                $token = $locked->createToken($deviceName ?: 'auth-token')->plainTextToken;

                $locked->forceFill([
                    'last_login_at' => now(),
                ])->saveQuietly();

                return [
                    'user' => $locked,
                    'token' => $token,
                    'two_factor_required' => false,
                ];
            });
        }

        // Conditional 2FA flow: user has 2FA enabled
        if ($user->hasTwoFactorAuthentication()) {
            $challenge = $this->challengeService->createChallenge($user, $deviceName);

            return [
                'user' => null,
                'token' => null,
                'two_factor_required' => true,
                'challenge_token' => $challenge['challenge_token'],
                'expires_at' => $challenge['expires_at']->toIso8601String(),
            ];
        }

        // 2FA disabled: complete normal authentication
        $token = $user->createToken($deviceName ?: 'auth-token')->plainTextToken;

        $user->forceFill([
            'last_login_at' => now(),
        ])->saveQuietly();

        return [
            'user' => $user,
            'token' => $token,
            'two_factor_required' => false,
        ];
    }

    /**
     * Validate user credentials and active account status.
     *
     * @throws ValidationException|AuthorizationException
     */
    public function validateCredentials(string $email, string $password): User
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

        return $user;
    }

    public function authenticate(string $email, string $password, ?string $twoFactorCode = null): User
    {
        $user = $this->validateCredentials($email, $password);

        DB::transaction(function () use ($user, $password, $twoFactorCode): void {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);

            if (! hash_equals($user->password, $locked->password) && ! Hash::check($password, $locked->password)) {
                throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
            }

            if ($locked->account_status !== AccountStatus::Active) {
                $status = $locked->account_status?->value ?? 'inactive';

                throw new AuthorizationException("Your account is {$status}. Please contact an administrator.");
            }

            if ($locked->hasTwoFactorAuthentication()) {
                $this->verifyTwoFactorChallenge($locked, $twoFactorCode);
            }
        });

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
