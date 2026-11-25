<?php

namespace Tests\Feature\Notifications;

use App\Actions\Auth\RegisterUserAction;
use App\Enums\AccountStatus;
use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Models\Appointment;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\UserProfile;
use App\Notifications\AppointmentNotification;
use App\Notifications\TaskNotification;
use App\Notifications\WelcomeNotification;
use App\Services\Notification\NotificationService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class EmailDeliveryTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $this->user = User::factory()->create([
            'name' => 'Fatima Hirgal',
            'email' => 'fatima@hirgal.local',
            'account_status' => AccountStatus::Active,
        ]);
        UserProfile::create(['user_id' => $this->user->id]);
    }

    public function test_resend_mailer_is_configured_in_mail_config(): void
    {
        $this->assertSame('resend', config('mail.mailers.resend.transport'));
        $this->assertArrayHasKey('resend', config('services'));
    }

    public function test_welcome_notification_implements_should_queue_and_generates_mail(): void
    {
        $notification = new WelcomeNotification;

        $this->assertInstanceOf(ShouldQueue::class, $notification);

        $channels = $notification->via($this->user);
        $this->assertContains('mail', $channels);
        $this->assertContains('database', $channels);

        $mail = $notification->toMail($this->user);
        $this->assertSame('Welcome to Hirgal', $mail->subject);
        $this->assertStringContainsString('Welcome to Hirgal, Fatima Hirgal!', $mail->greeting);
        $this->assertSame('Access Your Workspace', $mail->actionText);
    }

    public function test_welcome_notification_respects_email_preferences(): void
    {
        $this->user->profile->update([
            'notification_preferences' => [
                'email_notifications' => false,
                'in_app_notifications' => true,
            ],
        ]);
        $this->user->refresh();

        $notification = new WelcomeNotification;
        $channels = $notification->via($this->user);

        $this->assertNotContains('mail', $channels);
        $this->assertContains('database', $channels);
    }

    public function test_task_notification_includes_mail_when_email_notifications_enabled(): void
    {
        $this->user->profile->update([
            'notification_preferences' => [
                'email_notifications' => true,
                'in_app_notifications' => true,
            ],
        ]);
        $this->user->refresh();

        $project = Project::factory()->create(['owner_id' => $this->user->id]);
        $task = Task::factory()->create([
            'project_id' => $project->id,
            'creator_id' => $this->user->id,
            'title' => 'Design Notifications Architecture',
            'priority' => TaskPriority::High,
            'status' => TaskStatus::Todo,
        ]);

        $notification = new TaskNotification($task, 'task_assigned', $this->user);
        $channels = $notification->via($this->user);

        $this->assertContains('mail', $channels);
        $this->assertContains('database', $channels);

        $mail = $notification->toMail($this->user);
        $this->assertSame('Task Assigned: Design Notifications Architecture', $mail->subject);
        $this->assertSame('View Task', $mail->actionText);
    }

    public function test_task_notification_omits_mail_when_email_notifications_disabled(): void
    {
        $this->user->profile->update([
            'notification_preferences' => [
                'email_notifications' => false,
                'in_app_notifications' => true,
            ],
        ]);
        $this->user->refresh();

        $project = Project::factory()->create(['owner_id' => $this->user->id]);
        $task = Task::factory()->create([
            'project_id' => $project->id,
            'creator_id' => $this->user->id,
            'title' => 'Backend Sprint Planning',
        ]);

        $notification = new TaskNotification($task, 'task_assigned', $this->user);
        $channels = $notification->via($this->user);

        $this->assertNotContains('mail', $channels);
        $this->assertContains('database', $channels);
    }

    public function test_appointment_notification_implements_should_queue_and_generates_mail(): void
    {
        $appointment = Appointment::factory()->create([
            'organizer_id' => $this->user->id,
            'title' => 'Quarterly Product Strategy',
            'start_time' => now()->addDays(2),
            'end_time' => now()->addDays(2)->addHour(),
            'timezone' => 'UTC',
        ]);

        $notification = new AppointmentNotification($appointment, 'invitation');

        $this->assertInstanceOf(ShouldQueue::class, $notification);

        $mail = $notification->toMail($this->user);
        $this->assertSame('Appointment invitation: Quarterly Product Strategy', $mail->subject);
    }

    public function test_registration_dispatches_welcome_notification(): void
    {
        Notification::fake();
        Config::set('auth.allow_registration', true);

        $action = app(RegisterUserAction::class);
        $result = $action->execute([
            'name' => 'Amina Mohamed',
            'email' => 'amina@hirgal.local',
            'password' => 'SecurePassword123!',
        ]);

        Notification::assertSentTo($result['user'], WelcomeNotification::class);
    }

    public function test_notification_service_notify_welcome_dispatches_notification(): void
    {
        Notification::fake();

        app(NotificationService::class)->notifyWelcome($this->user);

        Notification::assertSentTo($this->user, WelcomeNotification::class);
    }
}
