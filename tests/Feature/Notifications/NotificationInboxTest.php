<?php

namespace Tests\Feature\Notifications;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Appointment;
use App\Models\Role;
use App\Models\User;
use App\Models\UserProfile;
use App\Notifications\AppointmentNotification;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationInboxTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected User $other;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        $memberRole = Role::where('slug', UserRole::Member->value)->first();

        $this->user = User::factory()->create(['name' => 'Inbox Owner']);
        $this->user->roles()->attach($memberRole->id);

        $this->other = User::factory()->create(['name' => 'Other User']);
        $this->other->roles()->attach($memberRole->id);

        $this->admin = User::factory()->create(['name' => 'System Admin']);
        $this->admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->first()->id);
    }

    public function test_authenticated_user_can_list_only_own_notifications(): void
    {
        $mine = [
            $this->createNotification($this->user),
            $this->createNotification($this->user),
            $this->createNotification($this->user),
        ];
        $this->createNotification($this->other);
        $this->createNotification($this->other);

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Notifications retrieved successfully.')
            ->assertJsonPath('meta.total', 3);

        $returnedIds = array_column($response->json('data'), 'id');
        foreach ($mine as $notification) {
            $this->assertContains($notification->id, $returnedIds);
        }
        $this->assertArrayNotHasKey('notifiable_id', $response->json('data.0'));
        $this->assertArrayNotHasKey('notifiable_type', $response->json('data.0'));
        $this->assertArrayNotHasKey('updated_at', $response->json('data.0'));
    }

    public function test_list_is_ordered_newest_first(): void
    {
        $oldest = $this->createNotification($this->user, ['created_at' => now()->subMinutes(3)]);
        $middle = $this->createNotification($this->user, ['created_at' => now()->subMinutes(2)]);
        $newest = $this->createNotification($this->user, ['created_at' => now()->subMinutes(1)]);

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications')
            ->assertOk();

        $this->assertSame(
            [$newest->id, $middle->id, $oldest->id],
            array_column($response->json('data'), 'id')
        );
    }

    public function test_list_supports_pagination(): void
    {
        foreach (range(1, 5) as $ignored) {
            $this->createNotification($this->user);
        }

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications?per_page=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.total', 5);
    }

    public function test_list_status_filter_selects_read_or_unread(): void
    {
        $this->createNotification($this->user);
        $this->createNotification($this->user);
        $this->createNotification($this->user, ['read_at' => now()->subHour()]);

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications?status=unread')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications?status=read')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_list_type_filter_matches_exact_type(): void
    {
        $this->createNotification($this->user);
        $this->createNotification($this->user, ['type' => 'App\Notifications\OtherNotificationType']);

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications?type='.urlencode(AppointmentNotification::class))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.type', AppointmentNotification::class);
    }

    public function test_invalid_list_filters_return_validation_error(): void
    {
        $this->createNotification($this->user);

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications?status=bogus')
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications?per_page=0')
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $id = (string) Str::uuid();

        foreach ($this->endpointMatrix($id) as [$method, $uri]) {
            $this->{$method}($uri)
                ->assertStatus(401)
                ->assertJsonPath('success', false)
                ->assertJsonPath('error_code', 'UNAUTHENTICATED');
        }
    }

    public function test_suspended_account_is_rejected(): void
    {
        $suspended = User::factory()->create(['account_status' => AccountStatus::Suspended]);
        $suspended->roles()->attach(Role::where('slug', UserRole::Member->value)->first()->id);
        $this->createNotification($suspended);
        $id = (string) Str::uuid();

        foreach ($this->endpointMatrix($id) as [$method, $uri]) {
            $this->actingAs($suspended, 'sanctum')
                ->{$method}($uri)
                ->assertStatus(403)
                ->assertJsonPath('success', false)
                ->assertJsonPath('error_code', 'ACCOUNT_NOT_ACTIVE');
        }
    }

    public function test_client_supplied_recipient_parameters_cannot_widen_scope(): void
    {
        $ownFirst = $this->createNotification($this->user);
        $ownSecond = $this->createNotification($this->user);
        $this->createNotification($this->other);
        $this->createNotification($this->other);
        $this->createNotification($this->other);

        $listed = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications?user_id='.$this->other->id.'&notifiable_id='.$this->other->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        $returnedIds = array_column($listed->json('data'), 'id');
        sort($returnedIds);
        $expectedIds = [$ownFirst->id, $ownSecond->id];
        sort($expectedIds);
        $this->assertSame($expectedIds, $returnedIds);

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications/unread-count?user_id='.$this->other->id)
            ->assertOk()
            ->assertJsonPath('data.unread_count', 2);

        $this->actingAs($this->user, 'sanctum')
            ->patchJson('/api/v1/notifications/read-all', ['user_id' => $this->other->id, 'notifiable_id' => $this->other->id])
            ->assertOk()
            ->assertJsonPath('data.updated', 2);

        $this->assertSame(
            3,
            $this->other->notifications()->whereNull('read_at')->count(),
            'Other user notifications must remain untouched by client-supplied recipient parameters.'
        );
    }

    public function test_unread_count_counts_only_callers_own_unread(): void
    {
        $this->createNotification($this->user);
        $this->createNotification($this->user);
        $this->createNotification($this->user, ['read_at' => now()->subHour()]);
        $this->createNotification($this->other);
        $this->createNotification($this->other);
        $this->createNotification($this->other);

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.unread_count', 2);
    }

    public function test_system_admin_unread_count_is_own_only(): void
    {
        $this->createNotification($this->admin);
        $this->createNotification($this->other);
        $this->createNotification($this->other);
        $this->createNotification($this->other);
        $this->createNotification($this->other);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1);
    }

    public function test_user_can_mark_own_notification_as_read(): void
    {
        $notification = $this->createNotification($this->user);

        $response = $this->actingAs($this->user, 'sanctum')
            ->patchJson('/api/v1/notifications/'.$notification->id.'/read')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Notification marked as read.')
            ->assertJsonPath('data.id', $notification->id);

        $this->assertNotNull($response->json('data.read_at'));
        $this->assertNotNull($notification->fresh()->read_at);
    }

    public function test_mark_one_read_is_idempotent(): void
    {
        $notification = $this->createNotification($this->user, ['read_at' => now()->subHour()]);
        $beforeReadAt = $notification->fresh()->read_at->toIso8601String();
        $beforeUpdatedAt = $notification->fresh()->updated_at->toIso8601String();

        $response = $this->actingAs($this->user, 'sanctum')
            ->patchJson('/api/v1/notifications/'.$notification->id.'/read')
            ->assertOk();

        $fresh = $notification->fresh();
        $this->assertSame($beforeReadAt, $response->json('data.read_at'));
        $this->assertSame($beforeReadAt, $fresh->read_at->toIso8601String());
        $this->assertSame($beforeUpdatedAt, $fresh->updated_at->toIso8601String());
    }

    public function test_cross_user_mark_one_returns_404_and_leaves_record_unchanged(): void
    {
        $victim = $this->createNotification($this->other);

        $this->actingAs($this->user, 'sanctum')
            ->patchJson('/api/v1/notifications/'.$victim->id.'/read')
            ->assertStatus(404)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');

        $this->assertDatabaseHas('notifications', [
            'id' => $victim->id,
            'read_at' => null,
        ]);
    }

    public function test_invalid_notification_id_returns_404(): void
    {
        $this->createNotification($this->user);

        $this->actingAs($this->user, 'sanctum')
            ->patchJson('/api/v1/notifications/not-a-uuid/read')
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');

        $this->actingAs($this->user, 'sanctum')
            ->patchJson('/api/v1/notifications/'.Str::uuid().'/read')
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_system_admin_cannot_mark_another_users_notification(): void
    {
        $victim = $this->createNotification($this->other);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/v1/notifications/'.$victim->id.'/read')
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');

        $this->assertDatabaseHas('notifications', [
            'id' => $victim->id,
            'read_at' => null,
        ]);
    }

    public function test_mark_all_updates_only_own_unread_notifications(): void
    {
        $first = $this->createNotification($this->user);
        $second = $this->createNotification($this->user);
        $alreadyRead = $this->createNotification($this->user, ['read_at' => now()->subHour()]);
        $readBefore = $alreadyRead->fresh()->read_at->toIso8601String();
        $otherFirst = $this->createNotification($this->other);
        $otherSecond = $this->createNotification($this->other);

        $this->actingAs($this->user, 'sanctum')
            ->patchJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.updated', 2);

        $this->assertNotNull($first->fresh()->read_at);
        $this->assertNotNull($second->fresh()->read_at);
        $this->assertSame($readBefore, $alreadyRead->fresh()->read_at->toIso8601String());
        $this->assertNull($otherFirst->fresh()->read_at);
        $this->assertNull($otherSecond->fresh()->read_at);
        $this->assertSame(0, $this->user->notifications()->whereNull('read_at')->count());
        $this->assertSame(2, $this->other->notifications()->whereNull('read_at')->count());
    }

    public function test_system_admin_mark_all_does_not_touch_other_users(): void
    {
        $this->createNotification($this->admin);
        $otherFirst = $this->createNotification($this->other);
        $otherSecond = $this->createNotification($this->other);
        $otherThird = $this->createNotification($this->other);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('data.updated', 1);

        $this->assertSame(0, $this->admin->notifications()->whereNull('read_at')->count());
        $this->assertNull($otherFirst->fresh()->read_at);
        $this->assertNull($otherSecond->fresh()->read_at);
        $this->assertNull($otherThird->fresh()->read_at);
        $this->assertSame(3, $this->other->notifications()->whereNull('read_at')->count());
    }

    public function test_mark_all_with_no_unread_returns_zero(): void
    {
        $this->createNotification($this->user, ['read_at' => now()->subHour()]);

        $this->actingAs($this->user, 'sanctum')
            ->patchJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('data.updated', 0);
    }

    public function test_payload_never_exposes_internal_or_unapproved_fields(): void
    {
        $this->createNotification($this->user);

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications')
            ->assertOk();

        $data = $response->json('data.0.data');
        $this->assertSame('invitation', $data['event']);
        $this->assertNotEmpty($data['appointment_uuid']);
        $this->assertArrayNotHasKey('internal_secret', $data);
        $this->assertArrayNotHasKey('notifiable_id', $response->json('data.0'));
        $this->assertArrayNotHasKey('notifiable_type', $response->json('data.0'));
        $this->assertStringNotContainsString('must-not-leak', $response->getContent());
    }

    public function test_unknown_notification_type_serializes_empty_data(): void
    {
        $this->createNotification($this->user, ['type' => 'App\Notifications\FutureUnknownNotificationType']);

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'App\Notifications\FutureUnknownNotificationType');

        $this->assertSame([], $response->json('data.0.data'));
    }

    public function test_existing_appointment_notification_write_path_remains_compatible(): void
    {
        $organizer = User::factory()->create();
        $appointment = Appointment::factory()->create(['organizer_id' => $organizer->id]);
        UserProfile::factory()->create([
            'user_id' => $this->user->id,
            'notification_preferences' => ['email' => false, 'in_app' => true],
        ]);

        Notification::sendNow($this->user, new AppointmentNotification($appointment, 'invitation'));

        $stored = $this->user->notifications()->where('type', AppointmentNotification::class)->first();
        $this->assertNotNull($stored);
        $this->assertNull($stored->read_at);
        $this->assertSame($appointment->uuid, $stored->data['appointment_uuid']);
        $this->assertSame('invitation', $stored->data['event']);

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $stored->id)
            ->assertJsonPath('data.0.data.appointment_uuid', $appointment->uuid);
    }

    /**
     * @return array<int, array{0: string, 1: string}>
     */
    private function endpointMatrix(string $id): array
    {
        return [
            ['getJson', '/api/v1/notifications'],
            ['getJson', '/api/v1/notifications/unread-count'],
            ['patchJson', '/api/v1/notifications/read-all'],
            ['patchJson', '/api/v1/notifications/'.$id.'/read'],
        ];
    }

    /** @param array<string, mixed> $overrides */
    private function createNotification(User $recipient, array $overrides = []): DatabaseNotification
    {
        return $recipient->notifications()->create(array_merge([
            'id' => (string) Str::uuid(),
            'type' => AppointmentNotification::class,
            'data' => [
                'event' => 'invitation',
                'appointment_uuid' => '6a499e9f-e0c6-4b76-a369-99b7acbbab62',
                'title' => 'Planning session',
                'start_time' => '2026-11-12T10:00:00.000000Z',
                'end_time' => '2026-11-12T11:00:00.000000Z',
                'timezone' => 'Africa/Mogadishu',
                'organizer_name' => 'Organizer',
                'context' => 'personal',
                'internal_secret' => 'must-not-leak',
            ],
            'read_at' => null,
            'created_at' => now(),
        ], $overrides));
    }
}
