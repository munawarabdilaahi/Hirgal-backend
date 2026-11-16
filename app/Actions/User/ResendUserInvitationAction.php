<?php

namespace App\Actions\User;

use App\Enums\InvitationStatus;
use App\Models\UserInvitation;
use App\Services\User\SendInvitationEmail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ResendUserInvitationAction
{
    public function __construct(private SendInvitationEmail $sendInvitationEmail) {}

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

            $invitation->load(['role', 'inviter']);
            $this->sendInvitationEmail->execute($invitation, $rawToken);

            return $invitation;
        });

        return [
            'invitation' => $invitation,
            'raw_token' => $rawToken,
        ];
    }
}
