<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EmailChangeVerificationNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $code,
        public readonly string $pendingEmail,
        public readonly int $expiresInMinutes,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirm Your New Hirgal Email Address')
            ->line("Use the code below to confirm {$this->pendingEmail} as your Hirgal email address.")
            ->line("Verification code: {$this->code}")
            ->line("This code expires in {$this->expiresInMinutes} minutes.")
            ->line('If you did not request this change, secure your account immediately.');
    }
}
