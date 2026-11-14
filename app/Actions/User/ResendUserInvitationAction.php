<?php

namespace App\Actions\User;

use App\Enums\InvitationStatus;
use App\Models\UserInvitation;
use App\Notifications\UserInvitationNotification;
use Illuminate\Support\Facades\DB;
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
        $rawToken = Str::random(64);

        $invitation = DB::transaction(function () use ($invitation, $rawToken): UserInvitation {
            $invitation = UserInvitation::query()->lockForUpdate()->findOrFail($invitation->id);

            if ($invitation->status === InvitationStatus::Accepted) {
                throw ValidationException::withMessages([
                    'invitation' => ['Cannot resend an invitation that has already been accepted.'],
                ]);
            }

            $invitation->update([
                'token_hash' => hash('sha256', $rawToken),
                'status' => InvitationStatus::Pending,
                'expires_at' => now()->addDays(7),
            ]);

            return $invitation->load(['role', 'inviter']);
        });

        Notification::route('mail', $invitation->email)
            ->notify(new UserInvitationNotification($invitation, $rawToken));

        return [
            'invitation' => $invitation,
            'raw_token' => $rawToken,
        ];
    }
}
