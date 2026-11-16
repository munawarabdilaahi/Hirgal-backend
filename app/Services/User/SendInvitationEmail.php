<?php

namespace App\Services\User;

use App\Exceptions\InvitationDeliveryFailed;
use App\Models\UserInvitation;
use App\Notifications\UserInvitationNotification;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class SendInvitationEmail
{
    public function execute(UserInvitation $invitation, string $rawToken): void
    {
        if (! $this->deliversExternally(config('mail.default'))) {
            throw new InvitationDeliveryFailed('Invitation email was not sent. Configure a delivery mailer for Hirgal, then try again.');
        }

        try {
            Notification::route('mail', $invitation->email)
                ->notifyNow(new UserInvitationNotification($invitation, $rawToken));
        } catch (TransportExceptionInterface $exception) {
            throw new InvitationDeliveryFailed('Hirgal could not send the invitation email. Check the mail provider configuration and try again.', previous: $exception);
        }
    }

    /**
     * @param  list<string>  $visited
     */
    private function deliversExternally(?string $name, array $visited = []): bool
    {
        if ($name === null || in_array($name, $visited, true)) {
            return false;
        }

        $mailer = config("mail.mailers.{$name}", []);
        $transport = $mailer['transport'] ?? null;

        if (in_array($transport, ['failover', 'roundrobin'], true)) {
            $children = $mailer['mailers'] ?? [];

            return $children !== [] && array_all(
                $children,
                fn (string $child): bool => $this->deliversExternally($child, [...$visited, $name]),
            );
        }

        return $transport !== null && ! in_array($transport, ['log', 'array', 'null'], true);
    }
}
