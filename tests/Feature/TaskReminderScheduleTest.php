<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskReminder;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class TaskReminderScheduleTest extends TestCase
{
    use RefreshDatabase;

    public function test_task_reminder_command_is_scheduled_every_minute_with_server_locks(): void
    {
        $this->artisan('schedule:list')->assertSuccessful();
        $events = collect(app(Schedule::class)->events())
            ->filter(fn ($event): bool => str_contains($event->command ?? '', 'tasks:send-reminders'));

        $this->assertCount(1, $events);
        $event = $events->first();
        $this->assertSame('* * * * *', $event->expression);
        $this->assertTrue($event->withoutOverlapping);
        $this->assertTrue($event->onOneServer);
    }

    public function test_task_reminder_sends_notification_for_due_reminders_and_clears_flag(): void
    {
        Notification::fake();

        $user = User::factory()->create(['account_status' => AccountStatus::Active]);
        $dueTask = Task::factory()->create([
            'creator_id' => $user->id,
            'project_id' => null,
            'reminder_due_at' => now()->subMinute(),
        ]);
        $futureTask = Task::factory()->create([
            'creator_id' => $user->id,
            'project_id' => null,
            'reminder_due_at' => now()->addMinutes(10),
        ]);

        $this->artisan('tasks:send-reminders')->assertSuccessful();

        Notification::assertSentTo($user, TaskReminder::class, function (TaskReminder $notification) use ($dueTask): bool {
            return $notification->toArray($dueTask)['task_uuid'] === $dueTask->uuid;
        });

        $this->assertNull($dueTask->fresh()->reminder_due_at);
        $this->assertNotNull($futureTask->fresh()->reminder_due_at);
    }

    public function test_task_reminder_skips_inactive_creators(): void
    {
        Notification::fake();

        $inactiveUser = User::factory()->create(['account_status' => AccountStatus::Suspended]);
        $task = Task::factory()->create([
            'creator_id' => $inactiveUser->id,
            'project_id' => null,
            'reminder_due_at' => now()->subMinute(),
        ]);

        $this->artisan('tasks:send-reminders')->assertSuccessful();

        Notification::assertNothingSent();
        $this->assertNull($task->fresh()->reminder_due_at);
    }
}
