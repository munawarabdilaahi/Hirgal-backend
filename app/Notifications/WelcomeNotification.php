<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WelcomeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct()
    {
        $this->afterCommit();
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $preferences = $notifiable instanceof User ? ($notifiable->profile?->notification_preferences ?? []) : [];
        $channels = [];

        if ($preferences['email_notifications'] ?? $preferences['email'] ?? true) {
            $channels[] = 'mail';
        }

        if ($preferences['in_app_notifications'] ?? $preferences['in_app'] ?? true) {
            $channels[] = 'database';
            $channels[] = 'broadcast';
        }

        return $channels;
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'id' => $this->id,
            'type' => static::class,
            'data' => $this->toArray($notifiable),
            'read_at' => null,
            'created_at' => now()->toIso8601String(),
        ]);
    }

    public function toMail(object $notifiable): MailMessage
    {
        $workspaceUrl = (string) config('app.frontend_url', config('app.url'));

        return (new MailMessage)
            ->subject('Welcome to Hirgal')
            ->greeting('Welcome to Hirgal, '.$notifiable->name.'!')
            ->line('Your account is ready. Hirgal provides a modern, collaborative platform for managing projects, tracking tasks, and staying aligned with your team.')
            ->action('Access Your Workspace', $workspaceUrl)
            ->line('If you have any questions, please contact your workspace administrator.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => 'welcome',
            'title' => 'Welcome to Hirgal',
            'message' => 'Your account has been set up successfully.',
        ];
    }
}
