<?php

namespace App\Actions\User;

use App\Enums\InvitationStatus;
use App\Models\UserInvitation;
use Illuminate\Validation\ValidationException;

class RevokeUserInvitationAction
{
    /**
     * Revoke an outstanding invitation.
     *
     *
     * @throws ValidationException
     */
    public function execute(UserInvitation $invitation): UserInvitation
    {
        if ($invitation->status === InvitationStatus::Accepted) {
            throw ValidationException::withMessages([
                'invitation' => ['Cannot revoke an invitation that has already been accepted.'],
            ]);
        }

        $invitation->update([
            'status' => InvitationStatus::Revoked,
        ]);

        return $invitation->fresh(['role', 'inviter']);
    }
}
