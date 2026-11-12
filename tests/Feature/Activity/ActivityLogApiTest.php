<?php

namespace Tests\Feature\Activity;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Appointment;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

class ActivityLogApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $member;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $this->admin = User::factory()->create(['name' => 'System Admin']);
        $this->admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->first()->id);

        $this->member = User::factory()->create(['name' => 'Ordinary Member']);
        $this->member->roles()->attach(Role::where('slug', UserRole::Member->value)->first()->id);
    }

    public function test_system_admin_can_list_activity_logs_with_pagination(): void
    {
        ActivityLog::factory()->count(20)->create(['action' => 'project.created']);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/activity-logs')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Activity logs retrieved successfully.')
            ->assertJsonCount(15, 'data')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('meta.total', 20);
    }

    public function test_non_admin_cannot_list_activity_logs(): void
    {
        ActivityLog::factory()->count(3)->create();

        $this->actingAs($this->member, 'sanctum')
            ->getJson('/api/v1/activity-logs')
            ->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        foreach (['/api/v1/activity-logs', '/api/v1/activity-logs/my'] as $uri) {
            $this->getJson($uri)
                ->assertStatus(401)
                ->assertJsonPath('success', false)
                ->assertJsonPath('error_code', 'UNAUTHENTICATED');
        }
    }

    public function test_suspended_account_cannot_access_activity_logs(): void
    {
        $suspended = User::factory()->create(['account_status' => AccountStatus::Suspended]);
        $suspended->roles()->attach(Role::where('slug', UserRole::Member->value)->first()->id);

        foreach (['/api/v1/activity-logs', '/api/v1/activity-logs/my'] as $uri) {
            $this->actingAs($suspended, 'sanctum')
                ->getJson($uri)
                ->assertStatus(403)
                ->assertJsonPath('success', false)
                ->assertJsonPath('error_code', 'ACCOUNT_NOT_ACTIVE');
        }
    }

    public function test_my_timeline_returns_only_own_records(): void
    {
        ActivityLog::factory()->count(3)->create(['user_id' => $this->member->id]);
        ActivityLog::factory()->count(2)->create();

        $response = $this->actingAs($this->member, 'sanctum')
            ->getJson('/api/v1/activity-logs/my')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Personal activity timeline retrieved successfully.')
            ->assertJsonPath('meta.total', 3);

        foreach ($response->json('data') as $entry) {
            $this->assertSame($this->member->id, $entry['user_id']);
        }
    }

    public function test_system_admin_my_timeline_is_scoped_to_own_records(): void
    {
        ActivityLog::factory()->count(4)->create(['user_id' => $this->member->id]);
        ActivityLog::factory()->count(2)->create(['user_id' => $this->admin->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/activity-logs/my')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        foreach ($response->json('data') as $entry) {
            $this->assertSame($this->admin->id, $entry['user_id']);
        }
    }

    public function test_my_timeline_never_exposes_forensic_fields(): void
    {
        ActivityLog::factory()->create([
            'user_id' => $this->member->id,
            'ip_address' => '203.0.113.77',
            'user_agent' => 'SecretAgent/1.0',
        ]);

        $response = $this->actingAs($this->member, 'sanctum')->getJson('/api/v1/activity-logs/my');
        $response->assertOk();

        $this->assertArrayNotHasKey('ip_address', $response->json('data.0'));
        $this->assertArrayNotHasKey('user_agent', $response->json('data.0'));
        $this->assertStringNotContainsString('203.0.113.77', $response->getContent());
        $this->assertStringNotContainsString('SecretAgent/1.0', $response->getContent());
    }

    public function test_system_list_never_exposes_forensic_fields_even_to_audit_holders(): void
    {
        ActivityLog::factory()->create([
            'ip_address' => '203.0.113.99',
            'user_agent' => 'StealthBot/2.0',
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/activity-logs');
        $response->assertOk();

        $this->assertArrayNotHasKey('ip_address', $response->json('data.0'));
        $this->assertArrayNotHasKey('user_agent', $response->json('data.0'));
        $this->assertStringNotContainsString('203.0.113.99', $response->getContent());
        $this->assertStringNotContainsString('StealthBot/2.0', $response->getContent());
    }

    public function test_activity_logs_are_append_only(): void
    {
        $log = ActivityLog::factory()->create();
        $originalAction = $log->action;

        try {
            $log->update(['action' => 'tampered.action']);
            $this->fail('Updating an activity log should throw a RuntimeException.');
        } catch (RuntimeException $exception) {
            $this->assertNotEmpty($exception->getMessage());
        }

        try {
            $log->delete();
            $this->fail('Deleting an activity log should throw a RuntimeException.');
        } catch (RuntimeException $exception) {
            $this->assertNotEmpty($exception->getMessage());
        }

        $this->assertDatabaseHas('activity_logs', [
            'id' => $log->id,
            'action' => $originalAction,
        ]);
    }

    public function test_activity_logs_expose_no_write_routes(): void
    {
        $writeMethods = [];

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1/activity-logs')) {
                continue;
            }

            foreach ($route->methods() as $method) {
                if (! in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
                    $writeMethods[] = $method.' '.$route->uri();
                }
            }
        }

        $this->assertSame([], $writeMethods);
        $this->assertSame(
            ['GET api/v1/activity-logs', 'GET api/v1/activity-logs/my'],
            $this->activityLogRouteList()
        );
    }

    public function test_system_list_filters_are_validated_and_applied(): void
    {
        ActivityLog::factory()->count(3)->create(['action' => 'alpha.event']);
        ActivityLog::factory()->count(2)->create(['action' => 'beta.event']);

        $filtered = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/activity-logs?action=alpha.event')
            ->assertOk()
            ->assertJsonPath('meta.total', 3);

        foreach ($filtered->json('data') as $entry) {
            $this->assertSame('alpha.event', $entry['action']);
        }

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/activity-logs?from=not-a-date')
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/activity-logs?per_page=1000')
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->actingAs($this->member, 'sanctum')
            ->getJson('/api/v1/activity-logs/my?per_page=abc')
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_appointment_admin_view_still_writes_identical_audit_record(): void
    {
        $owner = $this->userWithPermissions(['appointments.create']);
        $appointment = Appointment::factory()->create(['organizer_id' => $owner->id]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/appointments/admin/'.$appointment->uuid.'/view', [
                'reason' => 'Customer support investigation',
            ])
            ->assertOk()
            ->assertJsonPath('data.uuid', $appointment->uuid);

        $log = ActivityLog::query()->where('action', 'appointment.admin.view')->sole();

        $this->assertSame($this->admin->id, $log->user_id);
        $this->assertSame(Appointment::class, $log->subject_type);
        $this->assertSame($appointment->id, $log->subject_id);
        $this->assertSame('System administrator viewed an appointment for support.', $log->description);
        $this->assertSame([
            'appointment_uuid' => $appointment->uuid,
            'context_type' => 'personal',
            'context_id' => null,
            'access_mode' => 'read_only',
            'reason' => 'Customer support investigation',
        ], $log->properties);
        $this->assertNotNull($log->ip_address);
        $this->assertNotNull($log->user_agent);
        $this->assertNotNull($log->created_at);
    }

    /** @return array<int, string> */
    private function activityLogRouteList(): array
    {
        $routes = [];

        foreach (Route::getRoutes() as $route) {
            if (str_starts_with($route->uri(), 'api/v1/activity-logs')) {
                foreach ($route->methods() as $method) {
                    if ($method === 'GET') {
                        $routes[] = $method.' '.$route->uri();
                    }
                }
            }
        }

        return array_values(array_unique($routes));
    }

    /** @param array<int, string> $permissions */
    private function userWithPermissions(array $permissions, string $roleSlug = 'activity-test-role'): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create(['slug' => $roleSlug.'-'.$user->id]);
        $permissionIds = [];
        foreach ($permissions as $slug) {
            $permissionIds[] = Permission::query()->firstOrCreate(['slug' => $slug], [
                'name' => $slug,
                'module' => 'appointments',
                'description' => $slug,
            ])->id;
        }
        $role->permissions()->sync($permissionIds);
        $user->roles()->attach($role);

        return $user;
    }
}
