<?php

namespace App\Actions\User;

use App\Enums\InvitationStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\User\SendInvitationEmail;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CreateUserInvitationAction
{
    public function __construct(private SendInvitationEmail $sendInvitationEmail) {}

    /**
     * Create an onboarding user invitation and send notification.
     *
     * @param  array{email: string, role_id: int}  $data
     * @return array{invitation: UserInvitation, raw_token: string}
     *
     * @throws ValidationException
     */
    public function execute(User $actor, array $data): array
    {
        $email = strtolower(trim($data['email']));

        if (User::where('email', $email)->exists()) {
            throw ValidationException::withMessages([
                'email' => ['A user account with this email address already exists.'],
            ]);
        }

        $existingPending = UserInvitation::where('email', $email)
            ->where('status', InvitationStatus::Pending)
            ->where('expires_at', '>', now())
            ->first();

        if ($existingPending) {
            throw ValidationException::withMessages([
                'email' => ['A pending invitation has already been dispatched to this email address.'],
            ]);
        }

        $targetRole = Role::findOrFail($data['role_id']);

        // SEC-02: Prevent role escalation via invitation payloads
        if ($targetRole->slug === UserRole::SystemAdmin->value && ! $actor->isSystemAdmin()) {
            throw new AuthorizationException(
                'Only System Administrators are permitted to invite users with the System Administrator role.'
            );
        }

        $rawToken = Str::random(64);
        $tokenHash = hash('sha256', $rawToken);

        $invitation = DB::transaction(function () use ($actor, $data, $email, $rawToken, $tokenHash): UserInvitation {
            $invitation = UserInvitation::create([
                'email' => $email,
                'role_id' => $data['role_id'],
                'token_hash' => $tokenHash,
                'status' => InvitationStatus::Pending,
                'invited_by' => $actor->id,
                'expires_at' => now()->addDays(7),
            ])->load(['role', 'inviter']);

            $this->sendInvitationEmail->execute($invitation, $rawToken);

            return $invitation;
        });

        return [
            'invitation' => $invitation,
            'raw_token' => $rawToken,
        ];
    }
}
