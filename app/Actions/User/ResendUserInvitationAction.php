<?php

namespace App\Actions\User;

use App\Enums\InvitationStatus;
use App\Models\UserInvitation;
use App\Notifications\UserInvitationNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ResendUserInvitationAction
{
    /**
     * Refresh invitation expiration, regenerate token, and re-dispatch notification.
     *
     * @return array{invitation: UserInvitation, raw_token: string}
     *
     * @throws ValidationException
     */
    public function execute(UserInvitation $invitation): array
    {
        if ($invitation->status === InvitationStatus::Accepted) {
            throw ValidationException::withMessages([
                'invitation' => ['Cannot resend an invitation that has already been accepted.'],
            ]);
        }

        $rawToken = Str::random(64);
        $tokenHash = hash('sha256', $rawToken);

        $invitation->update([
            'token_hash' => $tokenHash,
            'status' => InvitationStatus::Pending,
            'expires_at' => now()->addDays(7),
        ]);

        Notification::route('mail', $invitation->email)
            ->notify(new UserInvitationNotification($invitation->load(['role', 'inviter']), $rawToken));

        return [
            'invitation' => $invitation->load(['role', 'inviter']),
            'raw_token' => $rawToken,
        ];
    }
}
