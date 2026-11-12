<?php

namespace Tests\Feature\Api;

use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class GlobalRateLimitTest extends TestCase
{
    use RefreshDatabase;

    private const HEALTH_PATH = '/api/v1/health';

    private const ME_PATH = '/api/v1/auth/me';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_global_throttle_is_attached_exactly_once_to_every_api_route(): void
    {
        $apiRoutes = array_values(array_filter(
            Route::getRoutes()->getRoutes(),
            fn ($route): bool => str_starts_with($route->uri(), 'api/')
        ));

        $this->assertGreaterThan(0, count($apiRoutes), 'API routes must exist.');

        foreach ($apiRoutes as $route) {
            $attachments = array_values(array_filter(
                app('router')->gatherRouteMiddleware($route),
                fn (mixed $middleware): bool => $middleware === 'throttle:api'
                    || $middleware === ThrottleRequests::class.':api'
            ));

            $this->assertCount(
                1,
                $attachments,
                "throttle:api must be attached exactly once to [{$route->uri()}] (".implode(',', $route->methods()).').'
            );
        }

        foreach (['api.v1.auth.login', 'api.v1.notifications.index'] as $routeName) {
            $this->assertNotNull(Route::getRoutes()->getByName($routeName), "Route [{$routeName}] must exist.");
        }
    }

    public function test_global_limit_allows_60_requests_then_returns_standardized_429(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10']);

        for ($attempt = 0; $attempt < 60; $attempt++) {
            $response = $this->getJson(self::HEALTH_PATH)->assertOk();

            if ($attempt === 0) {
                $response->assertHeader('X-RateLimit-Limit', '60');
            }
        }

        $blocked = $this->getJson(self::HEALTH_PATH)
            ->assertStatus(429)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'RATE_LIMIT_EXCEEDED')
            ->assertJsonPath('message', 'Rate limit exceeded. Please slow down your requests.');

        $this->assertSame('60', $blocked->headers->get('X-RateLimit-Limit'));
        $this->assertSame('0', $blocked->headers->get('X-RateLimit-Remaining'));
        $this->assertNotNull($blocked->headers->get('Retry-After'));
        $this->assertGreaterThan(0, (int) $blocked->headers->get('Retry-After'));
    }

    public function test_authenticated_users_have_independent_rate_limit_counters(): void
    {
        $userA = $this->createMember('Rate Limit User A');
        $userB = $this->createMember('Rate Limit User B');

        $this->actingAs($userA, 'sanctum');

        for ($attempt = 0; $attempt < 60; $attempt++) {
            $this->getJson(self::ME_PATH)->assertOk();
        }

        // Exhausted user stays blocked even when supplying another user's id.
        $this->getJson(self::ME_PATH.'?user_id='.$userB->id)
            ->assertStatus(429)
            ->assertJsonPath('error_code', 'RATE_LIMIT_EXCEEDED');

        // A different authenticated user on the same client IP gets a fresh counter.
        $fresh = $this->actingAs($userB, 'sanctum')
            ->getJson(self::ME_PATH)
            ->assertOk();

        $this->assertSame('59', $fresh->headers->get('X-RateLimit-Remaining'));
    }

    public function test_unauthenticated_requests_are_scoped_to_client_ip_and_headers_cannot_bypass(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7']);

        for ($attempt = 0; $attempt < 60; $attempt++) {
            $this->getJson(self::HEALTH_PATH)->assertOk();
        }

        $this->getJson(self::HEALTH_PATH)
            ->assertStatus(429)
            ->assertJsonPath('error_code', 'RATE_LIMIT_EXCEEDED');

        // X-Forwarded-For is untrusted (no trusted-proxy configuration), so a
        // spoofed header must not mint a fresh identity for the exhausted IP.
        $this->withHeaders(['X-Forwarded-For' => '203.0.113.99'])
            ->getJson(self::HEALTH_PATH)
            ->assertStatus(429);

        // A different real client IP receives an independent counter.
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.8']);

        $fresh = $this->getJson(self::HEALTH_PATH)->assertOk();
        $this->assertSame('59', $fresh->headers->get('X-RateLimit-Remaining'));
    }

    public function test_stricter_endpoint_specific_limits_remain_layered_under_global_limit(): void
    {
        $member = $this->createMember('Invitation Throttle Member');
        $this->actingAs($member, 'sanctum');

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $response = $this->postJson('/api/v1/invitations', []);

            $this->assertNotEquals(
                429,
                $response->getStatusCode(),
                'The invitations limiter (10/min) must not fire before its 11th request.'
            );
        }

        $blocked = $this->postJson('/api/v1/invitations', [])
            ->assertStatus(429)
            ->assertJsonPath('error_code', 'RATE_LIMIT_EXCEEDED');

        // The response reflects the stricter endpoint limiter layered after the
        // global limiter, proving both middlewares run on the same route.
        $this->assertSame('10', $blocked->headers->get('X-RateLimit-Limit'));
    }

    private function createMember(string $name): User
    {
        $user = User::factory()->create(['name' => $name]);
        $user->roles()->attach(Role::where('slug', UserRole::Member->value)->first()->id);

        return $user;
    }
}
