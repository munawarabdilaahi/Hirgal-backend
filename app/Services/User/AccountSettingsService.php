<?php

namespace App\Services\User;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use App\Notifications\EmailChangeVerificationNotification;
use App\Services\Audit\ActivityLogger;
use App\Services\Security\TwoFactorAuthenticationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AccountSettingsService
{
    private const EMAIL_CODE_TTL_MINUTES = 15;

    public function __construct(
        protected TwoFactorAuthenticationService $twoFactor,
        protected ActivityLogger $audit,
    ) {}

    public function requestEmailChange(User $user, string $email): void
    {
        if (strcasecmp($email, $user->email) === 0) {
            throw ValidationException::withMessages([
                'email' => ['Choose an email address that differs from your current one.'],
            ]);
        }

        $code = (string) random_int(100000, 999999);

        DB::transaction(function () use ($user, $email, $code): void {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            $locked->forceFill([
                'pending_email' => $email,
                'pending_email_hash' => $this->hashEmailCode($user->id, $email, $code),
                'pending_email_expires_at' => now()->addMinutes(self::EMAIL_CODE_TTL_MINUTES),
            ])->save();
        });

        Notification::route('mail', $email)->notify(
            new EmailChangeVerificationNotification($code, $email, self::EMAIL_CODE_TTL_MINUTES)
        );

        $this->audit->record(
            'account.email_change_requested',
            $user,
            $user,
            'Requested an email address change.',
            ['pending_email' => $email]
        );
    }

    public function confirmEmailChange(User $user, string $code): User
    {
        $user->refresh();
        $pending = $user->pending_email;
        $hash = $user->pending_email_hash;

        if (
            $pending === null
            || $hash === null
            || $user->pending_email_expires_at === null
            || $user->pending_email_expires_at->isPast()
        ) {
            throw ValidationException::withMessages([
                'code' => ['This verification request has expired. Request a new code.'],
            ]);
        }

        if (! hash_equals($hash, $this->hashEmailCode($user->id, $pending, $code))) {
            throw ValidationException::withMessages([
                'code' => ['The verification code is incorrect.'],
            ]);
        }

        $previousEmail = $user->email;

        DB::transaction(function () use ($user, $pending): void {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);

            $taken = User::query()
                ->where('email', $pending)
                ->whereKeyNot($locked->id)
                ->exists();

            if ($taken) {
                throw ValidationException::withMessages([
                    'email' => ['That email address is no longer available.'],
                ]);
            }

            $locked->forceFill([
                'email' => $pending,
                'email_verified_at' => now(),
                'pending_email' => null,
                'pending_email_hash' => null,
                'pending_email_expires_at' => null,
            ])->save();
        });

        $this->audit->record(
            'account.email_changed',
            $user,
            $user,
            'Verified a new email address.',
            ['previous_email' => $previousEmail, 'email' => $pending]
        );

        return $user->fresh(['profile', 'roles.permissions']);
    }

    /**
     * @return array{secret: string, provisioning_uri: string}
     */
    public function startTwoFactorSetup(User $user): array
    {
        if ($user->hasTwoFactorAuthentication()) {
            throw ValidationException::withMessages([
                'two_factor' => ['Two-factor authentication is already enabled.'],
            ]);
        }

        $secret = $this->twoFactor->generateSecret();

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_last_used_step' => null,
        ])->save();

        return [
            'secret' => $secret,
            'provisioning_uri' => $this->twoFactor->provisioningUri($user, $secret),
        ];
    }

    /**
     * @return list<string>
     */
    public function confirmTwoFactor(User $user, string $code): array
    {
        $secret = (string) $user->two_factor_secret;

        if ($secret === '' || $user->two_factor_confirmed_at !== null) {
            throw ValidationException::withMessages([
                'code' => ['Start two-factor setup again before confirming.'],
            ]);
        }

        if (! $this->twoFactor->confirmCode($user, $secret, $code)) {
            throw ValidationException::withMessages([
                'code' => ['The authentication code is invalid or has expired.'],
            ]);
        }

        $recoveryCodes = $this->twoFactor->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => $this->twoFactor->hashRecoveryCodes($recoveryCodes),
        ])->save();

        $this->audit->record('account.two_factor_enabled', $user, $user, 'Enabled two-factor authentication.');

        return $recoveryCodes;
    }

    public function disableTwoFactor(User $user, string $code): void
    {
        if (! $user->hasTwoFactorAuthentication()) {
            return;
        }

        if (! $this->verifyCurrentCode($user, $code)) {
            throw ValidationException::withMessages([
                'code' => ['The authentication code is invalid or has expired.'],
            ]);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_last_used_step' => null,
        ])->save();

        $this->audit->record('account.two_factor_disabled', $user, $user, 'Disabled two-factor authentication.');
    }

    /**
     * @return list<string>
     */
    public function regenerateRecoveryCodes(User $user, string $code): array
    {
        if (! $user->hasTwoFactorAuthentication()) {
            throw ValidationException::withMessages([
                'code' => ['Enable two-factor authentication first.'],
            ]);
        }

        if (! $this->verifyCurrentCode($user, $code)) {
            throw ValidationException::withMessages([
                'code' => ['The authentication code is invalid or has expired.'],
            ]);
        }

        $recoveryCodes = $this->twoFactor->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_recovery_codes' => $this->twoFactor->hashRecoveryCodes($recoveryCodes),
        ])->save();

        $this->audit->record('account.recovery_codes_regenerated', $user, $user, 'Regenerated two-factor recovery codes.');

        return $recoveryCodes;
    }

    public function deactivate(User $user): void
    {
        $this->assertNotLastSystemAdmin($user);

        DB::transaction(function () use ($user): void {
            $user->forceFill(['account_status' => AccountStatus::Suspended])->save();
            $this->revokeAuthentication($user);
        });

        $this->audit->record('account.deactivated', $user, $user, 'Deactivated their own account.');
    }

    public function delete(User $user): void
    {
        $this->assertNotLastSystemAdmin($user);

        if ($user->ownedProjects()->exists() || $user->ledTeams()->exists()) {
            throw ValidationException::withMessages([
                'account' => ['Transfer ownership of your projects and teams before deleting your account.'],
            ]);
        }

        DB::transaction(function () use ($user): void {
            $this->revokeAuthentication($user);
            $avatar = $user->avatar_url;
            $user->delete();

            if (is_string($avatar) && str_starts_with($avatar, 'account-avatars/'.$user->id.'/')) {
                Storage::disk('local')->delete($avatar);
            }
        });

        $this->audit->record('account.deleted', $user, $user, 'Deleted their own account.');
    }

    /**
     * @param  array<string, mixed>  $identity
     * @return array<string, mixed>
     */
    public function export(User $user): array
    {
        $user->loadMissing('profile', 'roles');

        $this->audit->record('account.data_exported', $user, $user, 'Downloaded personal account data.');

        return [
            'exported_at' => now()->toIso8601String(),
            'identity' => $user->only(['name', 'email', 'timezone', 'email_verified_at', 'created_at', 'last_login_at']),
            'profile' => $user->profile?->only([
                'phone',
                'job_title',
                'department',
                'bio',
                'theme_preference',
                'locale',
                'date_format',
                'time_format',
                'notification_preferences',
            ]),
            'roles' => $user->roles->pluck('name')->values()->all(),
            'security' => [
                'two_factor_enabled' => $user->hasTwoFactorAuthentication(),
                'recovery_codes_remaining' => count($user->two_factor_recovery_codes ?? []),
            ],
        ];
    }

    public function verifyPassword(User $user, string $password): void
    {
        if (! Hash::check($password, $user->getAuthPassword())) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }
    }

    private function verifyCurrentCode(User $user, string $code): bool
    {
        $secret = (string) $user->two_factor_secret;

        if ($secret !== '' && $this->twoFactor->confirmCode($user, $secret, $code)) {
            return true;
        }

        $recoveryCodes = $user->two_factor_recovery_codes ?? [];
        $remaining = $this->twoFactor->consumeRecoveryCode($recoveryCodes, $code);

        if ($remaining === null) {
            return false;
        }

        $user->forceFill(['two_factor_recovery_codes' => $remaining])->save();

        return true;
    }

    private function hashEmailCode(int $userId, string $email, string $code): string
    {
        return hash_hmac('sha256', $userId.'|'.strtolower($email).'|'.trim($code), (string) config('app.key'));
    }

    private function assertNotLastSystemAdmin(User $user): void
    {
        if (! $user->hasRole(UserRole::SystemAdmin->value)) {
            return;
        }

        $otherAdmins = User::query()
            ->whereKeyNot($user->id)
            ->where('account_status', AccountStatus::Active)
            ->whereHas('roles', fn ($query) => $query->where('slug', UserRole::SystemAdmin->value))
            ->exists();

        if (! $otherAdmins) {
            throw ValidationException::withMessages([
                'account' => ['Add another active System Administrator before changing this account.'],
            ]);
        }
    }

    private function revokeAuthentication(User $user): void
    {
        $user->tokens()->delete();

        if (config('session.driver') === 'database') {
            DB::connection(config('session.connection'))
                ->table(config('session.table'))
                ->where('user_id', $user->id)
                ->delete();
        }

        $user->forceFill(['remember_token' => Str::random(60)])->saveQuietly();
    }
}
