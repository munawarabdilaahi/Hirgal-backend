<?php

namespace App\Services\Security;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TwoFactorChallengeService
{
    public const TTL_SECONDS = 300; // 5 minutes

    public const MAX_ATTEMPTS = 5;

    public function __construct(
        protected TwoFactorAuthenticationService $twoFactor,
    ) {}

    /**
     * Create a pending two-factor challenge for a user.
     *
     * @return array{challenge_token: string, expires_at: Carbon}
     */
    public function createChallenge(User $user, ?string $deviceName = null, bool $remember = false): array
    {
        $nonce = Str::random(32);
        $expiresAt = now()->addSeconds(self::TTL_SECONDS);

        $payload = [
            'user_id' => $user->id,
            'nonce' => $nonce,
            'device_name' => $deviceName,
            'remember' => $remember,
            'expires_at' => $expiresAt->timestamp,
            'created_at' => now()->timestamp,
        ];

        $challengeToken = Crypt::encryptString(json_encode($payload, JSON_THROW_ON_ERROR));

        Cache::put("2fa_challenge:{$nonce}", [
            'user_id' => $user->id,
            'attempts' => 0,
            'expires_at' => $expiresAt->timestamp,
        ], $expiresAt);

        return [
            'challenge_token' => $challengeToken,
            'expires_at' => $expiresAt,
        ];
    }

    /**
     * Parse and inspect the challenge without consuming it.
     *
     * @return array{user_id: int, nonce: string, device_name: ?string, remember: bool, expires_at: int}|null
     */
    public function getChallenge(string $challengeToken): ?array
    {
        try {
            $json = Crypt::decryptString($challengeToken);
            $payload = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return null;
        }

        if (! is_array($payload) || ! isset($payload['user_id'], $payload['nonce'], $payload['expires_at'])) {
            return null;
        }

        if (now()->timestamp > $payload['expires_at']) {
            return null;
        }

        if (Cache::has("2fa_challenge_consumed:{$payload['nonce']}")) {
            return null;
        }

        return $payload;
    }

    /**
     * Verify the code against the challenge and complete authentication.
     *
     * @return array{user: User, token: string}
     *
     * @throws ValidationException
     */
    public function verifyChallenge(
        string $challengeToken,
        string $code,
        bool $isRecovery = false,
        ?string $deviceName = null
    ): array {
        $payload = $this->getChallenge($challengeToken);

        if (! $payload) {
            throw ValidationException::withMessages([
                'challenge' => ['The two-factor authentication challenge has expired or is invalid. Please sign in again.'],
            ]);
        }

        $nonce = $payload['nonce'];
        $attemptsKey = "2fa_challenge_attempts:{$nonce}";
        $attempts = (int) Cache::get($attemptsKey, 0);

        if ($attempts >= self::MAX_ATTEMPTS) {
            $this->invalidateChallenge($challengeToken);

            throw ValidationException::withMessages([
                'challenge' => ['Too many failed verification attempts. Please sign in again.'],
            ]);
        }

        return DB::transaction(function () use ($payload, $challengeToken, $code, $isRecovery, $deviceName, $attemptsKey, &$attempts): array {
            $nonce = $payload['nonce'];
            $locked = User::query()->lockForUpdate()->find($payload['user_id']);

            if (! $locked || ! $locked->isActive() || ! $locked->hasTwoFactorAuthentication()) {
                $this->invalidateChallenge($challengeToken);

                throw ValidationException::withMessages([
                    'challenge' => ['Unable to complete two-factor authentication. Please sign in again.'],
                ]);
            }

            $trimmedCode = trim($code);
            $verified = false;

            $secret = (string) $locked->two_factor_secret;
            if (! $isRecovery && $secret !== '' && $this->twoFactor->confirmCode($locked, $secret, $trimmedCode)) {
                $verified = true;
            }

            if (! $verified) {
                $recoveryCodes = $locked->two_factor_recovery_codes ?? [];
                $remaining = $this->twoFactor->consumeRecoveryCode($recoveryCodes, $trimmedCode);

                if ($remaining !== null) {
                    $locked->forceFill(['two_factor_recovery_codes' => $remaining])->save();
                    $verified = true;
                }
            }

            if (! $verified) {
                $attempts++;
                Cache::put($attemptsKey, $attempts, now()->addSeconds(self::TTL_SECONDS));

                if ($attempts >= self::MAX_ATTEMPTS) {
                    $this->invalidateChallenge($challengeToken);

                    throw ValidationException::withMessages([
                        'challenge' => ['Too many failed verification attempts. Please sign in again.'],
                    ]);
                }

                $errorKey = $isRecovery ? 'recovery_code' : 'code';

                throw ValidationException::withMessages([
                    $errorKey => ['The authentication code is invalid or has expired.'],
                ]);
            }

            // Immediately mark challenge consumed to prevent reuse
            $this->invalidateChallenge($challengeToken);

            $device = $deviceName ?: ($payload['device_name'] ?: 'auth-token');
            $token = $locked->createToken($device)->plainTextToken;

            $locked->forceFill([
                'last_login_at' => now(),
            ])->saveQuietly();

            return [
                'user' => $locked,
                'token' => $token,
            ];
        });
    }

    /**
     * Invalidate/revoke a challenge token.
     */
    public function invalidateChallenge(string $challengeToken): void
    {
        try {
            $json = Crypt::decryptString($challengeToken);
            $payload = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

            if (isset($payload['nonce'])) {
                Cache::put("2fa_challenge_consumed:{$payload['nonce']}", true, now()->addSeconds(self::TTL_SECONDS));
                Cache::forget("2fa_challenge:{$payload['nonce']}");
            }
        } catch (\Throwable) {
            // Ignore malformed token invalidations
        }
    }
}
