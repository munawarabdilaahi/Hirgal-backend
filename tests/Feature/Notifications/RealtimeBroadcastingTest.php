<?php

namespace Tests\Feature\Notifications;

use App\Enums\AccountStatus;
use App\Events\RealtimeNotificationBroadcast;
use App\Models\Appointment;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\UserProfile;
use App\Services\Notification\NotificationService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class RealtimeBroadcastingTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected User $other;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $this->user = User::factory()->create([
            'name' => 'Owner User',
            'email' => 'owner@hirgal.local',
            'account_status' => AccountStatus::Active,
        ]);
        UserProfile::create(['user_id' => $this->user->id]);

        $this->other = User::factory()->create([
            'name' => 'Other User',
            'email' => 'other@hirgal.local',
            'account_status' => AccountStatus::Active,
        ]);
        UserProfile::create(['user_id' => $this->other->id]);
    }

    private function configureReverbBroadcaster(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => 'test-app-id',
            'broadcasting.connections.reverb.options.host' => 'localhost',
            'broadcasting.connections.reverb.options.port' => 8080,
            'broadcasting.connections.reverb.options.scheme' => 'http',
        ]);

        require base_path('routes/channels.php');
    }

    public function test_user_can_authorize_their_own_private_notification_channel(): void
    {
        $this->configureReverbBroadcaster();

        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/broadcasting/auth', [
                'channel_name' => 'private-App.Models.User.'.$this->user->id,
                'socket_id' => '1234.5678',
            ]);

        $response->assertOk()
            ->assertJsonStructure(['auth']);
    }

    public function test_user_can_authorize_their_own_users_private_channel(): void
    {
        $this->configureReverbBroadcaster();

        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/broadcasting/auth', [
                'channel_name' => 'private-users.'.$this->user->id,
                'socket_id' => '1234.5678',
            ]);

        $response->assertOk()
            ->assertJsonStructure(['auth']);
    }

    public function test_user_cannot_authorize_another_users_private_channel(): void
    {
        $this->configureReverbBroadcaster();

        $response = $this->actingAs($this->other, 'sanctum')
            ->postJson('/api/broadcasting/auth', [
                'channel_name' => 'private-App.Models.User.'.$this->user->id,
                'socket_id' => '1234.5678',
            ]);

        $response->assertForbidden();
    }

    public function test_unauthenticated_request_cannot_authorize_channels(): void
    {
        $this->configureReverbBroadcaster();

        $response = $this->postJson('/api/broadcasting/auth', [
            'channel_name' => 'private-App.Models.User.'.$this->user->id,
            'socket_id' => '1234.5678',
        ]);

        $response->assertUnauthorized();
    }

    public function test_realtime_notification_broadcast_event_structure(): void
    {
        $payload = [
            'event' => 'task_assigned',
            'title' => 'Task assigned to you',
            'task_uuid' => 'dummy-uuid',
        ];

        $event = new RealtimeNotificationBroadcast($this->user, $payload);

        $channels = $event->broadcastOn();
        $this->assertCount(2, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertSame('private-users.'.$this->user->id, $channels[0]->name);
        $this->assertSame('private-App.Models.User.'.$this->user->id, $channels[1]->name);

        $this->assertSame('notification.created', $event->broadcastAs());
        $this->assertSame($payload, $event->broadcastWith());
    }

    public function test_notification_service_dispatches_realtime_broadcast_on_task_notification(): void
    {
        Event::fake([RealtimeNotificationBroadcast::class]);

        $project = Project::factory()->create(['owner_id' => $this->user->id]);
        $task = Task::factory()->create([
            'project_id' => $project->id,
            'creator_id' => $this->user->id,
            'title' => 'Implement WebSockets Integration',
        ]);

        app(NotificationService::class)->notifyTask(
            task: $task,
            event: 'task_assigned',
            actor: $this->user,
            recipients: [$this->other]
        );

        Event::assertDispatched(RealtimeNotificationBroadcast::class, function (RealtimeNotificationBroadcast $event) {
            return $event->recipient->id === $this->other->id &&
                $event->payload['event'] === 'task_assigned' &&
                $event->payload['task_title'] === 'Implement WebSockets Integration';
        });
    }

    public function test_notification_service_dispatches_realtime_broadcast_on_welcome(): void
    {
        Event::fake([RealtimeNotificationBroadcast::class]);

        app(NotificationService::class)->notifyWelcome($this->user);

        Event::assertDispatched(RealtimeNotificationBroadcast::class, function (RealtimeNotificationBroadcast $event) {
            return $event->recipient->id === $this->user->id &&
                $event->payload['event'] === 'welcome';
        });
    }

    public function test_notification_service_dispatches_realtime_broadcast_on_appointment(): void
    {
        Event::fake([RealtimeNotificationBroadcast::class]);

        $appointment = Appointment::factory()->create([
            'organizer_id' => $this->user->id,
            'title' => 'Sprint Kickoff',
            'start_time' => now()->addDay(),
            'end_time' => now()->addDay()->addHour(),
            'timezone' => 'UTC',
        ]);

        app(NotificationService::class)->notifyAppointment(
            appointment: $appointment,
            event: 'invitation',
            recipients: [$this->other]
        );

        Event::assertDispatched(RealtimeNotificationBroadcast::class, function (RealtimeNotificationBroadcast $event) {
            return $event->recipient->id === $this->other->id &&
                $event->payload['event'] === 'invitation' &&
                $event->payload['title'] === 'Sprint Kickoff';
        });
    }
}
