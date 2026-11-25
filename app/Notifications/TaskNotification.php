<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        private readonly Task $task,
        private readonly string $event,
        private readonly ?User $actor = null,
        private readonly array $metadata = []
    ) {
        $this->afterCommit();
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        $preferences = $notifiable instanceof User ? ($notifiable->profile?->notification_preferences ?? []) : [];
        $channels = [];

        if ($preferences['in_app_notifications'] ?? $preferences['in_app'] ?? true) {
            $channels[] = 'database';
            $channels[] = 'broadcast';
        }

        $wantsEmail = $preferences['email_notifications'] ?? false;
        if ($wantsEmail && in_array($this->event, ['task_assigned', 'task_reassigned'], true)) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $actionUrl = (string) (config('app.frontend_url', config('app.url'))."/tasks?task={$this->task->uuid}");
        $actorName = $this->actor?->name ?? 'A team member';

        $subject = match ($this->event) {
            'task_assigned' => "Task Assigned: {$this->task->title}",
            'task_reassigned' => "Task Reassigned: {$this->task->title}",
            default => "Task Updated: {$this->task->title}",
        };

        return (new MailMessage)
            ->subject($subject)
            ->line("{$actorName} assigned you to \"{$this->task->title}\".")
            ->line('Project: '.($this->task->project?->name ?? 'Direct Task'))
            ->line("Priority: {$this->task->priority->value}")
            ->action('View Task', $actionUrl)
            ->line('Thank you for using Hirgal.');
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

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $title = match ($this->event) {
            'task_assigned' => 'Task assigned to you',
            'task_reassigned' => 'Task reassigned to you',
            'task_unassigned' => 'Removed from task',
            'task_followed' => 'Added as watcher',
            'task_completed' => 'Task completed',
            'task_review_requested' => 'Review requested',
            'task_due_date_changed' => 'Task deadline updated',
            'task_status_changed' => 'Task status updated',
            default => 'Task updated',
        };

        $actorName = $this->actor?->name ?? 'A team member';

        $message = match ($this->event) {
            'task_assigned' => "{$actorName} assigned you to \"{$this->task->title}\"",
            'task_reassigned' => "{$actorName} reassigned \"{$this->task->title}\" to you",
            'task_unassigned' => "You were removed from task \"{$this->task->title}\"",
            'task_followed' => "{$actorName} added you as a watcher to \"{$this->task->title}\"",
            'task_completed' => "Task \"{$this->task->title}\" was marked as completed",
            'task_review_requested' => "Task \"{$this->task->title}\" is ready for review",
            'task_due_date_changed' => "The deadline for \"{$this->task->title}\" was updated",
            'task_status_changed' => "Task \"{$this->task->title}\" status changed to {$this->task->status->value}",
            default => "Task \"{$this->task->title}\" was updated",
        };

        return [
            'event' => $this->event,
            'title' => $this->metadata['title'] ?? $title,
            'message' => $this->metadata['message'] ?? $message,
            'task_uuid' => $this->task->uuid,
            'task_title' => $this->task->title,
            'project_uuid' => $this->task->project?->uuid,
            'actor_id' => $this->actor?->id,
            'actor_name' => $this->actor?->name,
            'resource_type' => 'task',
            'resource_id' => $this->task->uuid,
            'action_url' => "/tasks?task={$this->task->uuid}",
        ];
    }
}
