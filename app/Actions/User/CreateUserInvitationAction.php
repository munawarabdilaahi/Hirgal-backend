<?php

namespace App\Actions\User;

use App\Enums\InvitationStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\UserInvitationNotification;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CreateUserInvitationAction
{
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

        $invitation = UserInvitation::create([
            'email' => $email,
            'role_id' => $data['role_id'],
            'token_hash' => $tokenHash,
            'status' => InvitationStatus::Pending,
            'invited_by' => $actor->id,
            'expires_at' => now()->addDays(7),
        ]);

        Notification::route('mail', $email)
            ->notify(new UserInvitationNotification($invitation->load(['role', 'inviter']), $rawToken));

        return [
            'invitation' => $invitation->load(['role', 'inviter']),
            'raw_token' => $rawToken,
        ];
    }
}
