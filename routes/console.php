<?php

use App\Enums\AccountStatus;
use App\Models\Task;
use App\Notifications\TaskReminder;
use App\Policies\TaskPolicy;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('tasks:send-reminders', function (): void {
    Task::query()->where('reminder_due_at', '<=', now()->utc())->select('id')->chunkById(100, function ($tasks): void {
        foreach ($tasks as $candidate) {
            DB::transaction(function () use ($candidate): void {
                $task = Task::query()->where('reminder_due_at', '<=', now()->utc())->lockForUpdate()->find($candidate->id);
                if ($task === null) {
                    return;
                }

                $creator = $task->creator;
                if ($creator?->account_status === AccountStatus::Active
                    && ($creator->profile?->notification_preferences['in_app'] ?? true)
                    && TaskPolicy::isWithinScope($creator, $task)
                    && ($task->project_id === null || $creator->can('view', $task))) {
                    $creator->notify(new TaskReminder($task));
                }

                $task->timestamps = false;
                $task->update(['reminder_due_at' => null]);
            }, 3);
        }
    });
})->purpose('Send due task reminders to their creators');

Schedule::command('tasks:send-reminders')->everyMinute();
