<?php

namespace Tests\Feature\Api\V1;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Habit;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class Phase8AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;

    protected User $attacker;

    protected User $admin;

    protected Habit $habit;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        Carbon::setTestNow(Carbon::parse('2026-11-08 12:00:00', 'UTC'));

        $memberRole = Role::where('slug', UserRole::Member->value)->first();

        $this->owner = User::factory()->create(['name' => 'Habit Owner']);
        $this->owner->roles()->attach($memberRole->id);

        $this->attacker = User::factory()->create(['name' => 'Outsider Member']);
        $this->attacker->roles()->attach($memberRole->id);

        $this->admin = User::factory()->create(['name' => 'System Admin']);
        $this->admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->first()->id);

        $this->habit = Habit::factory()->create([
            'user_id' => $this->owner->id,
            'title' => 'Private Owner Habit',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    /**
     * @return array<string, string>
     */
    protected function auth(User $user, string $label = 'session'): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.$user->createToken($label)->plainTextToken];
    }

    /**
     * @return array<int, array{0: string, 1: string}>
     */
    public static function phase8EndpointProvider(): array
    {
        return [
            ['GET', '/api/v1/habits'],
            ['POST', '/api/v1/habits'],
            ['GET', '/api/v1/habits/daily-overview'],
            ['GET', '/api/v1/habits/{uuid}'],
            ['PUT', '/api/v1/habits/{uuid}'],
            ['DELETE', '/api/v1/habits/{uuid}'],
            ['POST', '/api/v1/habits/{uuid}/archive'],
            ['POST', '/api/v1/habits/{uuid}/restore'],
            ['GET', '/api/v1/habits/{uuid}/logs'],
            ['POST', '/api/v1/habits/{uuid}/logs'],
            ['DELETE', '/api/v1/habits/{uuid}/logs/{date}'],
        ];
    }

    #[DataProvider('phase8EndpointProvider')]
    public function test_phase8_endpoints_require_authentication(string $method, string $uri): void
    {
        $uri = strtr($uri, [
            '{uuid}' => $this->habit->uuid,
            '{date}' => Carbon::now()->format('Y-m-d'),
        ]);

        $this->json($method, $uri)
            ->assertStatus(401)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'UNAUTHENTICATED');
    }

    public function test_suspended_account_is_blocked_on_habit_endpoints(): void
    {
        $suspended = User::factory()->create(['account_status' => AccountStatus::Suspended]);
        $suspended->roles()->attach(Role::where('slug', UserRole::Member->value)->first()->id);
        $headers = $this->auth($suspended, 'suspended');

        foreach (['/api/v1/habits', '/api/v1/habits/daily-overview', '/api/v1/habits/'.$this->habit->uuid] as $uri) {
            $this->getJson($uri, $headers)
                ->assertStatus(403)
                ->assertJsonPath('success', false)
                ->assertJsonPath('error_code', 'ACCOUNT_NOT_ACTIVE');
        }
    }

    /**
     * @return array<int, array{0: string, 1: string, 2: array<string, mixed>}>
     */
    public static function crossScopeEndpointProvider(): array
    {
        return [
            ['GET', '/api/v1/habits/{uuid}', []],
            ['PUT', '/api/v1/habits/{uuid}', ['title' => 'Hijacked']],
            ['DELETE', '/api/v1/habits/{uuid}', []],
            ['POST', '/api/v1/habits/{uuid}/archive', []],
            ['POST', '/api/v1/habits/{uuid}/restore', []],
            ['GET', '/api/v1/habits/{uuid}/logs', []],
            ['POST', '/api/v1/habits/{uuid}/logs', ['logged_date' => '{date}', 'status' => 'completed']],
            ['DELETE', '/api/v1/habits/{uuid}/logs/{date}', []],
        ];
    }

    #[DataProvider('crossScopeEndpointProvider')]
    public function test_cross_scope_access_returns_404(string $method, string $uri, array $body): void
    {
        $replacements = [
            '{uuid}' => $this->habit->uuid,
            '{date}' => Carbon::now()->format('Y-m-d'),
        ];

        $uri = strtr($uri, $replacements);
        $body = array_map(
            fn ($value): mixed => is_string($value) ? strtr($value, $replacements) : $value,
            $body
        );

        $this->json($method, $uri, $body, $this->auth($this->attacker, 'outsider'))
            ->assertStatus(404)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    #[DataProvider('crossScopeEndpointProvider')]
    public function test_system_admin_cross_scope_access_returns_404(string $method, string $uri, array $body): void
    {
        $replacements = [
            '{uuid}' => $this->habit->uuid,
            '{date}' => Carbon::now()->format('Y-m-d'),
        ];

        $uri = strtr($uri, $replacements);
        $body = array_map(
            fn ($value): mixed => is_string($value) ? strtr($value, $replacements) : $value,
            $body
        );

        // Approved Decision 10: strict personal privacy — no System Admin access
        // through standard endpoints.
        $this->json($method, $uri, $body, $this->auth($this->admin, 'admin'))
            ->assertStatus(404)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    /**
     * @return array<int, array{0: string}>
     */
    public static function uuidBoundRouteProvider(): array
    {
        return [
            ['GET'],
            ['PUT'],
            ['DELETE'],
        ];
    }

    #[DataProvider('uuidBoundRouteProvider')]
    public function test_uuid_bound_routes_reject_numeric_ids(string $method): void
    {
        $headers = $this->auth($this->attacker, 'outsider');
        $body = $method === 'PUT' ? ['title' => 'Numeric'] : [];

        $this->json($method, '/api/v1/habits/1', $body, $headers)
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_permission_failure_uses_403_error_envelope(): void
    {
        $roleLess = User::factory()->create();

        $this->getJson('/api/v1/habits', $this->auth($roleLess, 'roleless'))
            ->assertStatus(403)
            ->assertJsonStructure(['success', 'message', 'errors', 'error_code'])
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_validation_failure_uses_422_error_envelope(): void
    {
        $this->postJson('/api/v1/habits', [], $this->auth($this->owner, 'owner'))
            ->assertStatus(422)
            ->assertJsonStructure(['success', 'message', 'errors', 'error_code'])
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_phase8_list_endpoints_return_success_envelope_with_meta(): void
    {
        $headers = $this->auth($this->owner, 'owner');

        $this->getJson('/api/v1/habits', $headers)
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

        $this->getJson('/api/v1/habits/daily-overview', $headers)
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['date', 'timezone', 'habits']]);
    }
}
