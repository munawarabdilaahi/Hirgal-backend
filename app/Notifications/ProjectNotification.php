<?php

namespace App\Notifications;

use App\Models\Project;
use App\Models\User;
use Illuminate\Notifications\Notification;

class ProjectNotification extends Notification
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        private readonly Project $project,
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
            'project_member_added' => 'Added to project',
            'project_member_removed' => 'Removed from project',
            'project_updated' => 'Project updated',
            default => 'Project notification',
        };

        $actorName = $this->actor?->name ?? 'A team member';

        $message = match ($this->event) {
            'project_member_added' => "{$actorName} added you to project \"{$this->project->name}\"",
            'project_member_removed' => "You were removed from project \"{$this->project->name}\"",
            'project_updated' => "Project \"{$this->project->name}\" was updated",
            default => "Update regarding project \"{$this->project->name}\"",
        };

        return [
            'event' => $this->event,
            'title' => $this->metadata['title'] ?? $title,
            'message' => $this->metadata['message'] ?? $message,
            'project_uuid' => $this->project->uuid,
            'project_name' => $this->project->name,
            'actor_id' => $this->actor?->id,
            'actor_name' => $this->actor?->name,
            'resource_type' => 'project',
            'resource_id' => $this->project->uuid,
            'action_url' => "/projects/{$this->project->uuid}",
        ];
    }
}
