<?php

namespace App\Notifications;

use App\Models\Task;
use Illuminate\Notifications\Notification;

class TaskReminder extends Notification
{
    public function __construct(private readonly Task $task) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array{event: string, title: string, task_uuid: string} */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => 'task_reminder',
            'title' => $this->task->title,
            'task_uuid' => $this->task->uuid,
        ];
    }
}
