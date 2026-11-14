<?php

namespace App\Actions\User;

use App\Enums\InvitationStatus;
use App\Models\UserInvitation;
use Illuminate\Support\Facades\DB;
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
        return DB::transaction(function () use ($invitation): UserInvitation {
            $invitation = UserInvitation::query()->lockForUpdate()->findOrFail($invitation->id);

            if ($invitation->status === InvitationStatus::Accepted) {
                throw ValidationException::withMessages([
                    'invitation' => ['Cannot revoke an invitation that has already been accepted.'],
                ]);
            }

            $invitation->update(['status' => InvitationStatus::Revoked]);

            return $invitation->load(['role', 'inviter']);
        });
    }
}
