<?php

namespace App\Services\Auth;

use App\Actions\Auth\AcceptInvitationAction;
use App\Enums\InvitationStatus;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Validation\ValidationException;

class InvitationService
{
    public function __construct(
        protected AcceptInvitationAction $acceptInvitationAction,
    ) {}

    /**
     * Look up invitation by raw token string without exposing secrets.
     *
     * @param  string  $rawToken
     * @return UserInvitation
     *
     * @throws ValidationException
     */
    public function getInvitationByToken(string $rawToken): UserInvitation
    {
        $tokenHash = hash('sha256', $rawToken);

        $invitation = UserInvitation::with(['role', 'inviter'])
            ->where('token_hash', $tokenHash)
            ->first();

        if (! $invitation) {
            throw ValidationException::withMessages([
                'token' => ['Invalid invitation token.'],
            ]);
        }

        if ($invitation->status !== InvitationStatus::Pending) {
            throw ValidationException::withMessages([
                'token' => ["This invitation has already been {$invitation->status->value}."],
            ]);
        }

        if ($invitation->expires_at->isPast()) {
            $invitation->update(['status' => InvitationStatus::Expired]);

            throw ValidationException::withMessages([
                'token' => ['This invitation has expired. Please request a new invitation.'],
            ]);
        }

        return $invitation;
    }

    /**
     * @param  string  $rawToken
     * @param  array<string, mixed>  $data
     * @return array{user: User, token: string}
     */
    public function acceptInvitation(string $rawToken, array $data): array
    {
        return $this->acceptInvitationAction->execute($rawToken, $data);
    }
}
