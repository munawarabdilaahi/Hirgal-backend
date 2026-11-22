<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Notifications\Notification;

class TaskCommentNotification extends Notification
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        private readonly Task $task,
        private readonly string $event,
        private readonly ?User $actor = null,
        private readonly array $metadata = []
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        $preferences = $notifiable instanceof User ? ($notifiable->profile?->notification_preferences ?? []) : [];

        return ($preferences['in_app_notifications'] ?? $preferences['in_app'] ?? true) ? ['database'] : [];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $title = match ($this->event) {
            'user_mentioned' => 'You were mentioned',
            'comment_reply' => 'Reply to your comment',
            'task_comment_created' => 'New comment on task',
            default => 'Task comment notification',
        };

        $actorName = $this->actor?->name ?? 'A team member';

        $message = match ($this->event) {
            'user_mentioned' => "{$actorName} mentioned you in \"{$this->task->title}\"",
            'comment_reply' => "{$actorName} replied to your comment on \"{$this->task->title}\"",
            'task_comment_created' => "{$actorName} commented on \"{$this->task->title}\"",
            default => "{$actorName} left a comment on \"{$this->task->title}\"",
        };

        return [
            'event' => $this->event,
            'title' => $this->metadata['title'] ?? $title,
            'message' => $this->metadata['message'] ?? $message,
            'task_uuid' => $this->task->uuid,
            'project_uuid' => $this->task->project?->uuid,
            'comment_id' => $this->metadata['comment_id'] ?? null,
            'actor_id' => $this->actor?->id,
            'actor_name' => $this->actor?->name,
            'resource_type' => 'task',
            'resource_id' => $this->task->uuid,
            'action_url' => "/tasks?task={$this->task->uuid}",
        ];
    }
}
