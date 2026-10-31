<?php

namespace App\Notifications;

use App\Models\UserInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class UserInvitationNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly UserInvitation $invitation,
        public readonly string $rawToken
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $acceptUrl = url('/api/v1/invitations/'.$this->rawToken.'/accept');

        return (new MailMessage)
            ->subject('You Have Been Invited to Hirgal Platform')
            ->line("You have been invited by {$this->invitation->inviter?->name} to join Hirgal as a {$this->invitation->role?->name}.")
            ->action('Accept Invitation', $acceptUrl)
            ->line('This invitation link will expire on '.$this->invitation->expires_at->toFormattedDateString().'.')
            ->line('If you did not expect this invitation, you can safely ignore this email.');
    }
}
