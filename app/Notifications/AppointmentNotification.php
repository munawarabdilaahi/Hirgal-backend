<?php

namespace App\Notifications;

use App\Models\Appointment;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AppointmentNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Appointment $appointment, private readonly string $event)
    {
        $this->afterCommit();
    }

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        $preferences = $notifiable instanceof User ? ($notifiable->profile?->notification_preferences ?? []) : [];
        $channels = [];
        if ($preferences['email'] ?? true) {
            $channels[] = 'mail';
        }
        if ($preferences['in_app'] ?? true) {
            $channels[] = 'database';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Appointment '.$this->event.': '.$this->appointment->title)
            ->line($this->appointment->title)
            ->line($this->appointment->start_time->copy()->utc()->format('Y-m-d H:i').' UTC ('.$this->appointment->timezone.')')
            ->line('Organizer: '.$this->appointment->organizer->name)
            ->line('Appointment reference: '.$this->appointment->uuid);
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => $this->event,
            'appointment_uuid' => $this->appointment->uuid,
            'title' => $this->appointment->title,
            'start_time' => $this->appointment->start_time->copy()->utc()->toIso8601String(),
            'end_time' => $this->appointment->end_time->copy()->utc()->toIso8601String(),
            'timezone' => $this->appointment->timezone,
            'organizer_name' => $this->appointment->organizer->name,
            'context' => $this->appointment->project_id !== null ? 'project' : ($this->appointment->team_id !== null ? 'team' : 'personal'),
        ];
    }
}
