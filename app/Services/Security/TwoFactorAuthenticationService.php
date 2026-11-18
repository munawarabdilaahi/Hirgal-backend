<?php

namespace App\Services\Security;

use App\Models\User;

class TwoFactorAuthenticationService
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    private const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    private const PERIOD = 30;

    private const DIGITS = 6;

    private const WINDOW = 1;

    /**
     * Generate a new base32 encoded TOTP secret.
     */
    public function generateSecret(): string
    {
        return $this->base32Encode(random_bytes(20));
    }

    /**
     * Build the otpauth:// provisioning URI consumed by authenticator apps.
     */
    public function provisioningUri(User $user, string $secret): string
    {
        $issuer = (string) config('app.name', 'Hirgal');
        $label = $issuer.':'.$user->email;

        return 'otpauth://totp/'.rawurlencode($label).'?'.http_build_query([
            'secret' => $secret,
            'issuer' => $issuer,
            'algorithm' => 'SHA1',
            'digits' => self::DIGITS,
            'period' => self::PERIOD,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * Generate the TOTP code for the current time step.
     */
    public function currentCode(string $secret): string
    {
        return $this->codeForStep($secret, intdiv(now()->getTimestamp(), self::PERIOD));
    }

    /**
     * Verify a six-digit TOTP code and return the matched time step.
     */
    public function verifyCode(string $secret, string $code): ?int
    {
        $code = preg_replace('/\s+/', '', $code) ?? '';

        if (! preg_match('/^\d{6}$/', $code)) {
            return null;
        }

        $currentStep = intdiv(now()->getTimestamp(), self::PERIOD);

        for ($offset = -self::WINDOW; $offset <= self::WINDOW; $offset++) {
            $step = $currentStep + $offset;
            $expected = $this->codeForStep($secret, $step);

            if (hash_equals($expected, $code)) {
                return $step;
            }
        }

        return null;
    }

    /**
     * Generate plaintext recovery codes. Only hashes are persisted by the caller.
     *
     * @return list<string>
     */
    public function generateRecoveryCodes(int $count = 8): array
    {
        $codes = [];

        for ($index = 0; $index < $count; $index++) {
            $codes[] = $this->randomRecoveryCode();
        }

        return $codes;
    }

    /**
     * Hash recovery codes so the persisted copy is never usable directly.
     *
     * @param  list<string>  $codes
     * @return list<string>
     */
    public function hashRecoveryCodes(array $codes): array
    {
        return array_map(fn (string $code): string => $this->hashRecoveryCode($code), $codes);
    }

    /**
     * Consume a recovery code, removing it from the stored list on success.
     *
     * @param  list<string>  $hashes
     * @return list<string>|null Remaining hashes, or null when the code is invalid.
     */
    public function consumeRecoveryCode(array $hashes, string $code): ?array
    {
        $candidate = $this->hashRecoveryCode($code);

        foreach ($hashes as $index => $hash) {
            if (hash_equals($hash, $candidate)) {
                unset($hashes[$index]);

                return array_values($hashes);
            }
        }

        return null;
    }

    public function hashRecoveryCode(string $code): string
    {
        return hash('sha256', $this->normalizeRecoveryCode($code));
    }

    /**
     * Verify a TOTP code and update the replay guard on the user.
     */
    public function confirmCode(User $user, string $secret, string $code): bool
    {
        $step = $this->verifyCode($secret, $code);

        if ($step === null || ($user->two_factor_last_used_step !== null && $step <= $user->two_factor_last_used_step)) {
            return false;
        }

        $user->forceFill(['two_factor_last_used_step' => $step])->save();

        return true;
    }

    private function codeForStep(string $secret, int $step): string
    {
        $key = $this->base32Decode($secret);
        $binaryStep = pack('N*', 0, $step);
        $hash = hash_hmac('sha1', $binaryStep, $key, true);
        $offset = ord($hash[19]) & 0x0F;
        $value = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        ) % (10 ** self::DIGITS);

        return str_pad((string) $value, self::DIGITS, '0', STR_PAD_LEFT);
    }

    private function randomRecoveryCode(): string
    {
        $raw = '';

        for ($index = 0; $index < 8; $index++) {
            $raw .= self::RECOVERY_ALPHABET[random_int(0, strlen(self::RECOVERY_ALPHABET) - 1)];
        }

        return substr($raw, 0, 4).'-'.substr($raw, 4, 4);
    }

    private function normalizeRecoveryCode(string $code): string
    {
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code) ?? '');
    }

    private function base32Encode(string $binary): string
    {
        $bits = '';

        foreach (str_split($binary) as $character) {
            $bits .= str_pad(decbin(ord($character)), 8, '0', STR_PAD_LEFT);
        }

        $output = '';

        foreach (str_split($bits, 5) as $chunk) {
            if (strlen($chunk) < 5) {
                $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            }

            $output .= self::ALPHABET[bindec($chunk)];
        }

        return $output;
    }

    private function base32Decode(string $encoded): string
    {
        $encoded = strtoupper(preg_replace('/[^A-Z2-7]/', '', $encoded) ?? '');
        $bits = '';

        foreach (str_split($encoded) as $character) {
            $position = strpos(self::ALPHABET, $character);

            if ($position === false) {
                continue;
            }

            $bits .= str_pad(decbin($position), 5, '0', STR_PAD_LEFT);
        }

        $binary = '';

        foreach (str_split($bits, 8) as $chunk) {
            if (strlen($chunk) === 8) {
                $binary .= chr(bindec($chunk));
            }
        }

        return $binary;
    }
}
